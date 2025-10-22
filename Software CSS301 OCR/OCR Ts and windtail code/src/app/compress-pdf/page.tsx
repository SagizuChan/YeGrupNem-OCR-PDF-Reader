"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CompressLevel = "low" | "medium" | "high";

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function CompressPdfPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<CompressLevel>("medium");
  const router = useRouter();
  const [err, setErr] = useState(""); // keep error message

  function isPdf(f: File | null) {
    return !!f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  }

  async function goResult() {
    if (!file) return;
    const dataUrl = await fileToDataURL(file);

    // Fake “compressed” size based on selected quality
    const factors: Record<CompressLevel, number> = { low: 0.5, medium: 0.7, high: 0.85 };
    const factor = factors[level] ?? 0.7;
    const newSize = Math.min(file.size - 1, Math.max(1, Math.floor(file.size * factor)));

    sessionStorage.setItem("compressed_pdf_dataurl", dataUrl);
    sessionStorage.setItem(
      "compressed_pdf_meta",
      JSON.stringify({
        originalSize: file.size,
        newSize,
        name: file.name,
        level,
        ts: Date.now(),
      })
    );

    router.push("/compress-pdf/result");
  }

  return (
    <div className="space-y-6">
      <section className="hero">
        <h1 className="text-2xl font-semibold tracking-tight">Compress PDF</h1>
        <p className="mt-2 text-sm text-slate-400">Choose quality and compress your PDF.</p>
      </section>

      <article className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" type="button" onClick={() => fileRef.current?.click()}>
            Select PDF
          </button>

          <select
            className="select"
            value={level}
            onChange={(e) => setLevel(e.target.value as CompressLevel)}
            aria-label="Compression quality"
            disabled={!file}
          >
            <option value="low">Low (smallest)</option>
            <option value="medium">Medium</option>
            <option value="high">High (best quality)</option>
          </select>

          <button className="btn-secondary" type="button" onClick={goResult} disabled={!file}>
            Compress
          </button>

          <span className="text-sm text-slate-400">
            {file ? `Selected: ${file.name}` : ""}
          </span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf" // only PDF
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            e.currentTarget.value = "";
            if (f && !isPdf(f)) {
              setErr("Wrong file uploaded. Please select a PDF.");
              setFile(null);
              return;
            }
            setErr("");
            setFile(f);
          }}
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
      </article>
    </div>
  );
}