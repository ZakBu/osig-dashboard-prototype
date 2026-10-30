"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { asset } from "@/lib/bp";
import { reportFileUrl, type ReportMeta } from "@/lib/reports";

/**
 * Полоса превью ВСЕХ слайдов выбранного доклада (вместо списка документов).
 * Рендерит страницы PDF в миниатюры прогрессивно (каждая появляется с каскадной
 * анимацией по мере готовности). Клик по слайду листает просмотрщик; текущий
 * слайд подсвечен и автопрокручивается в зону видимости.
 */
export function SlidesStrip({
  report, page, onPick,
}: {
  report: ReportMeta;
  page: number;
  onPick: (p: number) => void;
}) {
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let dead = false;
    setThumbs([]);
    setTotal(0);
    setDone(false);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = asset("/pdf.worker.min.mjs");
        const doc = await pdfjs.getDocument({ url: reportFileUrl(report.id) }).promise;
        if (dead) { void (doc as { destroy?: () => void }).destroy?.(); return; }
        setTotal(doc.numPages);
        for (let i = 1; i <= doc.numPages; i++) {
          if (dead) break;
          const pg = await doc.getPage(i);
          const base = pg.getViewport({ scale: 1 });
          const scale = Math.min(320 / base.width, 2);
          const vp = pg.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(vp.width);
          canvas.height = Math.ceil(vp.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await pg.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
          if (dead) break;
          const url = canvas.toDataURL("image/png");
          setThumbs((prev) => [...prev, url]);
        }
        void (doc as { destroy?: () => void }).destroy?.();
        if (!dead) setDone(true);
      } catch {
        if (!dead) setDone(true);
      }
    })();
    return () => { dead = true; };
  }, [report.id]);

  // Автопрокрутка к активному слайду при листании в просмотрщике.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [page, thumbs.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
      {thumbs.map((src, i) => {
        const n = i + 1;
        const active = n === page;
        return (
          <button
            key={n}
            ref={active ? activeRef : undefined}
            type="button"
            onClick={() => onPick(n)}
            style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
            className={`reveal group relative block shrink-0 overflow-hidden rounded-lg border p-1 transition-colors ${
              active ? "border-sky-500 ring-1 ring-sky-500 bg-sky-500/10" : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Слайд ${n}`} className="block w-full rounded-md" />
            <span className="absolute left-2 top-2 min-w-[20px] rounded-md bg-black/65 px-1.5 py-0.5 text-center text-[14px] font-semibold text-white tabular-nums">
              {n}
            </span>
          </button>
        );
      })}
      {!done && (
        <div className="flex shrink-0 items-center justify-center gap-2 py-2 text-[16px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {total ? `${thumbs.length}/${total} слайдов` : "Готовим слайды…"}
        </div>
      )}
    </div>
  );
}
