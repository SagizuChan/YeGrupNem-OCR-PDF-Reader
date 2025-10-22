import * as pdfjsLib from "pdfjs-dist";
import { jsPDF } from "jspdf";

export type CompressLevel = "low" | "medium" | "high";
export type CompressProgress = { status: string; progress: number };

const PRESETS: Record<CompressLevel, { maxWidth: number; quality: number }> = {
  low: { maxWidth: 900, quality: 0.6 },
  medium: { maxWidth: 1400, quality: 0.75 },
  high: { maxWidth: 2000, quality: 0.9 },
};

export async function compressPdf(
  file: File,
  level: CompressLevel = "medium",
  onProgress?: (p: CompressProgress) => void
): Promise<Blob> {
  // Lazy imports to avoid SSR DOM usage
  const pdfjsLib = await import("pdfjs-dist");
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; // local worker
  const { jsPDF } = await import("jspdf");

  const preset = PRESETS[level] || PRESETS.medium;
  const buffer = await file.arrayBuffer();

  // No worker (avoids workerSrc/DOM issues in Next.js)
  const pdf = await (pdfjsLib as any).getDocument({ data: buffer, disableWorker: true }).promise;
  onProgress?.({ status: "Loading PDF…", progress: 5 });

  const total: number = pdf.numPages;
  let out: any;

  for (let i = 1; i <= total; i++) {
    onProgress?.({
      status: `Rendering page ${i}/${total}…`,
      progress: Math.round(((i - 1) / total) * 90) + 5,
    });

    const page = await pdf.getPage(i);

    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1, preset.maxWidth / base.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    // px@96dpi -> pt
    const wPt = canvas.width * 0.75;
    const hPt = canvas.height * 0.75;

    if (!out) {
      out = new jsPDF({
        orientation: wPt >= hPt ? "l" : "p",
        unit: "pt",
        format: [wPt, hPt],
        compress: true,
      });
    } else {
      out.addPage([wPt, hPt], wPt >= hPt ? "l" : "p");
    }

    const dataUrl = canvas.toDataURL("image/jpeg", preset.quality);
    out.addImage(dataUrl, "JPEG", 0, 0, wPt, hPt, undefined, "FAST");
  }

  onProgress?.({ status: "Finalizing…", progress: 98 });
  const blob: Blob = out.output("blob");
  onProgress?.({ status: "Done", progress: 100 });
  return blob;
}

export async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}