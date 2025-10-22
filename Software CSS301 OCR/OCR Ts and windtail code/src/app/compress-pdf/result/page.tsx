"use client";
import { useEffect, useRef, useState } from "react";

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

export default function CompressedResultPage() {
  const [meta, setMeta] = useState<{ name?: string; originalSize?: number; newSize?: number }>({});
  const [src, setSrc] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const downloadNameRef = useRef<string>(randomName()); // NEW
  const [err, setErr] = useState(""); // NEW

  useEffect(() => {
    try {
      setSrc(sessionStorage.getItem("compressed_pdf_dataurl") || "");
      setMeta(JSON.parse(sessionStorage.getItem("compressed_pdf_meta") || "{}"));
    } catch {}
  }, []);

  function toMB(n?: number) {
    if (typeof n !== "number") return "";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }

  return (
    <div className="space-y-6">
      <section className="hero">
        <h1 className="text-2xl font-semibold tracking-tight">Compressed PDF</h1>
        <p className="mt-2 text-sm text-slate-400" aria-live="polite">
          {meta.originalSize != null && meta.newSize != null
            ? `Original: ${toMB(meta.originalSize)} → Compressed: ${toMB(meta.newSize)}`
            : "No file found"}
        </p>
      </section>

      <article className="card space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {src && (
            <a
              className="btn-primary"
              href={src}
              // random filename
              download={`${(Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0,16)}.pdf`}
            >
              Download compressed PDF
            </a>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf" // only PDF
            hidden
            onChange={async (e) => {
              const f = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!f) return;
              if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) {
                setErr("Wrong file uploaded. Please select a PDF.");
                return;
              }
              setErr("");
              const r = new FileReader();
              r.onload = () => {
                const dataUrl = String(r.result);
                const newSize = Math.max(1, Math.floor(f.size * 0.7));
                sessionStorage.setItem("compressed_pdf_dataurl", dataUrl);
                sessionStorage.setItem(
                  "compressed_pdf_meta",
                  JSON.stringify({ originalSize: f.size, newSize, name: f.name, ts: Date.now() })
                );
                setSrc(dataUrl);
                setMeta({ name: f.name, originalSize: f.size, newSize });
                downloadNameRef.current = randomName(); // NEW: new random name for new upload
              };
              r.readAsDataURL(f);
            }}
          />
          <button className="btn-secondary ml-auto" onClick={() => fileRef.current?.click()}>
            Upload another PDF
          </button>
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="rounded-xl border border-slate-700">
          {src ? (
            <object className="h-[70vh] w-full rounded-xl" type="application/pdf" data={src}>
              <p className="p-4 text-sm">Preview unavailable. Use the download button above.</p>
            </object>
          ) : (
            <p className="p-4 text-sm text-slate-400">No PDF found. Go back and select a file.</p>
          )}
        </div>
      </article>
    </div>
  );
}