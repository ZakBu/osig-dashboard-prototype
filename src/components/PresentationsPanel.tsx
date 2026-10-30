"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, Trash2, Loader2, FileText, X, ArrowLeft } from "lucide-react";
import {
  fetchReports, uploadReport, deleteReport, reportThumbUrl, type ReportMeta,
} from "@/lib/reports";
import { renderFirstPageThumb } from "@/lib/pdfThumb";
import { SingleDatePicker } from "./SingleDatePicker";
import { SlidesStrip } from "./SlidesStrip";
import { Panel } from "./ui";

const todayISO = () => {
  const d = new Date(); // локальная дата (не UTC)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
};

/**
 * Список PDF-докладов (превью первого слайда, дата — разделителем группы).
 * Загрузка: выбор файла → диалог, где пользователь задаёт дату загрузки и может
 * переименовать доклад (решает задачу архивных презентаций).
 */
export function PresentationsPanel({
  selected, page, onSelect, onPickPage, onBackToList,
}: {
  /** Выбранный доклад — если задан, вместо списка показываем превью слайдов. */
  selected: ReportMeta | null;
  /** Текущая страница просмотрщика (для подсветки активного слайда). */
  page: number;
  onSelect: (r: ReportMeta | null) => void;
  onPickPage: (p: number) => void;
  onBackToList: () => void;
}) {
  const [items, setItems] = useState<ReportMeta[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Фильтр списка по дате доклада ("" = все даты).
  const [filterDate, setFilterDate] = useState("");

  // Диалог загрузки: выбранный файл + редактируемые название и дата.
  const [pending, setPending] = useState<File | null>(null);
  const [dlgTitle, setDlgTitle] = useState("");
  const [dlgDate, setDlgDate] = useState(todayISO());

  const load = async () => {
    try {
      setItems(await fetchReports());
    } catch (e) {
      setErr((e as Error).message);
      setItems([]);
    }
  };
  useEffect(() => { void load(); }, []);

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") { setErr("Только PDF"); return; }
    setErr(null);
    setDlgTitle(f.name.replace(/\.pdf$/i, ""));
    setDlgDate(todayISO());
    setPending(f); // открывает диалог
  };

  const confirmUpload = async () => {
    if (!pending) return;
    setBusy(true);
    setErr(null);
    try {
      const buf = await pending.arrayBuffer();
      const thumb = await renderFirstPageThumb(buf.slice(0)); // копия: pdfjs забирает буфер
      const fd = new FormData();
      fd.append("file", new File([buf], pending.name, { type: "application/pdf" }));
      fd.append("date", dlgDate);
      fd.append("title", dlgTitle.trim() || pending.name.replace(/\.pdf$/i, ""));
      if (thumb) fd.append("thumb", new File([thumb], "thumb.png", { type: "image/png" }));
      const rep = await uploadReport(fd);
      setPending(null);
      await load();
      onSelect(rep);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Удалить доклад безвозвратно?")) return;
    try {
      await deleteReport(id);
      if (selected?.id === id) onSelect(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  // Список с учётом фильтра по дате (items уже отсортированы по дате).
  const shown = items ? (filterDate ? items.filter((it) => it.date === filterDate) : items) : [];
  // Даты, на которые есть материалы (для синих точек в датапикере).
  const markedDates = useMemo(() => new Set((items ?? []).map((it) => it.date)), [items]);

  // Режим «слайды»: доклад выбран — вместо списка показываем превью всех слайдов.
  if (selected) {
    return (
      <Panel className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col gap-2">
        <div key={selected.id} className="reveal flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onBackToList}
              className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-input bg-background pr-2.5 pl-1.5 text-[17px] font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              <ArrowLeft className="size-4" /> К списку
            </button>
            <span className="min-w-0 truncate text-[17px] font-medium text-foreground" title={selected.title}>
              {selected.title}
            </span>
          </div>
          <SlidesStrip report={selected} page={page} onPick={onPickPage} />
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col gap-3">
      <div key="list" className="reveal flex min-h-0 flex-1 flex-col gap-3">
      {/* Загрузка + фильтр по дате (иконка). Заголовок не дублируем — режим задаёт вкладка. */}
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Upload className="size-4" /> Загрузить PDF
          </button>
          <SingleDatePicker iconOnly value={filterDate} onChange={setFilterDate} markedDates={markedDates} onClear={() => setFilterDate("")} />
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={onFilePick} />
        {err && <p className="text-[16px] text-rose-400">{err}</p>}
      </div>

      {/* Список докладов (с учётом фильтра по дате) */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items === null ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Загрузка…
          </div>
        ) : shown.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <FileText className="size-8 opacity-30" />
            <p className="text-sm">{filterDate ? "Нет докладов на эту дату" : "Нет загруженных докладов"}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {shown.map((it, i) => {
              const showSep = i === 0 || shown[i - 1].date !== it.date;
              return (
                <Fragment key={it.id}>
                  {showSep && (
                    <div className={`flex items-center gap-2 px-0.5 ${i === 0 ? "" : "mt-1"}`}>
                      <span className="shrink-0 text-[16px] font-medium text-muted-foreground tabular-nums">{fmtDate(it.date)}</span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelect(it)}
                    className="group relative w-full overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-sky-500/60 hover:bg-muted/40"
                  >
                    <div className="flex h-24 items-center justify-center overflow-hidden bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={reportThumbUrl(it.id)}
                        alt=""
                        className="size-full object-cover"
                        onError={(e) => { (e.currentTarget.style.display = "none"); }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                      <span className="min-w-0 truncate text-[17px] font-medium text-foreground" title={it.title}>{it.title}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Удалить"
                        onClick={(e) => { e.stopPropagation(); void remove(it.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); void remove(it.id); } }}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-rose-500/15 hover:text-rose-400 group-hover:opacity-100"
                      >
                        <Trash2 className="size-4" />
                      </span>
                    </div>
                  </button>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* Диалог загрузки: название + дата */}
      {pending && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onMouseDown={() => !busy && setPending(null)}>
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-[21px] text-foreground">Загрузка доклада</h3>
                <button type="button" onClick={() => !busy && setPending(null)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
              <label className="mb-1.5 block text-[17px] font-medium text-muted-foreground">Название</label>
              <input
                type="text"
                value={dlgTitle}
                onChange={(e) => setDlgTitle(e.target.value)}
                placeholder="Название доклада"
                className="mb-3 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-sky-500"
              />
              <label className="mb-1.5 block text-[17px] font-medium text-muted-foreground">Дата загрузки</label>
              <SingleDatePicker value={dlgDate} onChange={setDlgDate} className="mb-1.5" />
              <p className="mb-4 truncate text-[16px] text-muted-foreground" title={pending.name}>Файл: {pending.name}</p>
              {err && <p className="mb-3 text-[16px] text-rose-400">{err}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={() => setPending(null)} className="h-9 rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50">
                  Отмена
                </button>
                <button type="button" disabled={busy} onClick={() => void confirmUpload()} className="flex h-9 items-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {busy ? "Загрузка…" : "Загрузить"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </Panel>
  );
}
