"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return { y, m: m - 1, d }; };
const fmt = (s: string) => { const { y, m, d } = parse(s); return `${pad(d)}.${pad(m + 1)}.${y}`; };
const todayISO = () => { const d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); };
const monthOf = (v: string) => { if (v) { const p = parse(v); return { y: p.y, m: p.m }; } const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; };

const POP_W = 268;
const POP_H = 340;

/**
 * Тематический одиночный датапикер. Поповер-календарь порталится в body (поверх всех
 * окон, не обрезается узкими панелями). markedDates — дни с материалами (синяя точка).
 * iconOnly — компактная кнопка-иконка (для шапки). onClear — режим фильтра («Все даты»).
 */
export function SingleDatePicker({
  value, onChange, className, placeholder, iconOnly, markedDates, onClear, min, max, clearLabel, active, iconRounded, iconHotClassName,
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
  iconOnly?: boolean;
  markedDates?: Set<string>;
  onClear?: () => void;
  /** Границы выбора: дни вне [min, max] гасятся (не кликабельны). */
  min?: string;
  max?: string;
  /** Подпись кнопки-сброса внизу (по умолч. «Все даты»/«Сегодня»). */
  clearLabel?: string;
  /** Подсветка триггера-иконки. Если не задано — по наличию value. */
  active?: boolean;
  /** Радиус триггера-иконки (по умолч. rounded-lg). */
  iconRounded?: string;
  /** Классы активного состояния триггера-иконки (по умолч. голубая подсветка). */
  iconHotClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(() => monthOf(value));

  useEffect(() => { if (value) setView(monthOf(value)); }, [value]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current && !popRef.current.contains(t) && !triggerRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      let left = Math.min(r.left, window.innerWidth - POP_W - 8);
      left = Math.max(8, left);
      let top = r.bottom + 6;
      if (top + POP_H > window.innerHeight) top = Math.max(8, r.top - POP_H - 6);
      setPos({ top, left });
    }
    setView(monthOf(value));
    setOpen(true);
  };

  const cells = useMemo(() => {
    const startWd = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
    const dim = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    const arr: (string | null)[] = Array(startWd).fill(null);
    for (let d = 1; d <= dim; d++) arr.push(ymd(view.y, view.m, d));
    return arr;
  }, [view]);

  const hasMaterials = (markedDates?.size ?? 0) > 0;
  const disabled = (day: string) => (!!min && day < min) || (!!max && day > max);
  const hot = active !== undefined ? active : !!value;

  const trigger = iconOnly ? (
    <button
      ref={triggerRef}
      type="button"
      onClick={toggle}
      title="Фильтр по дате"
      aria-label="Фильтр по дате"
      className={`relative flex size-9 shrink-0 items-center justify-center border transition-colors ${iconRounded ?? "rounded-lg"} ${
        hot
          ? (iconHotClassName ?? "border-sky-500 bg-sky-500/15 text-sky-400")
          : "border-input bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      }`}
    >
      <CalendarDays className="size-4" />
      {hasMaterials && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-sky-400 ring-2 ring-card" />}
    </button>
  ) : (
    <button
      ref={triggerRef}
      type="button"
      onClick={toggle}
      className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted/40"
    >
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
      <span className={value ? "tabular-nums" : "text-muted-foreground"}>{value ? fmt(value) : (placeholder ?? "Дата")}</span>
    </button>
  );

  const popover = open && pos && typeof document !== "undefined"
    ? createPortal(
      <div ref={popRef} style={{ top: pos.top, left: pos.left }} className="fixed z-[200] w-[268px] rounded-2xl border border-border bg-card p-3 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} className="flex size-7 items-center justify-center rounded-full text-foreground hover:bg-muted">
            <ChevronLeft className="size-4" />
          </button>
          <div className="font-medium text-foreground text-sm capitalize">{MONTHS[view.m]} {view.y}</div>
          <button type="button" onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))} className="flex size-7 items-center justify-center rounded-full text-foreground hover:bg-muted">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WD.map((w) => <div key={w} className="py-1 text-[14px] text-muted-foreground">{w}</div>)}
          {cells.map((day, i) =>
            day === null ? (
              <div key={`e${i}`} />
            ) : (
              <button
                key={day}
                type="button"
                disabled={disabled(day)}
                onClick={() => { if (disabled(day)) return; onChange(day); setOpen(false); }}
                className={`relative flex h-8 items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
                  disabled(day)
                    ? "text-muted-foreground/25"
                    : day === value ? "bg-sky-500 font-medium text-white" : "text-foreground hover:bg-muted"
                }`}
              >
                {parse(day).d}
                {markedDates?.has(day) && day !== value && (
                  <span className="absolute bottom-1 size-1 rounded-full bg-sky-400" />
                )}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          onClick={() => { onClear ? onClear() : onChange(todayISO()); setOpen(false); }}
          className="mt-2.5 w-full rounded-full border border-input py-1.5 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
        >
          {clearLabel ?? (onClear ? "Все даты" : "Сегодня")}
        </button>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className={iconOnly ? undefined : className}>
      {trigger}
      {popover}
    </div>
  );
}
