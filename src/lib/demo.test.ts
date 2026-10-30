import { describe, it, expect } from 'vitest';
import { demoFetch } from './demo';
import type { WasteDashboard, WasteTripsPage } from './waste';
const period = { from: '2026-10-17', to: '2026-10-30' };
async function dashboard(filters = {}, granularity = 'day'): Promise<WasteDashboard> {
  return (await demoFetch('/api/waste/dashboard', { body: JSON.stringify({ period, filters, granularity }) })).json();
}
describe('demonstration dataset', () => {
  it('provides 14 populated days with coherent totals and comparison', async () => {
    const data = await dashboard();
    expect(data.trends.trips).toHaveLength(14);
    expect(data.trends.trips.every(r => r.value > 0)).toBe(true);
    expect(new Set(data.trends.trips.map(r => r.value)).size).toBeGreaterThan(8);
    expect(data.trends.trips.reduce((s, r) => s + r.value, 0)).toBe(data.metrics.trips.value);
    expect(data.wasteStructure.reduce((s, r) => s + r.tons, 0)).toBeCloseTo(data.metrics.mass.value!, 5);
    expect(data.metrics.trips.changePct).toBeGreaterThan(0);
    expect(data.comparisonPeriod).toEqual({ from: '2026-10-03', to: '2026-10-16' });
    expect(data.analytics.carrierEfficiencyAverage).not.toBeNull();
    expect(new Set(data.analytics.trends.averageMass.map(r => r.value)).size).toBe(14);
  });
  it('filters records consistently across charts and paginated trips', async () => {
    const filters = { carriers: ['Вектор Транс'] };
    const data = await dashboard(filters, 'hour');
    const trips: WasteTripsPage = await (await demoFetch('/api/waste/trips', { body: JSON.stringify({ period, filters, page: 1, pageSize: 25 }) })).json();
    expect(trips.total).toBe(data.metrics.trips.value);
    expect(trips.rows.every(r => r.carrier === 'Вектор Транс')).toBe(true);
    expect(data.trends.trips).toHaveLength(14 * 24);
    expect(data.trends.trips.reduce((s, r) => s + r.value, 0)).toBe(trips.total);
    expect(trips.rows[0].submittedAt >= trips.rows[1].submittedAt).toBe(true);
  });
});
