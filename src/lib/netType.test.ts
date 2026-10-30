import { describe, it, expect } from "vitest";
import { isVink, isOther, netMatches, filterLabel, type NetFilter } from "./netType";

describe("классификация сетей", () => {
  it("isVink — только 4 ВИНК", () => {
    for (const n of ["Лукойл", "Газпромнефть", "Роснефть", "Татнефть"]) expect(isVink(n)).toBe(true);
    for (const n of ["Teboil", "Нефтьмагистраль", "Эверон", "Трасса"]) expect(isVink(n)).toBe(false);
  });

  it("isOther — всё, кроме ВИНК, Нефтьмагистрали и Teboil", () => {
    for (const n of ["Эверон", "Трасса", "GetPetrol", "Asco"]) expect(isOther(n)).toBe(true);
    for (const n of ["Лукойл", "Роснефть", "Teboil", "Нефтьмагистраль"]) expect(isOther(n)).toBe(false);
  });
});

describe("netMatches", () => {
  const f = (p: Partial<NetFilter>): NetFilter => ({ net: null, type: "all", ...p });

  it("конкретная сеть приоритетнее типа", () => {
    expect(netMatches("Лукойл", f({ net: "Лукойл", type: "vink" }))).toBe(true);
    expect(netMatches("Роснефть", f({ net: "Лукойл", type: "vink" }))).toBe(false);
  });

  it("type=all — совпадает всё", () => {
    for (const n of ["Лукойл", "Эверон", "Teboil"]) expect(netMatches(n, f({ type: "all" }))).toBe(true);
  });

  it("type=vink — только ВИНК", () => {
    expect(netMatches("Лукойл", f({ type: "vink" }))).toBe(true);
    expect(netMatches("Teboil", f({ type: "vink" }))).toBe(false);
    expect(netMatches("Эверон", f({ type: "vink" }))).toBe(false);
  });

  it("type=other — исключает ВИНК/Нефтьмагистраль/Teboil", () => {
    expect(netMatches("Эверон", f({ type: "other" }))).toBe(true);
    expect(netMatches("Лукойл", f({ type: "other" }))).toBe(false);
    expect(netMatches("Teboil", f({ type: "other" }))).toBe(false);
    expect(netMatches("Нефтьмагистраль", f({ type: "other" }))).toBe(false);
  });

  it("vink и other не пересекаются и вместе с Teboil/НМ покрывают всё", () => {
    const nets = ["Лукойл", "Роснефть", "Газпромнефть", "Татнефть", "Teboil", "Нефтьмагистраль", "Эверон", "Трасса", "Asco"];
    for (const n of nets) {
      const vink = netMatches(n, f({ type: "vink" }));
      const other = netMatches(n, f({ type: "other" }));
      expect(vink && other).toBe(false); // непересекающиеся
      const named = vink || n === "Teboil" || n === "Нефтьмагистраль";
      expect(named || other).toBe(true); // покрытие
    }
  });
});

describe("filterLabel", () => {
  it("подписи по фильтру", () => {
    expect(filterLabel({ net: "Лукойл", type: "all" })).toBe("Лукойл");
    expect(filterLabel({ net: null, type: "vink" })).toBe("ВИНК");
    expect(filterLabel({ net: null, type: "other" })).toBe("Прочие");
    expect(filterLabel({ net: null, type: "all" })).toBe("Все АЗС");
  });
});
