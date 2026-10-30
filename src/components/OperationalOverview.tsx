"use client";
import { useState, type ReactNode } from 'react';
import { CalendarDays, Clock3, Truck, Scale, Route, Gauge, Building2, Warehouse, SlidersHorizontal } from 'lucide-react';
import { ChartBox } from './ChartBox';
import { formatNumber, type WasteSelection } from '@/lib/waste';
import { constructionTypes, financingTypes, initialPeriod, moscowToday, validPeriod, operationStats, objectsForPeriod, originRegistry, vehicleRegistry, receptionRegistry, type Period, type ObjectFilters } from '@/lib/operations';

function PeriodControl({ value, onChange, title }: { value: Period; onChange: (value: Period) => void; title: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const today = moscowToday();
  return <div className="ops-period">
    <button type="button" aria-label={`Период: ${title}`} aria-expanded={open} onClick={() => { setDraft(value); setOpen(!open); }}><CalendarDays size={14} />{value.from === value.to ? value.from.slice(8) + '.' + value.from.slice(5, 7) : `${value.from.slice(8)}.${value.from.slice(5, 7)}–${value.to.slice(8)}.${value.to.slice(5, 7)}`}<Clock3 size={13} />{value.start}–{value.end}</button>
    {open && <div className="ops-period-editor" role="group" aria-label={`Настройка периода: ${title}`}>
      <div className="ops-presets">{[['Сегодня', false], ['Неделя', true]] .map(([label, weekly]) => <button type="button" key={String(label)} onClick={() => setDraft(initialPeriod(Boolean(weekly), today))}>{label}</button>)}</div>
      <label>С даты<input type="date" value={draft.from} max={draft.to} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label>
      <label>По дату<input type="date" value={draft.to} min={draft.from} max={today} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label>
      <div className="ops-time"><label>С времени<input type="time" value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} /></label><label>По время<input type="time" value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value })} /></label></div>
      <small>Московское время · обе границы включены</small>
      <div className="ops-presets"><button type="button" onClick={() => setOpen(false)}>Отмена</button><button type="button" disabled={!validPeriod(draft)} onClick={() => { onChange(draft); setOpen(false); }}>Применить</button></div>
    </div>}
  </div>;
}
function Block({ title, weekly = false, children }: { title: string; weekly?: boolean; children: (period: Period) => ReactNode }) {
  const [period, setPeriod] = useState(() => initialPeriod(weekly));
  return <article className="ops-card"><header><h2>{title}</h2><PeriodControl title={title} value={period} onChange={setPeriod} /></header>{children(period)}</article>;
}
const objectEmpty: ObjectFilters = { activity: '', construction: '', financing: '' };
export function OperationalOverview({ selection }: { selection: WasteSelection }) {
  const [objectFilters, setObjectFilters] = useState(objectEmpty);
  const [objectPeriod, setObjectPeriod] = useState(() => initialPeriod());
  const [search, setSearch] = useState('');
  const objects = objectsForPeriod(objectPeriod, selection, objectFilters);
  const allForActivity = objectsForPeriod(objectPeriod, selection, { ...objectFilters, activity: '' });
  const bars = (key: 'construction' | 'financing', names: string[]) => names.map(name => ({ name, value: objects.filter(o => o[key] === name).length }));
  const setFilter = (key: keyof ObjectFilters, value: string) => setObjectFilters(f => ({ ...f, [key]: f[key] === value ? '' : value }));
  const metrics = [
    { title: 'Общее количество рейсов', key: 'trips' as const, icon: Truck, unit: 'рейсов', weekly: false, note: 'Все зарегистрированные рейсы, включая отменённые.' },
    { title: 'Масса перемещённых ОССиГ', key: 'mass' as const, icon: Scale, unit: 'т', weekly: false, note: 'Известная масса завершённых рейсов.' },
    { title: 'Среднее расстояние до ОП', key: 'distance' as const, icon: Route, unit: 'км', weekly: false, note: 'Среднее расстояние маршрута по всем рейсам. Расстояния демонстрационные.' },
    { title: 'Среднее количество рейсов', key: 'average' as const, icon: Gauge, unit: 'рейсов / день', weekly: true, note: 'Число рейсов / календарные дни, включая дни без рейсов.' },
    { title: 'Среднее количество рейсов на одно ТС', key: 'perVehicle' as const, icon: Truck, unit: 'рейсов / ТС', weekly: false, note: 'Число рейсов / уникальные ТС с рейсами за период.' },
  ];
  const resources = [
    { title: 'Активные ОО', key: 'activeOrigins' as const, total: originRegistry.length, icon: Building2 },
    { title: 'Активные ТС', key: 'activeVehicles' as const, total: vehicleRegistry.length, icon: Truck },
    { title: 'Активные ОП', key: 'activeReceptions' as const, total: receptionRegistry.length, icon: Warehouse },
  ];
  return <div className="ops-overview">
    <div className="ops-heading"><div><span className="ops-eyebrow">ОПЕРАТИВНЫЙ ОБЗОР</span><h1>Перемещение ОССиГ</h1><p>У каждого блока свой период · московское время · данные демо: 17–30 октября 2026</p></div><span className="ops-live">Демонстрационный режим</span></div>
    <div className="ops-metrics">{metrics.map(({ title, key, icon: Icon, unit, weekly, note }) => <Block key={key} title={title} weekly={weekly}>{period => { const stats = operationStats(period, selection); return <><Icon className="ops-icon" size={22} /><div className="ops-value">{formatNumber(stats[key], key === 'trips' ? 0 : 1)} <span>{unit}</span></div><p>{note}</p></>; }}</Block>)}</div>
    <Block title="Динамика рейсов по дням" weekly>{period => { const data = operationStats(period, selection); return <div className="ops-chart"><ChartBox type="bar" series={[{ name: 'Рейсы', data: data.daily.map(r => r.count) }]} options={{ chart: { toolbar: { show: false }, foreColor: '#95a4bc', background: 'transparent' }, theme: { mode: 'dark' }, colors: ['#43be6b'], plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } }, dataLabels: { enabled: false }, grid: { borderColor: '#1b293d' }, xaxis: { categories: data.daily.map(r => `${r.day.slice(8)}.${r.day.slice(5, 7)}`) }, yaxis: { decimalsInFloat: 0 }, tooltip: { theme: 'dark' } }} /></div>; }}</Block>
    <div className="ops-section-title"><h2>Задействованность ресурсов</h2><span>Есть хотя бы один совершённый рейс за период / полный реестр</span></div>
    <div className="ops-resources">{resources.map(({ title, key, total, icon: Icon }) => <Block key={key} title={title}>{period => { const active = operationStats(period, selection)[key]; return <><Icon className="ops-icon" size={22} /><div className="ops-value">{active} <span>/ {total}</span><em>{formatNumber(active / total * 100, 1)}%</em></div><div className="ops-track"><i style={{ width: `${active / total * 100}%` }} /></div><p>Без отменённых рейсов и подачи. Знаменатель — весь реестр.</p></>; }}</Block>)}</div>
    <section className="ops-objects">
      <div className="ops-section-title"><div><h2>Объекты образования ОССиГ</h2><span>Графики и список используют одни фильтры и период</span></div><PeriodControl title="Объекты образования" value={objectPeriod} onChange={setObjectPeriod} /></div>
      <div className="ops-object-filters"><SlidersHorizontal size={18} />
        <label>Совершение рейсов<select aria-label="Фильтр ОО по рейсам" value={objectFilters.activity} onChange={e => setFilter('activity', e.target.value)}><option value="">Все ОО</option><option value="active">Есть рейсы</option><option value="inactive">Нет рейсов</option></select></label>
        <label>Вид строительства<select aria-label="Фильтр ОО по виду строительства" value={objectFilters.construction} onChange={e => setFilter('construction', e.target.value)}><option value="">Все виды</option>{constructionTypes.map(n => <option key={n}>{n}</option>)}</select></label>
        <label>Финансирование<select aria-label="Фильтр ОО по финансированию" value={objectFilters.financing} onChange={e => setFilter('financing', e.target.value)}><option value="">Все категории</option>{financingTypes.map(n => <option key={n}>{n}</option>)}</select></label>
        <button type="button" onClick={() => { setObjectFilters(objectEmpty); setSearch(''); }}>Сбросить</button>
      </div>
      <div className="ops-resources">
        <ObjectChart title="ОО по факту совершения рейсов" rows={[{ name: 'Есть рейсы', value: allForActivity.filter(o => o.trips > 0).length, key: 'active' }, { name: 'Нет рейсов', value: allForActivity.filter(o => !o.trips).length, key: 'inactive' }]} selected={objectFilters.activity} onSelect={n => setFilter('activity', n)} />
        <ObjectChart title="ОО по видам строительства" rows={bars('construction', constructionTypes)} selected={objectFilters.construction} onSelect={n => setFilter('construction', n)} />
        <ObjectChart title="ОО по категориям финансирования" rows={bars('financing', financingTypes)} selected={objectFilters.financing} onSelect={n => setFilter('financing', n)} />
      </div>
      <article className="ops-card"><header><h2>Список ОО · {objects.length} объектов</h2><input type="search" aria-label="Поиск ОО" placeholder="Найти объект…" value={search} onChange={e => setSearch(e.target.value)} /></header><div className="ops-table-wrap"><table><thead><tr><th>Объект образования</th><th>Вид строительства</th><th>Финансирование</th><th>Рейсов</th><th>Активность</th></tr></thead><tbody>{objects.filter(o => o.name.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).map(o => <tr key={o.name}><td>{o.name}</td><td>{o.construction}</td><td>{o.financing}</td><td>{o.trips}</td><td><span className={o.trips ? 'ops-active' : 'ops-idle'}>{o.trips ? 'Есть рейсы' : 'Нет рейсов'}</span></td></tr>)}</tbody></table>{!objects.length && <p>Объектов по выбранным условиям нет. Измените фильтры.</p>}</div></article>
    </section>
  </div>;
}
function ObjectChart({ title, rows, selected, onSelect }: { title: string; rows: { name: string; value: number; key?: string }[]; selected: string; onSelect: (value: string) => void }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return <article className="ops-card"><header><h2>{title}</h2></header><p>Нажмите категорию, чтобы отфильтровать ОО</p><div className="ops-bars">{rows.map(r => <button key={r.name} type="button" aria-pressed={selected === (r.key ?? r.name)} onClick={() => onSelect(r.key ?? r.name)}><span>{r.name}</span><strong>{r.value}</strong><i style={{ width: `${r.value / max * 100}%` }} /></button>)}</div></article>;
}
