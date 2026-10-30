"use client";
import { useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { initialPeriod, moscowToday, validPeriod, type Period } from "@/lib/operations";
export function PeriodControl({ value, onChange, title }: { value: Period; onChange: (value: Period) => void; title: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const today = moscowToday();
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger className="ops-period-trigger" aria-label={`Период: ${title}`} aria-expanded={open} onClick={() => setDraft(value)}><CalendarDays size={14} />{value.from === value.to ? value.from.slice(8) + '.' + value.from.slice(5, 7) : `${value.from.slice(8)}.${value.from.slice(5, 7)}–${value.to.slice(8)}.${value.to.slice(5, 7)}`}<Clock3 size={13} />{value.start}–{value.end}</Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-[190]"><Popover.Popup className="ops-period-editor" role="group" aria-label={`Настройка периода: ${title}`}>
      <div className="ops-presets">{[['Сегодня', false], ['Неделя', true]] .map(([label, weekly]) => <button type="button" key={String(label)} onClick={() => setDraft(initialPeriod(Boolean(weekly), today))}>{label}</button>)}</div>
      <label>С даты<input type="date" value={draft.from} max={draft.to} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
      <label>По дату<input type="date" value={draft.to} min={draft.from} max={today} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
      <div className="ops-time"><label>С времени<input type="time" value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} /></label><label>По время<input type="time" value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value })} /></label></div>
      <small>Московское время · обе границы включены</small>
      <div className="ops-presets"><button type="button" onClick={() => setOpen(false)}>Отмена</button><button type="button" disabled={!validPeriod(draft)} onClick={() => { onChange(draft); setOpen(false); }}>Применить</button></div>
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}
