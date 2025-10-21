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

// Simple in-page compressor (medium quality) for uploading a new PDF here
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
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const baseVp = page.getViewport({ scale: 1 });
    const scale = maxWidth / baseVp.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const wPt = canvas.width * 0.75;
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

document.addEventListener('DOMContentLoaded', async () => {
  const metaEl = document.getElementById('result_meta');
  const link = document.getElementById('download_link');
  const uploadBtn = document.getElementById('upload_new_pdf');
  const fileInput = document.getElementById('result_file_input');
  const preview = document.getElementById('pdf_preview');

  // Populate from sessionStorage if coming from the compress page
  let dataUrl = null, meta = {};
  try {
    dataUrl = sessionStorage.getItem('compressed_pdf_dataurl');
    meta = JSON.parse(sessionStorage.getItem('compressed_pdf_meta') || '{}');
  } catch (e) {
    console.warn('Failed to read compressed result from sessionStorage', e);
  }

  function setPreviewAndLink(srcUrl, name, originalSize, newSize) {
    if (preview) {
      preview.setAttribute('data', srcUrl);
    }
    if (link) {
      const baseName = (name || 'document').replace(/\.pdf$/i, '');
      link.href = srcUrl;
      link.download = `${baseName}.compressed.pdf`;
    }
    if (metaEl) {
      metaEl.textContent = `Original: ${bytesToSize(originalSize || 0)} → Compressed: ${bytesToSize(newSize || 0)}`;
    }
  }

  if (dataUrl) {
    setPreviewAndLink(dataUrl, meta.name, meta.originalSize, meta.newSize);
  } else {
    if (metaEl) metaEl.textContent = 'No compressed PDF found. Upload a PDF to compress.';
  }

  // Upload new PDF flow (compress right on this page, medium quality)
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
        alert('Please select a PDF file.');
        return;
      }
      try {
        if (metaEl) metaEl.textContent = 'Compressing…';
        const blob = await compressPdfFile(f, 'medium');
        const url = URL.createObjectURL(blob);
        // Update UI
        setPreviewAndLink(url, f.name, f.size, blob.size);
        // Also refresh session storage so user can navigate back to this page later
        const reader = new FileReader();
        reader.onload = () => {
          try {
            sessionStorage.setItem('compressed_pdf_dataurl', reader.result);
            sessionStorage.setItem('compressed_pdf_meta', JSON.stringify({
              originalSize: f.size, newSize: blob.size, name: f.name, ts: Date.now()
            }));
          } catch {}
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error(err);
        alert('Compression failed. See console for details.');
      }
    });
  }
});