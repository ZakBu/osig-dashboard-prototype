import { origins, receptions, rows } from './demo';
import type { WasteSelection } from './waste';
export const constructionTypes = ['Жилищное', 'Транспортное', 'Социальное', 'Промышленное', 'Благоустройство'];
export const financingTypes = ['Бюджетное', 'Внебюджетное', 'Смешанное'];
export const originRegistry = [...origins, 'ЖК «Тихая гавань»', 'Поликлиника «Рассвет»', 'Мост «Восточный»', 'Сквер «Липовый»'].map((name, i) => ({ name, construction: constructionTypes[i % 5], financing: financingTypes[i % 3] }));
export const vehicleRegistry = [...new Set(rows.map(r => r.vehicle!)), ...Array.from({ length: 32 }, (_, i) => `Резерв ${i + 1}`)];
export const receptionRegistry = [...receptions, 'Резервная площадка «Запад»', 'Экоцентр «Вектор»'];
export type Period = { from: string; to: string; start: string; end: string };
export type ObjectFilters = { activity: string; construction: string; financing: string };
const DAY = 86400000;
const performed = (status: string) => ['Завершен', 'Перевозка', 'На взвешивание', 'Разгрузка'].includes(status);
export function moscowToday(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function initialPeriod(weekly = false, today = moscowToday()): Period {
  return { from: weekly ? new Date(Date.parse(today) - 6 * DAY).toISOString().slice(0, 10) : today, to: today, start: '00:00', end: '23:59' };
}
export function validPeriod(p: Period) { return !!p.from && !!p.to && !!p.start && !!p.end && `${p.from}T${p.start}` <= `${p.to}T${p.end}`; }
export function selectTrips(period: Period, filters: WasteSelection) {
  return rows.filter(r => r.submittedAt >= `${period.from}T${period.start}:00` && r.submittedAt <= `${period.to}T${period.end}:59` && (!filters.carriers.length || filters.carriers.includes(r.carrier!)) && (!filters.origins.length || filters.origins.includes(r.originName!)) && (!filters.wasteCodes.length || filters.wasteCodes.includes(r.wasteCode!)));
}
export function operationStats(period: Period, filters: WasteSelection) {
  const trips = selectTrips(period, filters);
  const days = Math.round((Date.parse(period.to) - Date.parse(period.from)) / DAY) + 1;
  const executed = trips.filter(r => performed(r.status));
  const active = (key: 'originName' | 'destinationName' | 'vehicle') => new Set(executed.map(r => r[key])).size;
  const known = trips.filter(r => r.status === 'Завершен' && r.cargoMass !== null);
  return { trips: trips.length, mass: known.reduce((s, r) => s + r.cargoMass!, 0), distance: trips.length ? trips.reduce((s, r) => s + r.distanceKm, 0) / trips.length : null,
    average: trips.length / days, perVehicle: trips.length ? trips.length / new Set(trips.map(r => r.vehicle)).size : null,
    activeOrigins: active('originName'), activeVehicles: active('vehicle'), activeReceptions: active('destinationName'),
    daily: Array.from({ length: Math.min(days, 366) }, (_, i) => { const day = new Date(Date.parse(period.from) + i * DAY).toISOString().slice(0, 10); return { day, count: trips.filter(r => r.submittedAt.startsWith(day)).length }; }) };
}
export function objectsForPeriod(period: Period, filters: WasteSelection, objectFilters: ObjectFilters) {
  const trips = selectTrips(period, filters).filter(r => performed(r.status));
  return originRegistry.filter(o => (!filters.origins.length || filters.origins.includes(o.name)) && (!objectFilters.construction || o.construction === objectFilters.construction) && (!objectFilters.financing || o.financing === objectFilters.financing))
    .map(o => ({ ...o, trips: trips.filter(r => r.originName === o.name).length }))
    .filter(o => !objectFilters.activity || (objectFilters.activity === 'active' ? o.trips > 0 : o.trips === 0));
}
