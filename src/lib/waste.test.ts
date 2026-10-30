import { describe, expect, it } from "vitest";
import { formatNumber, latestPeriod, statusColor, trendLabel, wasteFiltersPath } from "./waste";

describe("waste dashboard helpers", () => {
  it("builds the latest inclusive period without crossing the available minimum", () => {
    expect(latestPeriod("2026-07-16", 7)).toEqual({ from: "2026-07-10", to: "2026-07-16" });
    expect(latestPeriod("2026-07-04", 7, "2026-07-02")).toEqual({ from: "2026-07-02", to: "2026-07-04" });
  });

  it("formats chart values and buckets", () => {
    expect(formatNumber(127136.38, 2)).toBe("127 136,38");
    expect(formatNumber(null)).toBe("—");
    expect(trendLabel("2026-07-09", "day")).toBe("09.07");
    expect(trendLabel("2026-07-09T13:00:00", "hour")).toBe("13:00");
    expect(statusColor("Завершен")).toBe("#43be6b");
    expect(statusColor("Отменено")).toBe("#d45155");
    expect(statusColor("Перевозка")).toBe("#ef8b42");
    expect(statusColor("Подача")).toBe("#d8bd36");
    expect(statusColor("Разгрузка подтверждена")).toBe("#4d8ee8");
  });

  it("encodes dependent filter values without losing punctuation", () => {
    expect(wasteFiltersPath(
      { from: "2026-07-09", to: "2026-07-16" },
      { carriers: ['ООО "Тест, плюс"'], origins: ["Объект А"], wasteCodes: ["W 1"] },
    )).toBe("/api/waste/filters?from=2026-07-09&to=2026-07-16&carriers=%D0%9E%D0%9E%D0%9E+%22%D0%A2%D0%B5%D1%81%D1%82%2C+%D0%BF%D0%BB%D1%8E%D1%81%22&origins=%D0%9E%D0%B1%D1%8A%D0%B5%D0%BA%D1%82+%D0%90&wasteCodes=W+1");
  });
});
