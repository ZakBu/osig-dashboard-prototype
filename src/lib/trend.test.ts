import { describe, it, expect } from "vitest";
import { selectSummary, registryNets, filterGroup, bandPeriodLabel } from "./trend";
import type { NetSummary, RegistryData } from "./types";

// Значения — как в матвью (счётчики + доли). index=share_open_azs.
const N = (total: number, open: number, no_fuel: number, closed_other: number): NetSummary => ({
  total, open, no_fuel, closed_other,
  index: total ? Math.round((open / total) * 1000) / 10 : 0,
  avail3: open, availAllday: open, nonAvailAllday: 0, open_full: 0, open_partial: 0,
  noz_full: { g92: 0, g95: 0, g100: 0, gdt: 0 }, noz_partial: { g92: 0, g95: 0, g100: 0, gdt: 0 },
  bak: 0, no_canister: 0, queue: 0,
  shareOpen: total ? Math.round((open / total) * 1000) / 10 : 0,
  shareNoFuel: null, shareClosed: null, shareQueue: null,
  shareAvailAllday: null, shareNonAvailAllday: null, shareLimitTank: null, shareLimitCanister: null,
  guns: null, gunsFull: null, gunsPartial: null,
  closed3h: null, closed6h: null, closed9h: null, closed12h: null,
});

// Группы torg_net_group — как в матвью 27166 (включая агрегаты «ВИНК»/«Прочие»/«Все»).
const reg: RegistryData = {
  region: "Москва",
  all: N(200, 100, 80, 20),
  nets: {
    Роснефть: N(60, 40, 15, 5),
    Лукойл: N(50, 30, 15, 5),
    ВИНК: N(110, 70, 30, 10),
    Teboil: N(20, 10, 8, 2),
    Нефтьмагистраль: N(30, 15, 10, 5),
    Прочие: N(40, 15, 22, 3),
  },
};

describe("filterGroup: кнопка фильтра → группа матвью", () => {
  it("Все / сеть / ВИНК / Прочие", () => {
    expect(filterGroup({ net: null, type: "all" })).toBe("Все");
    expect(filterGroup({ net: "Лукойл", type: "all" })).toBe("Лукойл");
    expect(filterGroup({ net: null, type: "vink" })).toBe("ВИНК");
    expect(filterGroup({ net: null, type: "other" })).toBe("Прочие");
  });
});

describe("selectSummary — строка группы из матвью (без клиентской агрегации)", () => {
  it("type=all → reg.all", () => {
    expect(selectSummary(reg, { net: null, type: "all" })).toEqual(reg.all);
  });
  it("конкретная сеть → её строка", () => {
    expect(selectSummary(reg, { net: "Лукойл", type: "all" })).toEqual(reg.nets.Лукойл);
  });
  it("type=vink → готовая группа «ВИНК»", () => {
    expect(selectSummary(reg, { net: null, type: "vink" })).toEqual(reg.nets.ВИНК);
  });
  it("type=other → готовая группа «Прочие»", () => {
    expect(selectSummary(reg, { net: null, type: "other" })).toEqual(reg.nets.Прочие);
  });
});

describe("registryNets — столбцы из групп матвью в едином порядке", () => {
  it("type=all: 6 сетей (что есть) + «Прочие», без агрегата «ВИНК»", () => {
    const names = registryNets(reg, "all").map((r) => r.name);
    expect(names).toEqual(["Роснефть", "Лукойл", "Нефтьмагистраль", "Teboil", "Прочие"]);
    expect(names).not.toContain("ВИНК");
  });
  it("type=vink: только ВИНК (в едином порядке), без Нефтьмагистраль/Teboil/Прочие", () => {
    const names = registryNets(reg, "vink").map((r) => r.name);
    expect(names).toEqual(["Роснефть", "Лукойл"]); // Газпромнефть/Татнефть отсутствуют в фикстуре
    expect(names).not.toContain("Прочие");
    expect(names).not.toContain("Нефтьмагистраль");
    expect(names).not.toContain("Teboil");
  });
  it("type=other: один агрегат «Прочие»", () => {
    const names = registryNets(reg, "other").map((r) => r.name);
    expect(names).toEqual(["Прочие"]);
  });
});

describe("bandPeriodLabel (полоса времени суток, МСК = UTC+3)", () => {
  it("снимок 06:00Z → МСК 09:00 → полоса 06:00-09:00", () => {
    expect(bandPeriodLabel("2026-07-02T06:00:00.000Z")).toBe("02.07.2026, 06:00 - 09:00");
  });
  it("снимок 09:00Z → МСК 12:00 → полоса 09:00-12:00", () => {
    expect(bandPeriodLabel("2026-07-02T09:00:00.000Z")).toBe("02.07.2026, 09:00 - 12:00");
  });
  it("снимок 00:00Z → МСК 03:00 → полоса 00:00-06:00", () => {
    expect(bandPeriodLabel("2026-07-02T00:00:00.000Z")).toBe("02.07.2026, 00:00 - 06:00");
  });
  it("полночь МСК (21:00Z) → полоса 21:00-00:00, дата следующего дня", () => {
    expect(bandPeriodLabel("2026-07-01T21:00:00.000Z")).toBe("02.07.2026, 21:00 - 00:00");
  });
});
