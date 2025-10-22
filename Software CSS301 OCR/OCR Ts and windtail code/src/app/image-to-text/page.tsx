"use client";
import { DragEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
// import { ocrImage } from "@/lib/ocr"; // if you use it

export default function ImageToTextPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState("Idle");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const cancelledRef = useRef(false); // NEW
  const router = useRouter();

  function isImage(f: File | undefined) {
    return !!f && (f.type.startsWith("image/") || /\.(png|jpe?g|gif|bmp|webp|tiff?)$/i.test(f.name));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const file = files[0];

    if (!isImage(file)) {
      setBusy(false);
      setShowProgress(false);
      setStatus("Wrong file uploaded. Please select an image file.");
      return;
    }

    setBusy(true);
    setShowProgress(true);
    cancelledRef.current = false;
    setStatus("Starting…");
    setProgress(0);

    try {
      const { ocrImage } = await import("@/lib/ocr");
      const ocrPromise = ocrImage(file, (p) => {
        if (cancelledRef.current) return;
        setStatus(p.status);
        setProgress(Math.round((p.progress || 0) * 100));
      });

      // Let cancel stop waiting immediately
      const CANCELLED = Symbol("CANCELLED");
      let cancelResolve: (v: any) => void = () => {};
      const cancelWait = new Promise((r) => (cancelResolve = r));

      const raced: any = await Promise.race([ocrPromise, cancelWait]);
      if (raced === CANCELLED) {
        setStatus("Canceled");
        setShowProgress(false);
        return;
      }

      try {
        localStorage.setItem("ocr_text", raced);
      } catch {}
      if (!cancelledRef.current) router.push("/image-to-text/result");
    } catch (e) {
      if (!cancelledRef.current) {
        console.error(e);
        setStatus("Error");
        setProgress(0);
        setShowProgress(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (busy) return;
    handleFiles(e.dataTransfer.files);
  }

  function cancelProcessing() {
    cancelledRef.current = true;
    setBusy(false);
    setShowProgress(false);
    setStatus("Canceled");
  }

  return (
    <div className="space-y-8">
      <section className="hero text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Image to Text</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-300">
          Extract text from images using Optical Character Recognition (OCR).
        </p>
      </section>

      <article className="card">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            handleFiles(f ? (Object.assign({ 0: f, length: 1 }, { item: () => f }) as any as FileList) : null);
          }}
        />
        <div
          className="dropzone"
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          role="button"
          aria-label="Upload image"
        >
          <p className="text-sm text-slate-400">Drag & drop an image, or click to select.</p>
          <button
            className="btn-primary"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            disabled={busy}
          >
            {busy ? "Processing…" : "Upload Image"}
          </button>
        </div>

        {showProgress && (
          <div className="loading_area mt-6 flex items-center gap-2" aria-live="polite">
            <div className="loading-bar">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="status">
              <div className="state">{status}</div>
              <div className="percentage">{progress}%</div>
            </div>
            <button
              type="button"
              className="ml-2 h-6 w-6 rounded border border-slate-600 text-slate-300 hover:bg-slate-700"
              aria-label="Cancel"
              onClick={cancelProcessing}
              title="Cancel"
            >
              ×
            </button>
          </div>
        )}
      </article>
    </div>
  );
}