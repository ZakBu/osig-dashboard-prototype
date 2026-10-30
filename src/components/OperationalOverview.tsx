"use client";
import { useState } from 'react';
import { Truck, Scale, Route, Gauge, Building2, Warehouse, SlidersHorizontal, X } from 'lucide-react';
import { Dialog } from '@base-ui/react/dialog';
import { AnalyticsKpi } from './AnalyticsKpi';
import { AnalyticsRankingBars } from './AnalyticsRankingBars';
import { TrendCard } from './TrendCard';
import { Panel, Ring } from './ui';
import { PanelHeading, PANEL, PANEL_HEADER } from './DashboardPrimitives';
import { PeriodControl } from './PeriodControl';
import { formatNumber, type WasteSelection } from '@/lib/waste';
import { constructionTypes, financingTypes, initialPeriod, operationStats, objectsForPeriod, originRegistry, vehicleRegistry, receptionRegistry, type ObjectFilters } from '@/lib/operations';

const metrics = [
  { title: 'Общее количество рейсов', key: 'trips' as const, icon: Truck, color: '#2878e8', unit: '', weekly: false, note: 'Все зарегистрированные рейсы, включая отменённые.' },
  { title: 'Масса перемещённых ОССиГ', key: 'mass' as const, icon: Scale, color: '#a55de8', unit: ' т', weekly: false, note: 'Известная масса завершённых рейсов.' },
  { title: 'Среднее расстояние до ОП', key: 'distance' as const, icon: Route, color: '#31aeba', unit: ' км', weekly: false, note: 'Среднее расстояние маршрута по всем рейсам. Расстояния демонстрационные.' },
  { title: 'Среднее количество рейсов', key: 'average' as const, icon: Gauge, color: '#72c84b', unit: ' / день', weekly: true, note: 'Число рейсов / календарные дни, включая дни без рейсов.' },
  { title: 'Среднее количество рейсов на ТС', key: 'perVehicle' as const, icon: Truck, color: '#c7b348', unit: ' / ТС', weekly: false, note: 'Число рейсов / уникальные ТС с рейсами за период.' },
];
const resources = [
  { title: 'Активные ОО', key: 'activeOrigins' as const, total: originRegistry.length, icon: Building2, color: '#31aeba' },
  { title: 'Активные ТС', key: 'activeVehicles' as const, total: vehicleRegistry.length, icon: Truck, color: '#2878e8' },
  { title: 'Активные ОП', key: 'activeReceptions' as const, total: receptionRegistry.length, icon: Warehouse, color: '#43be6b' },
];
const objectEmpty: ObjectFilters = { activity: '', construction: '', financing: '' };
export function OperationalOverview({ selection }: { selection: WasteSelection }) {
  const [periods, setPeriods] = useState(() => Object.fromEntries([...metrics, ...resources.map(r => ({ ...r, weekly: false }))].map(m => [m.key, initialPeriod(m.weekly)])));
  const [trendPeriod, setTrendPeriod] = useState(() => initialPeriod(true));
  const [objectPeriod, setObjectPeriod] = useState(() => initialPeriod());
  const [objectFilters, setObjectFilters] = useState(objectEmpty);
  const [search, setSearch] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const objects = objectsForPeriod(objectPeriod, selection, objectFilters);
  const allForActivity = objectsForPeriod(objectPeriod, selection, { ...objectFilters, activity: '' });
  const bars = (key: 'construction' | 'financing', names: string[]) => names.map(name => ({ name, value: objects.filter(o => o[key] === name).length }));
  const setFilter = (key: keyof ObjectFilters, value: string) => setObjectFilters(f => ({ ...f, [key]: f[key] === value ? '' : value }));
  const choose = (key: keyof ObjectFilters, value: string) => { setFilter(key, value); setDetailsOpen(true); };
  const daily = operationStats(trendPeriod, selection).daily;
  return <div className="operational-overview">
    <div className="operational-metrics">{metrics.map(m => {
      const period = periods[m.key], stats = operationStats(period, selection);
      return <AnalyticsKpi key={m.key} title={m.title} metric={{ value: stats[m.key], previous: null, changePct: null }} icon={m.icon} color={m.color} unit={m.unit} tip={m.note} showTrend={false} controls={<PeriodControl title={m.title} value={period} onChange={p => setPeriods(s => ({ ...s, [m.key]: p }))} />} />;
    })}</div>
    <div className="operational-middle">
      <TrendCard title="Динамика рейсов по дням" subtitle="количество" tip="Количество рейсов за каждый календарный день. Период и время меняются независимо от других блоков." updated="" points={daily.map(r => ({ bucket: r.day, value: r.count }))} gran="day" onGran={() => {}} color="#43d56d" unit="рейсов" controls={<PeriodControl title="Динамика рейсов по дням" value={trendPeriod} onChange={setTrendPeriod} />} hideGran />
      <div className="operational-resources">{resources.map(r => {
        const period = periods[r.key], value = operationStats(period, selection)[r.key];
        return <AnalyticsKpi key={r.key} title={r.title} metric={{ value, previous: null, changePct: null }} icon={r.icon} color={r.color} unit={` / ${r.total}`} tip="Хотя бы один совершённый рейс за период. Без отменённых и подачи. Знаменатель — полный реестр, включая неактивные ресурсы." showTrend={false} controls={<PeriodControl title={r.title} value={period} onChange={p => setPeriods(s => ({ ...s, [r.key]: p }))} />} footer={<div className="operational-resource-share"><Ring value={value / r.total * 100} size={36} stroke={4} className="text-[#43be6b]" /><span>{formatNumber(value / r.total * 100, 1)}% реестра</span></div>} />;
      })}</div>
    </div>
    <div className="operational-object-heading"><span>Объекты образования ОССиГ</span><div className="flex items-center gap-3"><PeriodControl title="Объекты образования" value={objectPeriod} onChange={setObjectPeriod} /><button type="button" className="operational-details" onClick={() => setDetailsOpen(true)}><SlidersHorizontal size={16} />Фильтры и объекты · {objects.length}</button></div></div>
    <div className="operational-object-charts">
      <ObjectChart title="ОО по факту совершения рейсов" rows={[{ name: 'Есть рейсы', value: allForActivity.filter(o => o.trips > 0).length }, { name: 'Нет рейсов', value: allForActivity.filter(o => !o.trips).length }]} color="#43be6b" onSelect={n => choose('activity', n === 'Есть рейсы' ? 'active' : 'inactive')} />
      <ObjectChart title="ОО по видам строительства" rows={bars('construction', constructionTypes)} color="#4d8ee8" onSelect={n => choose('construction', n)} />
      <ObjectChart title="ОО по категориям финансирования" rows={bars('financing', financingTypes)} color="#a55de8" onSelect={n => choose('financing', n)} />
    </div>
    <Dialog.Root open={detailsOpen} onOpenChange={setDetailsOpen}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[150] bg-black/70" /><Dialog.Viewport className="fixed inset-0 z-[160] flex items-center justify-center p-4"><Dialog.Popup className="operational-object-dialog rounded-[12px] border border-[#202c42] bg-[#050912] p-6 shadow-2xl outline-none"><div className="mb-5 flex items-start justify-between gap-4"><div><Dialog.Title className="text-[26px] font-semibold">Объекты образования ОССиГ</Dialog.Title><Dialog.Description className="text-[15px] text-[#7f899b]">Общие фильтры списка и графиков</Dialog.Description></div><Dialog.Close aria-label="Закрыть" className="p-2"><X size={20} /></Dialog.Close></div>
    <section className="ops-objects">
      <div className="ops-section-title"><div><h2>Объекты образования ОССиГ</h2><span>Графики и список используют одни фильтры и период</span></div><PeriodControl title="Объекты образования" value={objectPeriod} onChange={setObjectPeriod} /></div>
      <div className="ops-object-filters"><SlidersHorizontal size={18} />
        <label>Совершение рейсов<select aria-label="Фильтр ОО по рейсам" value={objectFilters.activity} onChange={e => setFilter('activity', e.target.value)}><option value="">Все ОО</option><option value="active">Есть рейсы</option><option value="inactive">Нет рейсов</option></select></label>
        <label>Вид строительства<select aria-label="Фильтр ОО по виду строительства" value={objectFilters.construction} onChange={e => setFilter('construction', e.target.value)}><option value="">Все виды</option>{constructionTypes.map(n => <option key={n}>{n}</option>)}</select></label>
        <label>Финансирование<select aria-label="Фильтр ОО по финансированию" value={objectFilters.financing} onChange={e => setFilter('financing', e.target.value)}><option value="">Все категории</option>{financingTypes.map(n => <option key={n}>{n}</option>)}</select></label>
        <button type="button" onClick={() => { setObjectFilters(objectEmpty); setSearch(''); }}>Сбросить</button>
      </div>
      <article className="ops-card"><header><h2>Список ОО · {objects.length} объектов</h2><input type="search" aria-label="Поиск ОО" placeholder="Найти объект…" value={search} onChange={e => setSearch(e.target.value)} /></header><div className="ops-table-wrap"><table><thead><tr><th>Объект образования</th><th>Вид строительства</th><th>Финансирование</th><th>Рейсов</th><th>Активность</th></tr></thead><tbody>{objects.filter(o => o.name.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).map(o => <tr key={o.name}><td>{o.name}</td><td>{o.construction}</td><td>{o.financing}</td><td>{o.trips}</td><td><span className={o.trips ? 'ops-active' : 'ops-idle'}>{o.trips ? 'Есть рейсы' : 'Нет рейсов'}</span></td></tr>)}</tbody></table>{!objects.length && <p>Объектов по выбранным условиям нет. Измените фильтры.</p>}</div></article>
    </section>    </Dialog.Popup></Dialog.Viewport></Dialog.Portal></Dialog.Root>
  </div>;
}
function ObjectChart({ title, rows, color, onSelect }: { title: string; rows: { name: string; value: number }[]; color: string; onSelect: (name: string) => void }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return <Panel className={`${PANEL} waste-dashboard-panel`} headerClassName={PANEL_HEADER} bodyClassName="waste-panel-body flex min-h-0 flex-1 flex-col pb-3 pt-0" title={<PanelHeading title={title} updated="" tip="Количество объектов выбранного периода. Нажмите категорию для фильтрации и просмотра объектов." />}><AnalyticsRankingBars rows={rows.map(r => ({ name: r.name, trips: r.value, mass: null, vehicles: 0 }))} color={color} total={total} unit="объектов" onSelect={onSelect} /></Panel>;
}
