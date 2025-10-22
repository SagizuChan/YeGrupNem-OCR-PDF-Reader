"use client";
import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";

function randomName(len = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint32Array(len);
  (globalThis.crypto || ({} as any)).getRandomValues?.(bytes);
  let out = "";
  for (let i = 0; i < len; i++) {
    const r = bytes[i] ?? Math.floor(Math.random() * 0xffffffff);
    out += chars[r % chars.length];
  }
  return out;
}

export default function PdfOcrResultPage() {
  const [text, setText] = useState("");
  const [editable, setEditable] = useState(false);
  const [miniBusy, setMiniBusy] = useState(false);
  const [miniProgress, setMiniProgress] = useState(0);
  const [miniStatus, setMiniStatus] = useState("Idle");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try { setText(localStorage.getItem("ocr_text") || ""); } catch {}
  }, []);

  // ===== Exports =====
  const saveTxt = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${randomName()}.txt`;
    a.click();
  };

  const saveDoc = () => {
    const header =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>";
    const footer = "</body></html>";
    const html = header + (text || "").replace(/\n/g, "<br>") + footer;
    const blob = new Blob([html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${randomName()}.docx`;
    a.click();
  };

  const savePdf = () => {
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(text || "", 180);
    doc.text(lines, 10, 10);
    doc.save(`${randomName()}.pdf`);
  };

  const saveCsv = () => {
    const lines = (text || "").split(/\r?\n/);
    const csv = lines.map((l) => `"${(l || "").replace(/"/g, '""')}"`).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ocr.csv";
    a.click();
  };

  const saveXlsx = async () => {
    const mod = await import("xlsx");
    const XLSX: any = (mod as any).default || mod;
    const rows = (text || "").split(/\r?\n/).map((l) => [l]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [[""]]);
    XLSX.utils.book_append_sheet(wb, ws, "OCR");
    XLSX.writeFile(wb, "ocr.xlsx");
  };

  const copyText = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text || "");
      } else {
        const ta = document.createElement("textarea");
        ta.value = text || "";
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  // ===== Re-upload PDF and OCR again (mini loader on the right) =====
  async function ocrPdf(file: File) {
    const pdfjs = await import("pdfjs-dist");
    try { (pdfjs as any).GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; } catch {}
    const Tesseract = (await import("tesseract.js")).default;

    const ab = await file.arrayBuffer();
    const pdf = await (pdfjs as any).getDocument({ data: ab, disableWorker: true }).promise;

    const total = pdf.numPages;
    let result = "";

    for (let i = 1; i <= total; i++) {
      setMiniStatus(`Rendering page ${i}/${total}…`);
      const page = await pdf.getPage(i);

      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1400 / base.width);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const { data } = await Tesseract.recognize(canvas as any, "eng", {
        logger: (m: any) => {
          if (typeof m?.progress === "number") {
            setMiniProgress(Math.round(((i - 1 + m.progress) / total) * 100));
            setMiniStatus(`Page ${i}/${total}: ${m.status || "processing"}`);
          }
        },
      });

      result += (result ? "\n\n" : "") + (data?.text || "");
      canvas.width = 0; canvas.height = 0;
      setMiniProgress(Math.round((i / total) * 100));
    }

    return result;
  }

  async function onReupload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    if (!(file.type === "application/pdf" || /\.pdf$/i.test(file.name))) {
      setMiniStatus("Wrong file uploaded. Please select a PDF.");
      setMiniBusy(false);
      setMiniProgress(0);
      return;
    }

    setMiniBusy(true);
    setMiniProgress(0);
    setMiniStatus("Starting…");
    try {
      const result = await ocrPdf(file);
      setText(result);
      try { localStorage.setItem("ocr_text", result); } catch {}
    } catch (e: any) {
      if (e?.message === "CANCELLED") setMiniStatus("Canceled");
      else {
        console.error(e);
        setMiniStatus("Wrong file uploaded. Please select a PDF.");
      }
    } finally {
      setMiniBusy(false);
      setTimeout(() => setMiniProgress(0), 300);
      controllerRef.current = null;
    }
  }

  return (
    <div className="space-y-6">
      <section className="hero">
        <h1 className="text-2xl font-semibold tracking-tight">PDF OCR Result</h1>
        <p className="mt-1 text-sm text-slate-400">Review and export the extracted text.</p>
      </section>

      <article className="card space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={saveTxt}>Download .txt</button>
          <button className="btn-secondary" onClick={saveDoc}>Download .docx</button>
          <button className="btn-secondary" onClick={saveCsv}>Download .csv</button>
          <button className="btn-secondary" onClick={saveXlsx}>Download .xlsx</button>
          <button className="btn-primary" onClick={copyText}>Copy</button>
          <button
            className="btn-secondary"
            onClick={() => setEditable((v) => !v)}
            title={editable ? "Finish editing" : "Enable editing"}
          >
            {editable ? "Done" : "Edit"}
          </button>

          <div className="ml-auto flex items-center gap-2">
            {miniBusy && (
              <div className="loading_area w-32">
                <div className="loading-bar">
                  <div className="progress-bar" style={{ width: `${miniProgress}%` }} />
                </div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf" // only PDF
              hidden
              onChange={(e) => {
                const el = e.currentTarget;
                onReupload(el.files).finally(() => (el.value = ""));
              }}
            />
            <button
              className="btn-secondary"
              onClick={() => fileRef.current?.click()}
              disabled={miniBusy}
              title={miniStatus}
            >
              {miniBusy ? "Re-uploading…" : "Re-upload PDF"}
            </button>
          </div>
        </div>

        <textarea
          id="pdf_ocr_text"
          className="min-h-[320px] w-full resize-none rounded-lg border border-slate-600 bg-slate-800 p-3 text-slate-100"
          value={text}
          onChange={(e) => setText(e.target.value)}
          readOnly={!editable}
          aria-readonly={!editable}
        />
      </article>
    </div>
  );
}