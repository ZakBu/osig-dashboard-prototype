"use client";

/**
 * Клиентская генерация превью первого слайда PDF (pdfjs → canvas → PNG).
 * pdfjs подгружается ЛЕНИВО (dynamic import) внутри функции: модуль трогает браузерные
 * глобалы (DOMMatrix и т.п.) на этапе загрузки и упал бы при SSR.
 */
import { asset } from "./bp";

let configured = false;

/** Рендерит первую страницу PDF в PNG-Blob шириной ~maxW. null — если не удалось. */
export async function renderFirstPageThumb(file: File | ArrayBuffer, maxW = 480): Promise<Blob | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    if (!configured) {
      // Воркер положен в public/ при сборке (bundler-agnostic путь через basePath).
      pdfjsLib.GlobalWorkerOptions.workerSrc = asset("/pdf.worker.min.mjs");
      configured = true;
    }
    const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxW / base.width, 2);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  } catch {
    return null;
  }
}
