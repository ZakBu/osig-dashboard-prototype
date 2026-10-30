"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { asset } from "@/lib/bp";

export type DateRange = { from: string; to: string };

const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return { y, m: m - 1, d }; };
const fmtShort = (s: string) => { const { m, d } = parse(s); return `${d} ${MONTHS_SHORT[m]}`; };
const fmtRange = (from: string, to: string) => {
  const a = parse(from);
  const b = parse(to);
  return a.y === b.y && a.m === b.m ? `${a.d}–${b.d} ${MONTHS_SHORT[a.m]}` : `${fmtShort(from)} – ${fmtShort(to)}`;
};
const daysInclusive = (from: string, to: string) => {
  const a = parse(from);
  const b = parse(to);
  return Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86400000) + 1;
};

/** Компактный дата-пикер: выбор конкретного дня и интервала (первый клик — начало, второй — конец). */
export function DatePicker({
  min, max, value, onChange, triggerClassName,
}: {
  min: string;
  max: string;
  value: DateRange;
  onChange: (r: DateRange) => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(() => { const p = parse(min); return { y: p.y, m: p.m }; });

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!open) return;
    const selected = parse(value.to);
    setView({ y: selected.y, m: selected.m });
  }, [open, value.to]);

  const cells = useMemo(() => {
    const startWd = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    const arr: (string | null)[] = Array(startWd).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(ymd(view.y, view.m, d));
    return arr;
  }, [view]);

  const spanDays = daysInclusive(value.from, value.to);
  const label = spanDays === 7 ? "за 7 дней" : value.from === value.to ? fmtShort(value.from) : fmtRange(value.from, value.to);
  const disabled = (day: string) => day < min || day > max;
  const inSel = (day: string) => day >= value.from && day <= value.to;

  const pick = (day: string) => {
    if (!anchor) { setAnchor(day); onChange({ from: day, to: day }); }
    else {
      const [from, to] = anchor <= day ? [anchor, day] : [day, anchor];
      onChange({ from, to });
      setAnchor(null);
      setOpen(false);
    }
  };

  const minM = parse(min), maxM = parse(max);
  const canPrev = view.y > minM.y || (view.y === minM.y && view.m > minM.m);
  const canNext = view.y < maxM.y || (view.y === maxM.y && view.m < maxM.m);

  return (
    <div className="relative min-w-0" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`${fmtShort(value.from)} – ${fmtShort(value.to)}`}
        onClick={() => { setAnchor(null); setOpen((o) => !o); }}
        className={triggerClassName ? `flex min-w-0 items-center gap-3 overflow-hidden whitespace-nowrap ${triggerClassName}` : "flex h-9 min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-full border border-input bg-background px-3.5 text-foreground text-sm transition-colors hover:bg-muted/50"}
      >
        <span className="min-w-0 flex-1 truncate text-left tabular-nums">{label}</span>
        <span
          aria-hidden="true"
          className="size-5 shrink-0 bg-[#8a94a6]"
          style={{ WebkitMask: `url(${asset("/waste/filter-chevron.svg")}) center / contain no-repeat`, mask: `url(${asset("/waste/filter-chevron.svg")}) center / contain no-repeat` }}
        />
      </button>

      {open && (
        <div role="dialog" aria-label="Выбор периода" className="absolute right-0 z-[160] mt-2 w-[304px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[10px] border border-[#263247] bg-[#080d16] p-3.5 shadow-[0_18px_50px_rgba(0,0,0,0.58)]">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}
              className="flex size-8 items-center justify-center rounded-[7px] border border-white/[0.07] bg-[#0d1421] text-[#9aa5b8] transition-colors hover:border-white/[0.12] hover:bg-[#121c2c] hover:text-white disabled:pointer-events-none disabled:opacity-25"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="text-[19px] font-semibold capitalize tracking-normal text-[#eef0f5]">{MONTHS[view.m]} {view.y}</div>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}
              className="flex size-8 items-center justify-center rounded-[7px] border border-white/[0.07] bg-[#0d1421] text-[#9aa5b8] transition-colors hover:border-white/[0.12] hover:bg-[#121c2c] hover:text-white disabled:pointer-events-none disabled:opacity-25"
              aria-label="Следующий месяц"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WD.map((w) => <div key={w} className="pb-1.5 pt-0.5 text-[13px] font-medium uppercase text-[#68758a]">{w}</div>)}
            {cells.map((day, i) =>
              day === null ? (
                <div key={`e${i}`} />
              ) : (
                (() => {
                  const selected = inSel(day);
                  const start = day === value.from;
                  const end = day === value.to;
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={disabled(day)}
                      onClick={() => pick(day)}
                      aria-pressed={selected}
                      className={`group relative flex h-9 items-center justify-center text-[16px] tabular-nums outline-none transition-colors ${selected ? "bg-[#142b4d]" : "bg-transparent"} ${start ? "rounded-l-[8px]" : ""} ${end ? "rounded-r-[8px]" : ""} ${disabled(day) ? "cursor-not-allowed text-[#3c4656]" : "text-[#cfd5df]"}`}
                    >
                      <span className={`relative z-[1] flex size-8 items-center justify-center rounded-[7px] transition-colors ${start || end ? "bg-[#3475cf] font-semibold text-white shadow-[0_3px_12px_rgba(40,101,191,0.34)]" : disabled(day) ? "" : selected ? "font-medium text-[#e8eef8]" : "group-hover:bg-white/[0.07] group-focus-visible:ring-1 group-focus-visible:ring-[#4d78c6]"}`}>
                        {parse(day).d}
                      </span>
                    </button>
                  );
                })()
              ),
            )}
          </div>

          <div className="mt-3 flex gap-2 border-t border-white/[0.07] pt-3">
            <button
              type="button"
              onClick={() => {
                const latest = parse(max);
                const fromDate = new Date(Date.UTC(latest.y, latest.m, latest.d - 6));
                const from = ymd(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate());
                onChange({ from: from < min ? min : from, to: max });
                setAnchor(null);
                setOpen(false);
              }}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[7px] border border-[#263247] bg-[#0d1421] px-3 text-[15px] font-medium text-[#aab4c5] transition-colors hover:bg-[#121c2c] hover:text-white"
            >
              <CalendarRange className="size-3.5" />
              7 дней
            </button>
            <button
              type="button"
              onClick={() => { onChange({ from: min, to: max }); setAnchor(null); setOpen(false); }}
              className="h-10 flex-1 rounded-[7px] border border-[#263247] bg-[#0d1421] px-3 text-[15px] font-medium text-[#aab4c5] transition-colors hover:bg-[#121c2c] hover:text-white"
            >
              Весь период
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
