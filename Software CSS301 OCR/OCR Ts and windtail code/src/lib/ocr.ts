import Tesseract from "tesseract.js";

export type OCRProgress = { status: string; progress: number };

export async function ocrImage(file: Blob, onProgress?: (p: OCRProgress) => void) {
  const { data } = await Tesseract.recognize(file, "eng", {
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@4.0.2/tesseract-core.wasm.js",
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
    logger: (m) => {
      if (m && typeof m.progress === "number") {
        onProgress?.({ status: m.status || "processing", progress: m.progress });
      }
    },
  });
  return data.text || "";
}