"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2, ArrowLeft, Maximize2, Minimize2,
  MoveHorizontal, MoveVertical, Check, ChevronDown,
} from "lucide-react";
import { asset } from "@/lib/bp";
import { reportFileUrl, type ReportMeta } from "@/lib/reports";

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
};

const ctl =
  "flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted/60 disabled:opacity-30 disabled:hover:bg-transparent";

// Режим вписывания слайда в область просмотра (по умолчанию — по высоте).
type FitMode = "width" | "height";
const FIT_KEY = "azs-pdf-fit";
const FIT_MODES: { key: FitMode; label: string; Icon: typeof MoveHorizontal }[] = [
  { key: "width", label: "По ширине", Icon: MoveHorizontal },
  { key: "height", label: "По высоте", Icon: MoveVertical },
];

/**
 * Собственный PDF-просмотрщик на pdfjs — вместо встроенного вьювера браузера, чтобы
 * панель управления была в цветах дизайн-системы (единый тёмный тулбар). Постранично:
 * fit-to-width + зум, навигация ‹/›, скачивание. pdfjs грузится лениво (SSR-safe).
 */
export function PdfViewer({
  report, onBack, page, onPage,
}: {
  report: ReportMeta;
  onBack: () => void;
  /** Текущая страница (управляется снаружи — синхрон с полосой слайдов). */
  page: number;
  onPage: (p: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskRef = useRef<any>(null);
  const seqRef = useRef(0);

  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [fullscreen, setFullscreen] = useState(false);
  // Режим вписывания (по умолчанию — по высоте); восстанавливаем из localStorage.
  const [fitMode, setFitMode] = useState<FitMode>("height");
  const [fitMenu, setFitMenu] = useState(false);
  const fitRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem(FIT_KEY);
      if (v === "width" || v === "height") setFitMode(v);
    } catch { /* noop */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(FIT_KEY, fitMode); } catch { /* noop */ }
  }, [fitMode]);
  // Закрытие меню режима по клику вне него.
  useEffect(() => {
    if (!fitMenu) return;
    const onDown = (e: MouseEvent) => { if (fitRef.current && !fitRef.current.contains(e.target as Node)) setFitMenu(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [fitMenu]);

  // Загрузка документа (сброс при смене доклада).
  useEffect(() => {
    let dead = false;
    setStatus("loading");
    setZoom(1);
    setNumPages(0);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = asset("/pdf.worker.min.mjs");
        const doc = await pdfjs.getDocument({ url: reportFileUrl(report.id) }).promise;
        if (dead) { void (doc as { destroy?: () => void }).destroy?.(); return; }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setStatus("ready");
      } catch {
        if (!dead) setStatus("error");
      }
    })();
    return () => {
      dead = true;
      try { taskRef.current?.cancel(); } catch { /* noop */ }
      void docRef.current?.destroy?.();
      docRef.current = null;
    };
  }, [report.id]);

  // Рендер текущей страницы × zoom. Масштаб по режиму вписывания:
  //  width — по ширине (может уйти в верт. скролл), height — по высоте.
  const renderPage = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!doc || !canvas || !box) return;
    const mySeq = ++seqRef.current;
    try { taskRef.current?.cancel(); } catch { /* noop */ }
    const pg = await doc.getPage(page);
    if (mySeq !== seqRef.current) return; // вызов устарел — не рисуем
    const dpr = window.devicePixelRatio || 1;
    const availW = Math.max(120, box.clientWidth - 16);   // минус p-2
    const availH = Math.max(120, box.clientHeight - 16);
    const base = pg.getViewport({ scale: 1 });
    const fit = fitMode === "width" ? availW / base.width : availH / base.height;
    const cssScale = fit * zoom;
    const vp = pg.getViewport({ scale: cssScale * dpr });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
    canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const task = pg.render({ canvas, canvasContext: ctx, viewport: vp });
    taskRef.current = task;
    try { await task.promise; } catch { /* отменён при смене страницы */ }
  }, [page, zoom, fitMode]);

  useEffect(() => { if (status === "ready") void renderPage(); }, [status, renderPage]);

  // Перерисовка при РЕАЛЬНОМ изменении размера области (адаптив, по ширине и высоте).
  // Порог + guard: канвас не влияет на измеряемый размер (иначе — петля роста).
  const lastSizeRef = useRef({ w: 0, h: 0 });
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => {
      const w = box.clientWidth, h = box.clientHeight;
      if (Math.abs(w - lastSizeRef.current.w) < 2 && Math.abs(h - lastSizeRef.current.h) < 2) return;
      lastSizeRef.current = { w, h };
      if (status === "ready") void renderPage();
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [status, renderPage, fullscreen]);

  const go = (d: number) => onPage(Math.min(numPages, Math.max(1, page + d)));

  // Клавиатура: ←/↑ и →/↓ (и PageUp/Down) — страницы; Esc — выход из полноэкранного.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return; // не мешаем вводу
      if (["ArrowRight", "ArrowDown", "PageDown"].includes(e.key)) { e.preventDefault(); onPage(Math.min(numPages, page + 1)); }
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); onPage(Math.max(1, page - 1)); }
      else if (e.key === "Escape" && fullscreen) { setFullscreen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [numPages, fullscreen, page, onPage]);

  // Перерисовка при входе/выходе из полноэкранного режима (ширина области меняется).
  useEffect(() => {
    if (status !== "ready") return;
    const id = requestAnimationFrame(() => void renderPage());
    return () => cancelAnimationFrame(id);
  }, [fullscreen, status, renderPage]);

  const view = (
    // В полноэкранном режиме — портал в body: fixed вырывается из трансформов FitCanvas/reveal
    // и заполняет весь фрейм (левый список скрыт под оверлеем).
    <div className={fullscreen ? "fixed inset-0 z-[100] flex flex-col bg-background" : "flex min-h-0 min-w-0 flex-1 flex-col"}>
      {/* Единый тёмный тулбар (панель управления) в цветах дизайн-системы */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-border border-b bg-card px-2.5">
        {/* «К списку» в тулбаре — только в полноэкранном режиме (слева панель скрыта);
            в обычном режиме кнопка есть в панели слайдов. */}
        {fullscreen && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-input bg-background pr-2.5 pl-1.5 text-[17px] font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            <ArrowLeft className="size-4" /> К списку
          </button>
        )}
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="truncate text-[18px] font-medium text-foreground" title={report.title}>{report.title}</span>
          <span className="shrink-0 text-[16px] text-muted-foreground tabular-nums">{fmtDate(report.date)}</span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button type="button" className={ctl} onClick={() => go(-1)} disabled={page <= 1} aria-label="Предыдущая">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[52px] text-center text-[17px] text-foreground tabular-nums">
            {numPages ? `${page} / ${numPages}` : "—"}
          </span>
          <button type="button" className={ctl} onClick={() => go(1)} disabled={page >= numPages} aria-label="Следующая">
            <ChevronRight className="size-4" />
          </button>

          <span className="mx-1 h-5 w-px bg-border" />

          <button type="button" className={ctl} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} disabled={zoom <= 0.5} aria-label="Уменьшить">
            <ZoomOut className="size-4" />
          </button>
          <span className="min-w-[42px] text-center text-[17px] text-foreground tabular-nums">{Math.round(zoom * 100)}%</span>
          <button type="button" className={ctl} onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} disabled={zoom >= 3} aria-label="Увеличить">
            <ZoomIn className="size-4" />
          </button>

          <span className="mx-1 h-5 w-px bg-border" />

          {/* Режим вписывания: по ширине / по высоте / вся страница */}
          <div className="relative" ref={fitRef}>
            <button
              type="button"
              onClick={() => setFitMenu((o) => !o)}
              className="flex h-8 shrink-0 items-center gap-1 rounded-md px-1.5 text-foreground transition-colors hover:bg-muted/60"
              aria-label="Вписать страницу"
              title="Режим вписывания страницы"
            >
              {(() => { const M = FIT_MODES.find((m) => m.key === fitMode)!; return <M.Icon className="size-4" />; })()}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
            {fitMenu && (
              <div className="absolute right-0 top-full z-[130] mt-1 min-w-[176px] rounded-lg border border-border bg-popover p-1 shadow-xl">
                {FIT_MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => { setFitMode(m.key); setFitMenu(false); }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[17px] text-foreground transition-colors hover:bg-muted/60"
                  >
                    <Check className={`size-4 shrink-0 text-sky-500 ${fitMode === m.key ? "opacity-100" : "opacity-0"}`} />
                    <m.Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="whitespace-nowrap">{m.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="mx-1 h-5 w-px bg-border" />

          <a href={reportFileUrl(report.id)} download={`${report.title}.pdf`} className={ctl} aria-label="Скачать">
            <Download className="size-4" />
          </a>
          <button
            type="button"
            className={ctl}
            onClick={() => setFullscreen((f) => !f)}
            aria-label={fullscreen ? "Свернуть" : "На весь экран"}
            title={fullscreen ? "Свернуть (Esc)" : "На весь экран"}
          >
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      {/* Область страницы. min-w/h-0 + overflow-auto: канвас не влияет на размер контейнера. */}
      <div ref={boxRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-muted/20 p-2">
        {status === "loading" && (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Загрузка PDF…
          </div>
        )}
        {status === "error" && (
          <div className="flex h-full items-center justify-center text-sm text-rose-400">Не удалось открыть документ</div>
        )}
        {/* По высоте — строго по центру (слайд уже вписан по высоте). По ширине —
            прижим к верху, чтобы верт. прокрутка не обрезала верхнюю часть. */}
        <div
          className={`flex min-h-full min-w-full justify-center ${status === "ready" ? "" : "hidden"} ${
            fitMode === "width" ? "items-start" : "items-center"
          }`}
        >
          <canvas ref={canvasRef} className="block h-fit rounded-sm shadow-lg" />
        </div>
      </div>
    </div>
  );

  return fullscreen && typeof document !== "undefined"
    ? createPortal(view, document.body)
    : view;
}
