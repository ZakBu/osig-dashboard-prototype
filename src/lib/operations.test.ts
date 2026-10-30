import { describe, expect, it } from 'vitest';
import { initialPeriod, moscowToday, operationStats, selectTrips, objectsForPeriod, originRegistry, validPeriod } from './operations';
const selection = { carriers: [], origins: [], wasteCodes: [] };
describe('operational periods and resources', () => {
  it('defaults to full Moscow day and seven calendar days', () => {
    expect(moscowToday(new Date('2026-10-29T22:00:00Z'))).toBe('2026-10-30');
    expect(initialPeriod(false, '2026-10-30')).toEqual({ from: '2026-10-30', to: '2026-10-30', start: '00:00', end: '23:59' });
    expect(initialPeriod(true, '2026-10-30').from).toBe('2026-10-24');
    expect(validPeriod({ from: '2026-10-30', to: '2026-10-30', start: '12:00', end: '09:00' })).toBe(false);
  });
  it('applies inclusive time filters and consistent daily totals', () => {
    const period = initialPeriod(true, '2026-10-30');
    const stats = operationStats(period, selection);
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily.reduce((s, r) => s + r.count, 0)).toBe(stats.trips);
    expect(stats.average).toBe(stats.trips / 7);
    const narrow = { ...period, from: period.to, start: '08:00', end: '10:00' };
    const trips = selectTrips(narrow, selection);
    expect(trips.length).toBeGreaterThan(0);
    expect(trips.every(r => r.submittedAt >= '2026-10-30T08:00:00' && r.submittedAt <= '2026-10-30T10:00:59')).toBe(true);
    expect(trips.length).toBeLessThan(operationStats(initialPeriod(false, '2026-10-30'), selection).trips);
  });
  it('filters the full OO registry including objects without trips', () => {
    const period = initialPeriod(false, '2026-10-30');
    const all = objectsForPeriod(period, selection, { activity: '', construction: '', financing: '' });
    const inactive = objectsForPeriod(period, selection, { activity: 'inactive', construction: '', financing: '' });
    expect(all.length).toBe(originRegistry.length);
    expect(inactive.length).toBeGreaterThan(0);
    expect(inactive.every(o => o.trips === 0)).toBe(true);
    const filtered = objectsForPeriod(period, selection, { activity: '', construction: 'Жилищное', financing: 'Бюджетное' });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(o => o.construction === 'Жилищное' && o.financing === 'Бюджетное')).toBe(true);
    const emptyDay = initialPeriod(false, '2026-11-01');
    expect(operationStats(emptyDay, selection).distance).toBeNull();
    expect(operationStats(emptyDay, selection).activeOrigins).toBe(0);
  });
});
