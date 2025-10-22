"use client";
import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { ocrImage } from "@/lib/ocr"; // <-- ADD THIS

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

export default function ImageToTextResultPage() {
  const [text, setText] = useState("");
  const [miniBusy, setMiniBusy] = useState(false);
  const [miniProgress, setMiniProgress] = useState(0);
  const [miniStatus, setMiniStatus] = useState("Idle");
  const [editable, setEditable] = useState(false); // NEW
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      setText(localStorage.getItem("ocr_text") || "");
    } catch {}
  }, []);

  const saveTxt = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${randomName()}.txt`; // random name
    a.click();
  };

  const saveDoc = () => {
    const header =
      "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>";
    const footer = "</body></html>";
    const blob = new Blob([header + (text || "").replace(/\n/g, "<br>") + footer], {
      type: "application/msword",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${randomName()}.docx`; // random name
    a.click();
  };

  const savePdf = () => {
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(text || "", 180);
    doc.text(lines, 10, 10);
    doc.save(`${randomName()}.pdf`); // random name
  };

  // Safe clipboard copy with fallback
  const copyText = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
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

  async function onReupload(files: FileList | null) {
    if (!files || !files.length) return;
    const file = files[0];

    if (!(file.type?.startsWith("image/"))) {
      setMiniStatus("Wrong file uploaded. Please select an image file.");
      setMiniBusy(false);
      setMiniProgress(0);
      return;
    }

    setMiniBusy(true);
    setMiniProgress(0);
    setMiniStatus("Starting…");
    try {
      const result = await ocrImage(file, (p: { status: string; progress?: number }) => {
        setMiniStatus(p.status);
        setMiniProgress(Math.round((p.progress || 0) * 100));
      });
      setText(result);
      try { localStorage.setItem("ocr_text", result); } catch {}
    } catch (e) {
      console.error(e);
      setMiniStatus("Wrong file uploaded. Please select an image file.");
    } finally {
      setMiniBusy(false);
      setTimeout(() => setMiniProgress(0), 300);
    }
  }

  return (
    <div className="space-y-6">
      <section className="hero">
        <h1 className="text-2xl font-semibold tracking-tight">Extracted text</h1>
        <p className="mt-1 text-sm text-slate-400">Review and export your OCR result.</p>
      </section>

      <article className="card space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={saveTxt}>
            Download .txt
          </button>
          <button className="btn-secondary" onClick={saveDoc}>
            Download .docx
          </button>
          <button className="btn-secondary" onClick={savePdf}>
            Download .pdf
          </button>
          <button className="btn-primary" onClick={copyText}>
            Copy
          </button>
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
            <button
              className="btn-secondary"
              onClick={() => fileRef.current?.click()}
              disabled={miniBusy}
              title={miniStatus}
            >
              {miniBusy ? "Re-uploading…" : "Re-upload"}
            </button>
          </div>
        </div>

        <textarea
          id="ocr_text"
          className="min-h-[320px] w-full resize-none rounded-lg border border-slate-600 bg-slate-800 p-3 text-slate-100"
          value={text}
          onChange={(e) => setText(e.target.value)}
          readOnly={!editable} // NEW
          aria-readonly={!editable}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const inputEl = e.currentTarget; // cache before async work
            const files = inputEl.files;
            onReupload(files).finally(() => {
              inputEl.value = ""; // safe reset
            });
          }}
        />
      </article>
    </div>
  );
}
