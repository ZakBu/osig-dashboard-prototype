import type { AnalyticsRankingRow, CarrierEfficiencyAverage } from "./waste";

export const CARRIER_POINT_COLOR = "#3d8bfd";
export const CARRIER_BENCHMARK_COLOR = "#edf2f8";
export const CARRIER_TOP_BENCHMARK_COLOR = "#e7b84b";
export const CARRIER_SCATTER_LIMIT = 50;

export type CarrierScatterPoint = {
  x: number;
  y: number;
  fillColor?: string;
};

export function selectCarrierEfficiencyRows(
  rows: AnalyticsRankingRow[],
  selectedCarriers: string[],
) {
  const valid = rows.filter((row) => row.mass != null && row.mass > 0);
  if (!selectedCarriers.length) return valid.slice(0, CARRIER_SCATTER_LIMIT);
  const selected = new Set(selectedCarriers);
  return valid.filter((row) => selected.has(row.name)).slice(0, CARRIER_SCATTER_LIMIT);
}

export function carrierEfficiencyAxisMax(
  rows: AnalyticsRankingRow[],
  average: CarrierEfficiencyAverage | null,
  key: "trips" | "mass",
) {
  const values = rows.map((row) => key === "trips" ? row.trips : row.mass ?? 0);
  const benchmark = average ? (key === "trips" ? average.trips : average.mass ?? 0) : 0;
  if (!values.length && benchmark <= 0) return undefined;
  return Math.ceil(Math.max(Math.max(0, ...values) * (key === "trips" ? 1.06 : 1.08), benchmark * 2));
}

export function buildCarrierEfficiencySeries(
  rows: AnalyticsRankingRow[],
  average: CarrierEfficiencyAverage | null,
  topAverage: CarrierEfficiencyAverage | null = null,
) {
  return [
    {
      name: "Перевозчики",
      data: rows.map((row): CarrierScatterPoint => ({
        x: row.trips,
        y: row.mass ?? 0,
        fillColor: CARRIER_POINT_COLOR,
      })),
    },
    ...(average ? [{
      name: average.name,
      data: [{ x: average.trips, y: average.mass ?? 0 }],
    }] : []),
    ...(topAverage ? [{
      name: topAverage.name,
      data: [{ x: topAverage.trips, y: topAverage.mass ?? 0 }],
    }] : []),
  ];
}
