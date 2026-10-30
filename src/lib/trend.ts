import type {
  AvailPoint, Counts3, Fuel4, FuelPrice, HeatCell, HourlyCounts, HourlyFuel, HourlyPoint, NetLimitPoint, NetQueuePoint, PricePoint,
  NetSummary, QueueCounts4, QueueDay, QueueNet, RegistryData, StatusRow, TrendPoint3,
} from "./types";
import { NET_ORDER, netMatches, netOrderIndex, isVink, type NetFilter, type StationType } from "./netType";

export type DateRange = { from: string; to: string };

const r1 = (x: number) => Math.round(x * 10) / 10;
const total3 = (c: Counts3) => c[0] + c[1] + c[2];

const dowOf = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return ((new Date(Date.UTC(y, m - 1, day)).getUTCDay() + 6) % 7) + 1;
};

export function selectHours(hourly: HourlyPoint[], range: DateRange): HourlyPoint[] {
  return hourly.filter((h) => {
    const d = h.key.slice(0, 10);
    return d >= range.from && d <= range.to;
  });
}

const toPoint = (key: string, c: Counts3): TrendPoint3 => {
  const t = total3(c) || 1;
  // cnt — фактические счётчики периода (для подписей «N АЗС»), без пересчёта через чужой total.
  return { key, open: r1((c[0] / t) * 100), noFuel: r1((c[1] / t) * 100), closed: r1((c[2] / t) * 100), cnt: [c[0], c[1], c[2]] };
};

/** Счётчики [open, no_fuel, closed] за час под фильтр (сеть/тип/все). */
function pickC(hc: HourlyCounts, f: NetFilter): Counts3 {
  if (!f.net && f.type === "all") return hc.c;
  const a: Counts3 = [0, 0, 0];
  for (const [name, c] of Object.entries(hc.nets)) {
    if (netMatches(name, f)) { a[0] += c[0]; a[1] += c[1]; a[2] += c[2]; }
  }
  return a;
}

/** Часы: точка на каждый снимок за текущий (последний в данных) день. */
export function trend3ByHour(sel: HourlyPoint[], f: NetFilter): TrendPoint3[] {
  const sorted = [...sel].sort((a, b) => (a.key < b.key ? -1 : 1));
  const lastDay = sorted.length ? sorted[sorted.length - 1].key.slice(0, 10) : "";
  return sorted.filter((p) => p.key.slice(0, 10) === lastDay).map((h) => toPoint(h.key, pickC(h.all, f)));
}

/** Точка тренда с возможными пустыми интервалами (нет снимков в окне → null).
 *  `sub` — подпись второй строки (дата полосы для суточной ретроспективы). */
export type TrendPoint3N = { key: string; sub?: string; open: number | null; noFuel: number | null; closed: number | null; cnt?: Counts3 };

/** Полосы времени суток для «Доступности топлива» (запрос руководства). */
const BANDS: { s: number; e: number; label: string }[] = [
  { s: 0, e: 6, label: "0–6" },
  { s: 6, e: 9, label: "6–9" },
  { s: 9, e: 12, label: "9–12" },
  { s: 12, e: 15, label: "12–15" },
  { s: 15, e: 18, label: "15–18" },
  { s: 18, e: 21, label: "18–21" },
  { s: 21, e: 24, label: "21–24" },
];

const hhmm = (h: number) => `${String(h === 24 ? 0 : h).padStart(2, "0")}:00`;

/**
 * «Актуальный период» для шапки блоков: интервал, ОКАНЧИВАЮЩИЙСЯ на времени
 * снимка (округление вниз): снимок 9:01 → «06:00 - 09:00». Формат
 * «02.07.2026, 06:00 - 09:00» (МСК).
 */
export function bandPeriodLabel(iso: string): string {
  const d = new Date(iso);
  const msk = new Date(d.getTime() + 3 * 3600000); // МСК = UTC+3; читаем getUTC* (не зависит от ТЗ клиента)
  const dd = String(msk.getUTCDate()).padStart(2, "0");
  const mm = String(msk.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = msk.getUTCFullYear();
  const h = msk.getUTCHours();
  // Интервал (s, e], оканчивающийся на часе снимка: 9→(6,9], 0→(21,24] того же дня.
  const b = h === 0 ? { s: 21, e: 24 } : (BANDS.find((x) => h > x.s && h <= x.e) ?? BANDS[BANDS.length - 1]);
  return `${dd}.${mm}.${yyyy}, ${hhmm(b.s)} - ${hhmm(b.e)}`;
}

/**
 * Ретроспектива за сутки (вкладка «Сутки»): `bands` уже посчитан на бэкенде по
 * правилу (статус станции внутри интервала 06:00–09:00 и т.д.). Ключ точки =
 * момент конца интервала (МСК). Показываем только последние сутки; метка = время
 * конца интервала, вторая строка — дата.
 */
export function trend3Retro24(bands: HourlyPoint[], f: NetFilter): TrendPoint3N[] {
  if (!bands.length) return [];
  const DAY = 86_400_000;
  // key = "YYYY-MM-DDTHH:MM" (МСК-стенка); читаем как UTC-инстант для сортировки/меток.
  const pts = bands
    .map((b) => ({ endMs: Date.parse(`${b.key}:00Z`), c: pickC(b.all, f) }))
    .sort((a, b) => a.endMs - b.endMs);
  const latest = pts[pts.length - 1].endMs;
  return pts
    .filter((p) => p.endMs >= latest - DAY)
    .map(({ endMs, c }) => {
      const e = new Date(endMs);
      const key = hhmm(e.getUTCHours());
      const sub = `${String(e.getUTCDate()).padStart(2, "0")}.${String(e.getUTCMonth() + 1).padStart(2, "0")}`;
      const t = c[0] + c[1] + c[2] || 1;
      return { key, sub, open: r1((c[0] / t) * 100), noFuel: r1((c[1] / t) * 100), closed: r1((c[2] / t) * 100), cnt: c };
    });
}

/** Вкладка «Дни»: `daily` уже посчитан на бэкенде по правилу (статус станции за
 *  календарный день). Здесь только выбор под фильтр сети/типа и проценты. */
export function trend3ByDay(daily: HourlyPoint[], f: NetFilter): TrendPoint3[] {
  return [...daily]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((p) => toPoint(p.key, pickC(p.all, f)));
}

// ——— Доступность топлива по видам (ряд из матвью доступность_топлива) ———

/** Точка топливного ряда: число АЗС с каждым видом топлива (из матвью, как есть). */
export type FuelSeriesPoint = {
  key: string;
  sub?: string;
  any: number | null;
  g92: number | null;
  g95: number | null;
  gdt: number | null;
  [metric: string]: string | number | null | undefined;
};

/** «DD.MM» из ключа 'YYYY-MM-DD'. */
const ddmm = (day: string) => { const [, m, d] = day.split("-"); return `${d}.${m}`; };

const availPoint = (p: AvailPoint, key: string, sub?: string): FuelSeriesPoint => ({ key, sub, any: p.total, g92: p.g92, g95: p.g95, gdt: p.gdt });

/** «Часы»: последние ~8 точек (≈ сутки) выбранной группы. Метка = час:00 + дата снизу. */
export function fuelRetro24(avail: AvailPoint[]): FuelSeriesPoint[] {
  const pts = [...avail].sort((a, b) => (a.day === b.day ? a.hour - b.hour : a.day < b.day ? -1 : 1)).slice(-8);
  return pts.map((p) => availPoint(p, `${String(p.hour).padStart(2, "0")}:00`, ddmm(p.day)));
}

/** «Дни»: одна точка на календарный день (последний час дня). Ключ = дата YYYY-MM-DD. */
export function fuelByDay(avail: AvailPoint[]): FuelSeriesPoint[] {
  const byDay = new Map<string, AvailPoint>();
  for (const p of [...avail].sort((a, b) => a.hour - b.hour)) byDay.set(p.day, p); // поздний час перезаписывает
  return [...byDay.keys()].sort().map((day) => availPoint(byDay.get(day)!, day));
}

const limitPoint = (p: NetLimitPoint, key: string, sub?: string): FuelSeriesPoint => ({
  key,
  sub,
  any: null,
  g92: null,
  g95: null,
  gdt: null,
  tank: p.tank,
  canister: p.canister,
  tankShare: p.tankShare,
  canisterShare: p.canisterShare,
});

/** Ограничения «Часы»: последние ~8 срезов выбранной группы. */
export function limitsRetro24(series: NetLimitPoint[]): FuelSeriesPoint[] {
  const pts = [...series].sort((a, b) => (a.day === b.day ? a.hour - b.hour : a.day < b.day ? -1 : 1)).slice(-8);
  return pts.map((p) => limitPoint(p, `${String(p.hour).padStart(2, "0")}:00`, ddmm(p.day)));
}

/** Ограничения «Дни»: одна точка на календарный день (последний час). */
export function limitsByDay(series: NetLimitPoint[]): FuelSeriesPoint[] {
  const byDay = new Map<string, NetLimitPoint>();
  for (const p of [...series].sort((a, b) => a.hour - b.hour)) byDay.set(p.day, p);
  return [...byDay.keys()].sort().map((day) => limitPoint(byDay.get(day)!, day));
}

const pricePoint = (p: PricePoint, key: string, sub?: string): FuelSeriesPoint => ({
  key,
  sub,
  any: null,
  g92: null,
  g95: null,
  gdt: null,
  p92: p.p92,
  p92p: p.p92p,
  p95: p.p95,
  p95p: p.p95p,
  p100: p.p100,
  p100p: p.p100p,
  pdt: p.pdt,
  pdtp: p.pdtp,
});

/** Цены «Часы»: последние ~8 срезов выбранной группы. */
export function priceRetro24(series: PricePoint[]): FuelSeriesPoint[] {
  const pts = [...series].sort((a, b) => (a.day === b.day ? a.hour - b.hour : a.day < b.day ? -1 : 1)).slice(-8);
  return pts.map((p) => pricePoint(p, `${String(p.hour).padStart(2, "0")}:00`, ddmm(p.day)));
}

/** Цены «Дни»: одна точка на день = среднее за день (по всем часовым срезам). Ключ = дата YYYY-MM-DD. */
export function priceByDay(series: PricePoint[]): FuelSeriesPoint[] {
  const keys = ["p92", "p92p", "p95", "p95p", "p100", "p100p", "pdt", "pdtp"] as const;
  const byDay = new Map<string, Record<(typeof keys)[number], number[]>>();
  for (const p of series) {
    const acc = byDay.get(p.day) ?? {
      p92: [], p92p: [], p95: [], p95p: [], p100: [], p100p: [], pdt: [], pdtp: [],
    };
    for (const key of keys) {
      const value = p[key];
      if (typeof value === "number") acc[key].push(value);
    }
    byDay.set(p.day, acc);
  }
  const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return [...byDay.keys()].sort().map((day) => {
    const p = byDay.get(day)!;
    return {
      key: day,
      any: null,
      g92: null,
      g95: null,
      gdt: null,
      p92: avg(p.p92),
      p92p: avg(p.p92p),
      p95: avg(p.p95),
      p95p: avg(p.p95p),
      p100: avg(p.p100),
      p100p: avg(p.p100p),
      pdt: avg(p.pdt),
      pdtp: avg(p.pdtp),
    };
  });
}

// ——— Ряд очередей во времени (из матвью 27166: count_queue / count_open_azs) ———

/** Точка ряда очередей: АЗС сети с очередью (`value`) и открытых (`open`). */
export type QueueTrendPoint = { key: string; sub?: string; value: number; open: number };

const qPoint = (p: NetQueuePoint, key: string, sub?: string): QueueTrendPoint => ({ key, sub, value: p.queue ?? 0, open: p.open ?? 0 });

/** Очереди «Часы»: последние ~8 срезов выбранной группы. */
export function queueTrendRetro24(series: NetQueuePoint[]): QueueTrendPoint[] {
  const pts = [...series].sort((a, b) => (a.day === b.day ? a.hour - b.hour : a.day < b.day ? -1 : 1)).slice(-8);
  return pts.map((p) => qPoint(p, `${String(p.hour).padStart(2, "0")}:00`, ddmm(p.day)));
}

/** Очереди «Дни»: одна точка на день (последний час). Ключ = дата YYYY-MM-DD. */
export function queueTrendByDay(series: NetQueuePoint[]): QueueTrendPoint[] {
  const byDay = new Map<string, NetQueuePoint>();
  for (const p of [...series].sort((a, b) => a.hour - b.hour)) byDay.set(p.day, p);
  return [...byDay.keys()].sort().map((day) => qPoint(byDay.get(day)!, day));
}

export function heatmapCells(sel: HourlyPoint[], f: NetFilter): HeatCell[] {
  const m = new Map<string, Counts3>();
  for (const h of sel) {
    const dow = dowOf(h.key.slice(0, 10));
    const hour = Number(h.key.slice(11, 13));
    const k = `${dow}:${hour}`;
    const acc = m.get(k) ?? ([0, 0, 0] as Counts3);
    const c = pickC(h.all, f);
    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    m.set(k, acc);
  }
  return [...m.entries()].map(([k, c]) => {
    const [dow, hour] = k.split(":").map(Number);
    const t = total3(c) || 1;
    return { dow, hour, index: r1((c[0] / t) * 100), total: total3(c) };
  });
}

/** 3-way по сетям (в рамках типа). Топ по числу наблюдений + «Прочие». */
export function netStatus(sel: HourlyPoint[], type: StationType, topN = 6): StatusRow[] {
  const m = new Map<string, Counts3>();
  for (const h of sel) {
    for (const [name, c] of Object.entries(h.all.nets)) {
      if (!netMatches(name, { net: null, type })) continue;
      const acc = m.get(name) ?? ([0, 0, 0] as Counts3);
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
      m.set(name, acc);
    }
  }
  const rows = [...m.entries()]
    .map(([name, c]) => {
      const t = total3(c);
      return { name, open: c[0], noFuel: c[1], closed: c[2], total: t, index: r1(t ? (c[0] / t) * 100 : 0) };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const result = rows.slice(0, topN);
  const rest = rows.slice(topN);
  if (rest.length) {
    const s = rest.reduce((a, r) => ({ o: a.o + r.open, f: a.f + r.noFuel, c: a.c + r.closed }), { o: 0, f: 0, c: 0 });
    const t = s.o + s.f + s.c;
    result.push({ name: "Прочие", open: s.o, noFuel: s.f, closed: s.c, total: t, index: r1(t ? (s.o / t) * 100 : 0) });
  }
  const others = result.filter((r) => r.name === "Прочие");
  // Единый порядок сетей (Роснефть, Лукойл, Газпромнефть, Татнефть, Нефтьмагистраль, Teboil).
  const main = result.filter((r) => r.name !== "Прочие").sort((a, b) => netOrderIndex(a.name) - netOrderIndex(b.name));
  return [...main, ...others];
}

/** Столбцы «АЗС по сетевым»: группы матвью в едином порядке (6 сетей + «Прочие»).
 *  open/no_fuel/closed и total — прямо из матвью; index = share_open_azs.
 *  При type='other' столбец «Прочие» скрываем (как раньше). */
export function registryNets(reg: RegistryData, type: StationType): StatusRow[] {
  // Набор колец блока «АЗС по сетевым компаниям» зависит от фильтра:
  //   ВИНК → только 4 ВИНК; Прочие → один агрегат «Прочие»; иначе — все сети + «Прочие».
  const names =
    type === "vink" ? NET_ORDER.filter(isVink)
      : type === "other" ? ["Прочие"]
        : [...NET_ORDER, "Прочие"];
  return names
    .map((name) => ({ name, s: reg.nets[name] }))
    .filter((x): x is { name: string; s: NetSummary } => !!x.s && x.s.total > 0)
    .map(({ name, s }) => ({ name, open: s.open, noFuel: s.no_fuel, closed: s.closed_other, total: s.total, index: s.index }));
}

// ——— Очереди ———

const Z4: QueueCounts4 = [0, 0, 0, 0];
const add4 = (a: QueueCounts4, b: QueueCounts4): QueueCounts4 => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];

/** Вектор очереди за час под фильтр (сеть/тип/все). */
function pickQ(h: HourlyPoint, f: NetFilter): QueueCounts4 {
  if (!h.q) return Z4;
  if (!f.net && f.type === "all") return h.q.c;
  let a: QueueCounts4 = [0, 0, 0, 0];
  for (const [name, v] of Object.entries(h.q.nets)) {
    if (netMatches(name, f)) a = add4(a, v);
  }
  return a;
}

/** Очереди по дням: доля АЗС с очередью и разбивка по уровням под фильтр. */
export function queuesByDay(sel: HourlyPoint[], f: NetFilter): QueueDay[] {
  const m = new Map<string, QueueCounts4>();
  for (const h of sel) {
    const d = h.key.slice(0, 10);
    m.set(d, add4(m.get(d) ?? Z4, pickQ(h, f)));
  }
  return [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, v]) => {
    const [obs, l1, l2, l3] = v;
    const queue = l1 + l2 + l3;
    return { key: d, obs, l1, l2, l3, queue, share: obs ? r1((queue / obs) * 100) : 0 };
  });
}

/** Сети с очередями (в рамках типа) — для фильтра, по убыванию суммарной очереди. */
export function queueNets(sel: HourlyPoint[], type: StationType, topN = 6): QueueNet[] {
  const m = new Map<string, QueueCounts4>();
  for (const h of sel) {
    if (!h.q) continue;
    for (const [name, v] of Object.entries(h.q.nets)) {
      if (!netMatches(name, { net: null, type })) continue;
      m.set(name, add4(m.get(name) ?? Z4, v));
    }
  }
  return [...m.entries()]
    .map(([name, v]) => {
      const queue = v[1] + v[2] + v[3];
      return { name, obs: v[0], queue, share: v[0] ? r1((queue / v[0]) * 100) : 0 };
    })
    .filter((n) => n.queue > 0)
    .sort((a, b) => b.queue - a.queue)
    .slice(0, topN);
}

// ——— KPI (последний срез матвью) под фильтр ———

/** Имя группы матвью (torg_net_group) для текущего фильтра. Кнопки фильтра 1:1
 *  с группами: «Все» / 6 сетей / ВИНК / Прочие → выбираем готовую строку матвью. */
export function filterGroup(f: NetFilter): string {
  if (f.net) return f.net;
  if (f.type === "vink") return "ВИНК";
  if (f.type === "other") return "Прочие";
  if (f.type === "nezavis") return "Нефтьмагистраль";
  return "Все";
}

/** Сводка выбранной группы — прямо из матвью (без клиентской агрегации). */
export function selectSummary(reg: RegistryData, f: NetFilter): NetSummary {
  const g = filterGroup(f);
  return g === "Все" ? reg.all : (reg.nets[g] ?? reg.all);
}

// ——— Цены под фильтр ———

export function selectPrices(all: FuelPrice[], byNet: Record<string, FuelPrice[]>, f: NetFilter): FuelPrice[] {
  if (!f.net && f.type === "all") return all;
  const acc = new Map<string, { label: string; color: string; sum: number; count: number }>();
  for (const [net, list] of Object.entries(byNet)) {
    if (!netMatches(net, f)) continue;
    for (const p of list) {
      const e = acc.get(p.code) ?? { label: p.label, color: p.color, sum: 0, count: 0 };
      e.sum += p.avg * p.count; e.count += p.count;
      acc.set(p.code, e);
    }
  }
  return all
    .map((a) => {
      const e = acc.get(a.code);
      return e && e.count
        ? { code: a.code, label: e.label, color: e.color, avg: r1(e.sum / e.count), count: e.count }
        : null;
    })
    .filter((x): x is FuelPrice => x !== null);
}

export function dateBounds(hourly: HourlyPoint[]): { min: string; max: string } {
  const days = hourly.map((h) => h.key.slice(0, 10));
  return { min: days[0] ?? "", max: days[days.length - 1] ?? "" };
}

/**
 * Окно из `days` календарных дней, ЗАКАНЧИВАЮЩЕЕСЯ на `end` (включительно): [end-(days-1) … end].
 * Точки уже отсортированы по возрастанию ключа 'YYYY-MM-DD' (лексикографика = хронология).
 * Пустой `end` → окно от последнего дня данных (дефолт «последние N дней»). Для графиков «Дни».
 */
export function windowByEnd<T extends { key: string }>(points: T[], end: string, days = 7): T[] {
  if (!points.length) return points;
  const e = end || points[points.length - 1].key;
  const [y, m, d] = e.split("-").map(Number);
  const s = new Date(Date.UTC(y, m - 1, d) - (days - 1) * 86_400_000);
  const start = `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`;
  return points.filter((p) => p.key >= start && p.key <= e);
}
