import type { WasteDashboard, WasteTrip, WasteSelection, AnalyticsRankingRow } from './waste';
const DAY = 86_400_000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const availablePeriod = { from: '2026-10-17', to: '2026-10-30' };
// Fictional names and a fixed seed keep shared demos reproducible.
const carriers = ['Вектор Транс', 'ЭкоЛогистика', 'Городской поток', 'Ресурс Экспресс', 'Магистраль Эко', 'СеверТранс', 'Контур Рециклинг', 'Чистый маршрут', 'Атлас Карго', 'Новая среда'];
export const origins = ['ЖК «Речной квартал»', 'Реконструкция набережной', 'Метро «Янтарная»', 'Бизнес-парк «Орбита»', 'Развязка Южная', 'ЖК «Сосновый берег»', 'Школа в Новом районе', 'Демонтаж цеха № 4', 'Спорткомплекс «Волна»', 'Трамвайное депо', 'Парк «Зелёный мыс»', 'Технопарк «Спектр»'];
export const receptions = ['Экотехнопарк «Горизонт»', 'Комплекс «Второй цикл»', 'Площадка «Северная»', 'Переработка «Минерал»', 'Сортировочный центр «Восток»', 'Комплекс «Ресурс»', 'Площадка «Южная»', 'Экоцентр «Контур»'];
const wasteTypes = [{ code: '31400000000', name: 'Грунт' }, { code: '82200000000', name: 'Бетон и железобетон' }, { code: '83000000000', name: 'Кирпичный бой' }, { code: '82400000000', name: 'Асфальт' }, { code: '89000000000', name: 'Смешанные строительные отходы' }, { code: '30500000000', name: 'Древесина' }, { code: '46100000000', name: 'Металлолом' }, { code: '92000000000', name: 'Растительные отходы' }];
const statuses = ['Завершен', 'Перевозка', 'Подача', 'На взвешивание', 'Разгрузка', 'Отменено'];
let seed = 81273;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const choose = (weights: number[]) => { let x = random() * weights.reduce((s, n) => s + n, 0); return weights.findIndex(n => (x -= n) < 0); };
export const rows: (WasteTrip & { distanceKm: number })[] = [];
for (let d = 0; d < 28; d++) {
  const day = iso(Date.parse('2026-10-03') + d * DAY);
  const weekend = [0, 6].includes(new Date(day).getUTCDay());
  const count = Math.round((weekend ? 145 : 355) * (d >= 14 ? 1.21 : 1) * (0.8 + random() * 0.4) * (d === 22 ? 1.45 : d === 25 ? 0.75 : 1));
  for (let i = 0; i < count; i++) {
    const c = choose(d >= 14 ? [27, 21, 16, 12, 8, 6, 4, 3, 2, 1] : [22, 18, 17, 14, 10, 8, 5, 3, 2, 1]);
    const w = choose([35, 25, 13, d === 22 ? 40 : 12, 8, 4, 2, 1]);
    const hour = choose([1, 1, 1, 1, 2, 5, 11, 18, 29, 33, 28, 17, 14, 24, 31, 35, 27, 19, 12, 8, 5, 3, 2, 1]);
    const status = statuses[choose([d >= 14 ? 90 - c * 1.7 : 80 - c, 5, 3, 2, 2, d === 25 ? 9 : 2])];
    const mass = Math.round(([21, 19, 16, 18, 12, 6, 10, 5][w] * (0.65 + random() * 0.65) * (d >= 14 ? 1.06 : 1)) * 100) / 100;
    const vehicleId = c * 30 + Math.floor(random() * (c < 3 ? 25 : 12));
    const origin = origins[choose([23, 19, 16, 13, 11, 9, 7, 6, 5, 4, 3, 2])];
    const reception = receptions[choose([30, 24, 18, 12, 8, 5, 2, 1])];
    const known = random() > 0.035;
    rows.push({ distanceKm: Math.round((8 + random() * 64 + c * 1.4) * 10) / 10, tripNo: `ДЕМО-${240001 + rows.length}`, submittedAt: `${day}T${String(hour).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}:00`, status,
      vehicle: `${['А', 'В', 'Е', 'К'][vehicleId % 4]}${100 + vehicleId}МР 777`, driver: `${['Александр', 'Михаил', 'Сергей', 'Дмитрий', 'Андрей', 'Илья'][vehicleId % 6]} ${['Волков', 'Орлов', 'Соколов', 'Морозов', 'Белов', 'Лебедев', 'Зайцев'][vehicleId % 7]} (демо)`,
      originObject: origin, originName: origin, destinationObject: reception, destinationName: reception, carrier: carriers[c], maxMass: 32, cargoMass: known ? mass : null, cargoMassRaw: known ? String(mass) : null, wasteCode: wasteTypes[w].code, wasteType: wasteTypes[w].name });
  }
}
rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
const sumMass = (items: WasteTrip[]) => items.filter(r => r.status === 'Завершен').reduce((s, r) => s + (r.cargoMass ?? 0), 0);
const unique = (items: WasteTrip[], key: keyof WasteTrip) => new Set(items.map(r => r[key])).size;
const pct = (part: number, total: number) => total ? part / total * 100 : 0;
const metric = (value: number, previous: number) => ({ value, previous, changePct: previous ? (value - previous) / previous * 100 : null });
function ranking(items: WasteTrip[], key: 'carrier' | 'originName' | 'destinationName'): AnalyticsRankingRow[] {
  return [...new Set(items.map(r => r[key]!))].map(name => { const group = items.filter(r => r[key] === name); return { name, trips: group.length, mass: sumMass(group), vehicles: unique(group, 'vehicle') }; }).sort((a, b) => b.trips - a.trips);
}
function summarize(items: WasteTrip[]) {
  const completed = items.filter(r => r.status === 'Завершен');
  const known = completed.filter(r => r.cargoMass !== null);
  const mass = sumMass(items);
  const top = (key: 'carrier' | 'originName' | 'destinationName') => pct(ranking(items, key).slice(0, 5).reduce((s, r) => s + r.trips, 0), items.length);
  const wasteMass = wasteTypes.map(w => sumMass(items.filter(r => r.wasteCode === w.code))).sort((a, b) => b - a);
  return { completed, known, mass, completedShare: pct(completed.length, items.length), averageMass: known.length ? mass / known.length : 0, tripsPerVehicle: items.length / (unique(items, 'vehicle') || 1), wasteTop5Share: pct(wasteMass.slice(0, 5).reduce((s, n) => s + n, 0), mass), receptionTop5Share: top('destinationName'), originTop5Share: top('originName'), carrierTop5Share: top('carrier') };
}
export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const url = new URL(String(input), 'https://demo.local');
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const period = body.period || { from: url.searchParams.get('from') || availablePeriod.from, to: url.searchParams.get('to') || availablePeriod.to };
  const filters: WasteSelection = body.filters || Object.fromEntries(['carriers', 'origins', 'wasteCodes'].map(k => [k, url.searchParams.getAll(k)]));
  const selected = rows.filter(r => (!filters.carriers?.length || filters.carriers.includes(r.carrier!)) && (!filters.origins?.length || filters.origins.includes(r.originName!)) && (!filters.wasteCodes?.length || filters.wasteCodes.includes(r.wasteCode!)));
  const inPeriod = (from: string, to: string) => selected.filter(r => r.submittedAt.slice(0, 10) >= from && r.submittedAt.slice(0, 10) <= to);
  const filtered = inPeriod(period.from, period.to);
  let data: unknown;
  if (url.pathname.endsWith('/filters')) data = { availablePeriod, carriers, origins, wasteTypes };
  else if (url.pathname.endsWith('/trips')) {
    const page = body.page || 1, pageSize = body.pageSize || 25;
    const trips = filtered.filter(r => !body.interval || (r.submittedAt >= body.interval.from && r.submittedAt < body.interval.to));
    data = { page, pageSize, total: trips.length, totalPages: Math.ceil(trips.length / pageSize), rows: trips.slice((page - 1) * pageSize, page * pageSize) };
  } else {
    const start = Date.parse(period.from), end = Date.parse(period.to), duration = end - start + DAY;
    const comparisonPeriod = { from: iso(start - duration), to: iso(start - DAY) };
    const previous = inPeriod(comparisonPeriod.from, comparisonPeriod.to);
    const current = summarize(filtered), before = summarize(previous);
    const days = Array.from({ length: Math.max(0, Math.min(366, Math.round(duration / DAY))) }, (_, i) => iso(start + i * DAY));
    const buckets = days.flatMap(day => body.granularity === 'hour' ? Array.from({ length: 24 }, (_, h) => `${day}T${String(h).padStart(2, '0')}:00:00`) : [day]);
    const subset = (bucket: string) => filtered.filter(r => body.granularity === 'hour' ? r.submittedAt.slice(0, 13) === bucket.slice(0, 13) : r.submittedAt.slice(0, 10) === bucket);
    const keys = ['averageMass', 'tripsPerVehicle', 'wasteTop5Share', 'receptionTop5Share', 'originTop5Share', 'carrierTop5Share'] as const;
    const daily = days.map(day => ({ day, stats: summarize(filtered.filter(r => r.submittedAt.startsWith(day))) }));
    const carrierRanking = ranking(filtered, 'carrier');
    const average = (items: AnalyticsRankingRow[]) => items.length ? { name: 'В среднем по перевозчикам', carriers: items.length, trips: items.reduce((s, r) => s + r.trips, 0) / items.length, mass: items.reduce((s, r) => s + (r.mass ?? 0), 0) / items.length, vehicles: items.reduce((s, r) => s + r.vehicles, 0) / items.length } : null;
    data = { period, comparisonPeriod, dataThrough: '2026-10-30T23:59:00', metrics: {
      trips: metric(filtered.length, previous.length), completedShare: { ...metric(current.completedShare, before.completedShare), changePp: current.completedShare - before.completedShare, completedTrips: current.completed.length, totalTrips: filtered.length },
      receptionSites: metric(unique(filtered, 'destinationName'), unique(previous, 'destinationName')), carriers: metric(unique(filtered, 'carrier'), unique(previous, 'carrier')), originSites: metric(unique(filtered, 'originName'), unique(previous, 'originName')), vehicles: metric(unique(filtered, 'vehicle'), unique(previous, 'vehicle')),
      mass: { ...metric(current.mass, before.mass), unit: 't', completedTrips: current.completed.length, knownMassTrips: current.known.length, coveragePct: pct(current.known.length, current.completed.length) } },
      statusStructure: statuses.map(status => { const value = filtered.filter(r => r.status === status).length; return { status, ...metric(value, previous.filter(r => r.status === status).length), sharePct: pct(value, filtered.length) }; }),
      wasteStructure: wasteTypes.map(w => { const items = current.completed.filter(r => r.wasteCode === w.code), tons = sumMass(items); return { ...w, tons, trips: items.length, sharePct: pct(tons, current.mass) }; }).sort((a, b) => b.tons - a.tons),
      trends: { trips: buckets.map(bucket => ({ bucket, value: subset(bucket).length })), mass: buckets.map(bucket => { const stats = summarize(subset(bucket)); return { bucket, value: stats.mass, completedTrips: stats.completed.length, knownMassTrips: stats.known.length, coveragePct: pct(stats.known.length, stats.completed.length) }; }) },
      analytics: { metrics: Object.fromEntries(keys.map(k => [k, metric(current[k], before[k])])) as WasteDashboard['analytics']['metrics'], rankings: { carriers: carrierRanking, origins: ranking(filtered, 'originName'), receptions: ranking(filtered, 'destinationName') }, intensity: days.flatMap(day => Array.from({ length: 24 }, (_, hour) => ({ day, hour, trips: filtered.filter(r => r.submittedAt.startsWith(`${day}T${String(hour).padStart(2, '0')}`)).length }))), carrierEfficiency: carrierRanking, carrierEfficiencyAverage: average(carrierRanking), carrierEfficiencyTopAverage: average(carrierRanking.slice(0, 5)), trends: Object.fromEntries(keys.map(k => [k, daily.map(({ day, stats }) => ({ day, value: stats[k] }))])) as WasteDashboard['analytics']['trends'] }
    } satisfies WasteDashboard;
  }
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}
