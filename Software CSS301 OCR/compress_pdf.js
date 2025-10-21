// Combined compressor + results-page logic (works on both pages)
(function () {
  // Optional loader wiring (uses existing DOM if present)
  const loadingArea = document.querySelector('.loading_area');
  const progressBar = document.querySelector('.progress-bar');
  const stateText = document.querySelector('.state');
  const percentageText = document.querySelector('.percentage');

  function showLoader() { if (loadingArea) loadingArea.style.display = 'flex'; setLoaderStatus('Starting...'); setLoaderProgress(0); }
  function hideLoader() { if (loadingArea) loadingArea.style.display = 'none'; }
  function setLoaderStatus(text) { if (stateText) stateText.textContent = text || ''; }
  function setLoaderProgress(pct) {
    const v = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    if (progressBar) progressBar.style.width = v + '%';
    if (percentageText) percentageText.textContent = v + '%';
  }

  // Utils
  function bytesToSize(n) {
    if (!n) return '0 B';
    const k = 1024, sizes = ['B','KB','MB','GB'], i = Math.floor(Math.log(n)/Math.log(k));
    return parseFloat((n/Math.pow(k,i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsArrayBuffer(file);
    });
  }

  // Shared compressor (pdf.js + jsPDF)
  async function compressPdfFile(file, level = 'medium') {
    if (!window.pdfjsLib || !window.jspdf) throw new Error('Missing pdf.js or jsPDF');

    const presets = {
      low:    { maxWidth: 900,  quality: 0.6 },
      medium: { maxWidth: 1400, quality: 0.75 },
      high:   { maxWidth: 2000, quality: 0.9 }
    };
    const { maxWidth, quality } = presets[level] || presets.medium;

    const data = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    const { jsPDF } = window.jspdf;
    let out;
    const total = pdf.numPages;

    for (let i = 1; i <= total; i++) {
      setLoaderStatus(`Rendering page ${i}/${total}...`);
      setLoaderProgress(Math.round(((i - 1) / total) * 85) + 10);

      const page = await pdf.getPage(i);
      const baseVp = page.getViewport({ scale: 1 });
      const scale = maxWidth / baseVp.width;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const wPt = canvas.width * 0.75;   // px@96dpi -> pt
      const hPt = canvas.height * 0.75;

      if (!out) {
        out = new jsPDF({
          orientation: wPt >= hPt ? 'l' : 'p',
          unit: 'pt',
          format: [wPt, hPt],
          compress: true
        });
      } else {
        out.addPage([wPt, hPt], wPt >= hPt ? 'l' : 'p');
      }

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      out.addImage(dataUrl, 'JPEG', 0, 0, wPt, hPt, undefined, 'FAST');
    }

    return out.output('blob');
  }

  // Smart compression: avoid rasterizing text PDFs; cap pixels; auto-grayscale; size guard + fallback
  async function compressPdfSmart(file, level = 'medium') {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    if (!window.pdfjsLib) throw new Error('pdf.js not loaded');

    const presets = {
      low:    { targetDpi: 110, maxPx: 1200, quality: 0.55, grayscale: true,  level: 'low' },
      medium: { targetDpi: 150, maxPx: 1600, quality: 0.70, grayscale: false, level: 'medium' },
      high:   { targetDpi: 200, maxPx: 2000, quality: 0.82, grayscale: false, level: 'high' }
    };
    const preset = presets[level] || presets.medium;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // 1) If it has text, copy vectors (no raster) to avoid size growth
    const hasText = await detectPdfHasText(pdf, 3);
    if (hasText && window.PDFLib) {
      try {
        const blob = await copyPdfWithoutRaster(arrayBuffer);
        // Size guard: if not smaller, keep original
        if (blob.size < file.size * 0.98) return blob;
        // fall through to raster path only if user asks for stronger shrink
      } catch (e) {
        console.warn('Vector copy failed, falling back to raster:', e);
      }
    }

    // 2) Rasterize scans with safeguards
    let blob = await rasterizeAndCompress(pdf, preset);

    // Size guard + fallback: if not smaller, retry with stronger settings
    if (blob.size >= file.size * 0.98) {
      setLoaderStatus('Retrying with stronger compression…');
      const fallback = {
        targetDpi: Math.max(96, Math.floor(preset.targetDpi * 0.75)),
        maxPx: Math.max(900, Math.floor(preset.maxPx * 0.8)),
        quality: Math.max(0.5, +(preset.quality - 0.1).toFixed(2)),
        grayscale: true, // force grayscale on retry
        level: 'fallback'
      };
      blob = await rasterizeAndCompress(pdf, fallback);
    }

    // Final guard: if still not smaller, return original file
    return (blob.size < file.size * 0.98) ? blob : file;
  }

  // Detect if the PDF has selectable text (sample first N pages)
  async function detectPdfHasText(pdf, samplePages = 3) {
    const total = Math.min(samplePages, pdf.numPages);
    for (let i = 1; i <= total; i++) {
      const page = await pdf.getPage(i);
      try {
        const text = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
        const chars = (text.items || []).map(t => t.str || '').join('');
        if ((chars || '').trim().length > 20) return true;
      } catch {}
    }
    return false;
  }

  // Non-raster copy with PDF-LIB (keeps vectors)
  async function copyPdfWithoutRaster(arrayBuffer) {
    if (!window.PDFLib) throw new Error('PDF-LIB not loaded');
    const src = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true, updateMetadata: false });
    const out = await PDFLib.PDFDocument.create();
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p => out.addPage(p));
    try { out.setProducer(''); out.setCreator(''); out.setTitle(''); out.setSubject(''); out.setKeywords([]); } catch {}
    const bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
    return new Blob([bytes], { type: 'application/pdf' });
  }

  // Heuristic to detect scan-like (mostly black/white) pages
  function looksBitonal(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const step = 8; // sample every 8px per axis
    let samples = 0, bwish = 0, colored = 0;
    for (let y = 0; y < height; y += step) {
      const row = ctx.getImageData(0, y, width, 1).data;
      for (let x = 0; x < width * 4; x += step * 4) {
        const r = row[x], g = row[x + 1], b = row[x + 2];
        const grayish = Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b) < 30;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const nearBW = lum < 40 || lum > 215;
        if (nearBW && grayish) bwish++; else colored++;
        samples++;
      }
    }
    const bwRatio = samples ? bwish / samples : 0;
    return bwRatio > 0.85; // mostly BW
  }

  // Convert canvas to data URL preferring WebP when supported (smaller than JPEG)
  function canvasToDataUrl(canvas, quality) {
    let url;
    try {
      url = canvas.toDataURL('image/webp', quality);
      if (url && url.startsWith('data:image/webp')) {
        return { url, fmt: 'WEBP' };
      }
    } catch {}
    url = canvas.toDataURL('image/jpeg', quality);
    return { url, fmt: 'JPEG' };
  }

  // Rasterize with DPI cap and auto-grayscale; correct point sizing
  async function rasterizeAndCompress(pdf, preset) {
    if (!window.jspdf) throw new Error('jsPDF not loaded');
    const { jsPDF } = window.jspdf;
    const { targetDpi, maxPx, quality } = preset;
    let { grayscale } = preset;

    const total = pdf.numPages;
    let doc;

    for (let i = 1; i <= total; i++) {
      setLoaderStatus(`Rendering page ${i}/${total}...`);
      setLoaderProgress(Math.round(((i - 1) / total) * 85) + 10);

      const page = await pdf.getPage(i);
      const baseVp = page.getViewport({ scale: 1 });
      // Do not upscale: cap by maxPx width and target DPI
      const scaleByDpi = targetDpi / 72;       // points -> pixels at target DPI
      const scaleByMax = maxPx / baseVp.width; // pixels cap by width
      const scale = Math.min(scaleByDpi, scaleByMax);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Auto-grayscale for scan-like documents (first page heuristic)
      if (i === 1 && !grayscale && looksBitonal(canvas)) {
        grayscale = true;
      }
      if (grayscale) {
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = img.data;
        for (let p = 0; p < d.length; p += 4) {
          const y = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
          d[p] = d[p + 1] = d[p + 2] = y;
        }
        ctx.putImageData(img, 0, 0);
      }

      // IMPORTANT: map canvas pixels (rendered at targetDpi) back to PDF points
      const ptPerPx = 72 / targetDpi; // e.g., targetDpi 150 => 0.48 pt per px
      const wPt = Math.max(1, Math.round(canvas.width * ptPerPx));
      const hPt = Math.max(1, Math.round(canvas.height * ptPerPx));

      if (!doc) {
        doc = new jsPDF({
          orientation: wPt >= hPt ? 'l' : 'p',
          unit: 'pt',
          format: [wPt, hPt],
          compress: true
        });
      } else {
        doc.addPage([wPt, hPt], wPt >= hPt ? 'l' : 'p');
      }

      // Prefer WebP when available, fallback to JPEG
      const { url: dataUrl, fmt } = canvasToDataUrl(canvas, quality);
      try {
        doc.addImage(dataUrl, fmt, 0, 0, wPt, hPt, undefined, 'FAST');
      } catch (e) {
        // Fallback to JPEG if WebP not supported by jsPDF in this environment
        if (fmt !== 'JPEG') {
          const jpegUrl = canvas.toDataURL('image/jpeg', quality);
          doc.addImage(jpegUrl, 'JPEG', 0, 0, wPt, hPt, undefined, 'FAST');
        } else {
          throw e;
        }
      }
    }

    // Strip doc metadata (tiny savings)
    try { doc.setProperties({ title: '', subject: '', author: '', keywords: '', creator: '' }); } catch {}
    return doc.output('blob');
  }

  // Ensure smart compression is used everywhere
  compressPdfFile = compressPdfSmart;

  // Compress page wiring (select + compress + redirect)
  function initCompressPage() {
    const fileInput = document.getElementById('file_input');
    const compressBtn = document.getElementById('compress_btn');
    const levelSel = document.getElementById('compress_level');
    const statusEl = document.getElementById('compress_status');

    if (!fileInput && !compressBtn) return; // Not on compress page

    window.open_file = function () { if (fileInput) fileInput.click(); };

    let selectedFile = null;

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
          alert('Please select a PDF file.');
          return;
        }
        selectedFile = f;
        if (statusEl) statusEl.textContent = `Selected: ${f.name} (${bytesToSize(f.size)})`;
      });
    }

    if (compressBtn) {
      compressBtn.addEventListener('click', async () => {
        if (!selectedFile) { alert('Please select a PDF first.'); return; }
        const level = levelSel ? levelSel.value : 'medium';
        try {
          showLoader(); setLoaderStatus('Analyzing...'); setLoaderProgress(5);
          let blob = await compressPdfSmart(selectedFile, level);
          setLoaderStatus('Finalizing...'); setLoaderProgress(95);
          if (blob === selectedFile) {
            if (statusEl) statusEl.textContent = 'Already optimized. Using original file (no further reduction possible).';
          } else if (statusEl) {
            statusEl.textContent = `Compressed: ${bytesToSize(selectedFile.size)} → ${bytesToSize(blob.size)}`;
          }
          // Save and navigate to results page
          const reader = new FileReader();
          reader.onload = () => {
            try {
              sessionStorage.setItem('compressed_pdf_dataurl', reader.result);
              sessionStorage.setItem('compressed_pdf_meta', JSON.stringify({
                originalSize: selectedFile.size, newSize: blob.size, name: selectedFile.name, ts: Date.now()
              }));
            } catch {}
            window.location.href = 'compressed_pdf.html';
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          console.error(err);
          if (statusEl) statusEl.textContent = 'Compression failed. See console for details.';
        } finally {
          setLoaderStatus('Done'); setLoaderProgress(100);
          setTimeout(hideLoader, 400);
        }
      });
    }
  }

  // Results page wiring (preview + download + upload new -> compress here)
  function initResultsPage() {
    const metaEl = document.getElementById('result_meta');
    const link = document.getElementById('download_link');
    const uploadBtn = document.getElementById('upload_new_pdf');
    const fileInput = document.getElementById('result_file_input');
    const preview = document.getElementById('pdf_preview');

    if (!metaEl && !link && !uploadBtn && !preview) return; // Not on results page

    function setPreviewAndLink(srcUrl, name, originalSize, newSize) {
      if (preview) preview.setAttribute('data', srcUrl);
      if (link) {
        const baseName = (name || 'document').replace(/\.pdf$/i, '');
        link.href = srcUrl;
        link.download = `${baseName}.compressed.pdf`;
      }
      if (metaEl) metaEl.textContent = `Original: ${bytesToSize(originalSize || 0)} → Compressed: ${bytesToSize(newSize || 0)}`;
    }

    // Populate from sessionStorage if coming from the compress page
    let dataUrl = null, meta = {};
    try {
      dataUrl = sessionStorage.getItem('compressed_pdf_dataurl');
      meta = JSON.parse(sessionStorage.getItem('compressed_pdf_meta') || '{}');
    } catch (e) {
      console.warn('Failed to read compressed result from sessionStorage', e);
    }

    if (dataUrl) {
      setPreviewAndLink(dataUrl, meta.name, meta.originalSize, meta.newSize);
    } else {
      if (preview) preview.removeAttribute('data');
      if (link) link.removeAttribute('href');
      if (metaEl) metaEl.textContent = '';
    }

    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
          alert('Please select a PDF file.');
          return;
        }
        showLoader(); setLoaderStatus('Uploading...'); setLoaderProgress(10);
        let blob;
        try {
          // Upload + compress in one go
          const formData = new FormData();
          formData.append('file', f);
          const uploadResponse = await fetch('upload.php', { method: 'POST', body: formData });
          if (!uploadResponse.ok) throw new Error('Upload failed');

          const fileUrl = await uploadResponse.text();
          setLoaderStatus('Processing...'); setLoaderProgress(50);

          // Directly use the uploaded file URL for preview
          dataUrl = fileUrl;
          setPreviewAndLink(dataUrl, f.name, f.size, f.size);

          // Optionally, fetch the file back as blob (if needed for further processing)
          const blobResponse = await fetch(fileUrl);
          if (blobResponse.ok) {
            const blobData = await blobResponse.blob();
            blob = blobData;
          }
        } catch (err) {
          console.error(err);
          setLoaderStatus('Error'); setLoaderProgress(0);
          if (metaEl) metaEl.textContent = 'Upload or processing failed. See console for details.';
        } finally {
          hideLoader();
        }

        // If we have a blob and it's smaller, offer download
        if (blob && blob.size < f.size * 0.98) {
          const url = URL.createObjectURL(blob);
           setPreviewAndLink(url, f.name, f.size, blob.size);
          if (blob === f) {
            if (metaEl) metaEl.textContent = 'Already optimized. Using original file (no further reduction possible).';
          }
        }
      });
    }
  }

  // Init on DOM ready (run both initializers; each no-ops if its elements aren't present)
  document.addEventListener('DOMContentLoaded', () => {
    try {
      initCompressPage();   // will only wire up if compress-page elements exist
      initResultsPage();    // will only wire up if results-page elements exist
    } catch (e) {
      console.error('Init error:', e);
    }
  });
})();