import { describe, expect, it } from "vitest";
import {
  buildCarrierEfficiencySeries,
  carrierEfficiencyAxisMax,
  CARRIER_POINT_COLOR,
  CARRIER_SCATTER_LIMIT,
  selectCarrierEfficiencyRows,
} from "./waste-dashboard-visuals";
import type { AnalyticsRankingRow, CarrierEfficiencyAverage } from "./waste";

const rows: AnalyticsRankingRow[] = [
  { name: "Альфа", trips: 20, mass: 120, vehicles: 4 },
  { name: "Бета", trips: 10, mass: 60, vehicles: 2 },
  { name: "Без массы", trips: 8, mass: null, vehicles: 1 },
];

const average: CarrierEfficiencyAverage = {
  name: "Среднее по всем перевозчикам",
  trips: 15,
  mass: 90,
  vehicles: 3,
  carriers: 2,
};

describe("carrier efficiency visual preparation", () => {
  it("uses the same valid carrier population as the benchmark when no filter is selected", () => {
    expect(selectCarrierEfficiencyRows(rows, []).map((row) => row.name)).toEqual(["Альфа", "Бета"]);
  });

  it("limits the unfiltered cloud to the first 50 valid carriers", () => {
    const manyRows = Array.from({ length: 75 }, (_, index): AnalyticsRankingRow => ({
      name: `Перевозчик ${index + 1}`,
      trips: 100 - index,
      mass: 500 - index,
      vehicles: 1,
    }));
    const selected = selectCarrierEfficiencyRows(manyRows, []);
    expect(selected).toHaveLength(CARRIER_SCATTER_LIMIT);
    expect(selected.at(-1)?.name).toBe("Перевозчик 50");
  });

  it("keeps only selected carriers without admitting rows without known mass", () => {
    expect(selectCarrierEfficiencyRows(rows, ["Бета", "Без массы"]).map((row) => row.name)).toEqual(["Бета"]);
  });

  it("builds one lightweight carrier series plus a separate benchmark series", () => {
    const topAverage = { ...average, name: "Среднее по топ-50 перевозчикам" };
    const series = buildCarrierEfficiencySeries(rows.slice(0, 2), average, topAverage);
    expect(series).toHaveLength(3);
    expect(series[0].data).toHaveLength(2);
    expect(series[0].data[0]).toMatchObject({ x: 20, y: 120, fillColor: CARRIER_POINT_COLOR });
    expect(series[1].data).toEqual([{ x: 15, y: 90 }]);
    expect(series[2].name).toBe("Среднее по топ-50 перевозчикам");
  });

  it("keeps zero in view and leaves enough room around the benchmark", () => {
    expect(carrierEfficiencyAxisMax(rows.slice(0, 2), average, "trips")).toBe(30);
    expect(carrierEfficiencyAxisMax(rows.slice(0, 2), average, "mass")).toBe(180);
  });
});
