"use client";
import { useRef, useState, DragEvent } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState("Idle");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const abortRef = useRef<AbortController | null>(null); // NEW
  const router = useRouter();

  async function ocrImageLike(
    img: Blob | HTMLCanvasElement,
    onStep?: (p: number, s: string) => void,
    signal?: AbortSignal
  ) {
    const Tesseract = (await import("tesseract.js")).default;

    const task = Tesseract.recognize(img as any, "eng", {
      logger: (m: any) => {
        if (typeof m?.progress === "number") onStep?.(m.progress, m.status || "processing");
      },
    });

    if (signal) {
      const cancelled = new Promise<"__CANCELLED__">((resolve) => {
        if (signal.aborted) resolve("__CANCELLED__");
        else signal.addEventListener("abort", () => resolve("__CANCELLED__"), { once: true });
      });
      const res: any = await Promise.race([task, cancelled]);
      if (res === "__CANCELLED__") throw new Error("CANCELLED");
      return res.data.text as string;
    }

    const { data } = await task;
    return data.text as string;
  }

  async function ocrPdf(file: File) {
    const signal = abortRef.current?.signal;
    const pdfjs = await import("pdfjs-dist"); // ESM build
    try {
      (pdfjs as any).GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    } catch {}

    const ab = await file.arrayBuffer();
    const pdf = await (pdfjs as any).getDocument({ data: ab, disableWorker: true }).promise;

    const total = pdf.numPages;
    let result = "";

    for (let i = 1; i <= total; i++) {
      if (signal?.aborted) throw new Error("CANCELLED");
      setStatus(`Rendering page ${i}/${total}…`);
      const page = await pdf.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1400 / base.width);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const pageText = await ocrImageLike(
        canvas,
        (p, s) => {
          setStatus(`Page ${i}/${total}: ${s}`);
          setProgress(Math.round(((i - 1 + p) / total) * 100));
        },
        signal
      );

      result += (result ? "\n\n" : "") + pageText;
      canvas.width = 0;
      canvas.height = 0;
      setProgress(Math.round((i / total) * 100));
    }

    return result;
  }

  function isPdf(f: File | undefined) {
    return !!f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  }
  function isImage(f: File | undefined) {
    return !!f && (f.type.startsWith("image/") || /\.(png|jpe?g|gif|bmp|webp|tiff?)$/i.test(f.name));
  }

  async function ocrFile(file: File) {
    if (!isPdf(file) && !isImage(file)) {
      setStatus("Wrong file uploaded. Please upload a PDF or image.");
      setShowProgress(false);
      setBusy(false);
      return;
    }

    setBusy(true);
    setShowProgress(true);
    setStatus("Starting…");
    setProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const isPdfType = isPdf(file);
      const text = isPdfType
        ? await ocrPdf(file)
        : await ocrImageLike(file, (p, s) => { setStatus(s); setProgress(Math.round(p * 100)); }, controller.signal);

      try {
        localStorage.setItem("ocr_text", text);
      } catch {}
      router.push(isPdfType ? "/pdf-ocr/result" : "/image-to-text/result");
    } catch (e: any) {
      if (e?.message === "CANCELLED") {
        setStatus("Canceled");
      } else {
        console.error(e);
        setStatus(isPdf(file) ? "Wrong file uploaded. Please upload a valid PDF." : "Wrong file uploaded. Please upload a valid image.");
      }
      setShowProgress(false);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (busy) return;
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!isPdf(f)) {
      setStatus("Wrong file uploaded. Please upload a PDF.");
      setShowProgress(false);
      setBusy(false);
      return;
    }
    ocrFile(f);
  }

  function cancelProcessing() {
    abortRef.current?.abort();
    setBusy(false);
    setShowProgress(false);
    setStatus("Canceled");
  }

  return (
    <div className="space-y-8">
      <section className="hero text-center">
        <h1 className="text-3xl font-semibold tracking-tight">OCR PDF Reader</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-300">
          Upload a PDF and extract the text with OCR.
        </p>
      </section>

      <article className="card">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf" // only PDF
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            if (!f) return;
            if (!isPdf(f)) {
              setStatus("Wrong file uploaded. Please upload a PDF.");
              setShowProgress(false);
              setBusy(false);
              return;
            }
            ocrFile(f);
          }}
        />
        <div
          className="dropzone"
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          role="button"
          aria-label="Upload PDF"
        >
          <p className="text-sm text-slate-400">Drag & drop a PDF, or click to select.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            disabled={busy}
          >
            {busy ? "Processing…" : "Upload PDF"}
          </button>
        </div>

        {showProgress && (
          <div className="loading_area mt-6" aria-live="polite">
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
              onClick={() => {
                cancelProcessing();
              }}
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
