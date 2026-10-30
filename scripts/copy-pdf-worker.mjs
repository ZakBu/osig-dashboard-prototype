// Копирует воркер pdfjs в public/ (нужен для клиентской генерации превью первого слайда).
// Запускается автоматически перед dev/build (predev/prebuild), версия всегда совпадает с pdfjs-dist.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const dstDir = join(root, "public");
const dst = join(dstDir, "pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.warn("[copy-pdf-worker] pdfjs-dist не найден — пропускаю (запустите npm install)");
  process.exit(0);
}
if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true });
copyFileSync(src, dst);
console.log("[copy-pdf-worker] public/pdf.worker.min.mjs обновлён");
