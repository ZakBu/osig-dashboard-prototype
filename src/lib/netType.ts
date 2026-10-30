/**
 * Классификация АЗС по типу владельца:
 *  • ВИНК — вертикально-интегрированные нефтяные компании (добыча→розница):
 *    Роснефть, Лукойл, Газпромнефть, Татнефть, Башнефть, Газпром, Teboil (Лукойл).
 *  • НезАЗС — независимые сети (Нефтьмагистраль, Трасса, Эверон и прочие).
 */
// ВИНК в рамках задачи — 4 крупнейшие сети.
export const VINK = new Set<string>([
  "Лукойл",
  "Газпромнефть",
  "Роснефть",
  "Татнефть",
]);

export const isVink = (net: string): boolean => VINK.has(net);

/** НезАЗС — в рамках нашей задачи это только Нефтьмагистраль. */
export const NEZAVIS = new Set<string>(["Нефтьмагистраль"]);

/**
 * «Прочие» — агрегат всех сетей, КРОМЕ выделенных в отдельные группы:
 * ВИНК (4 сети), Нефтьмагистраль и Teboil. То есть все мелкие/независимые сети,
 * не попавшие в именованные группы верхней панели фильтра.
 */
export const NAMED_NETS = new Set<string>([...VINK, "Нефтьмагистраль", "Teboil"]);
export const isOther = (net: string): boolean => !NAMED_NETS.has(net);

/** Единый порядок сетей во ВСЕХ блоках (фильтры, графики, столбцы). «Прочие» — всегда последний. */
export const NET_ORDER = ["Роснефть", "Лукойл", "Газпромнефть", "Татнефть", "Нефтьмагистраль", "Teboil"] as const;

/** Индекс сети в едином порядке (неизвестные — в конец, перед «Прочие»). */
export const netOrderIndex = (name: string): number => {
  const i = (NET_ORDER as readonly string[]).indexOf(name);
  return i < 0 ? NET_ORDER.length : i;
};

/** Тип станций для глобального переключателя. */
export type StationType = "all" | "vink" | "nezavis" | "other";

/** Глобальный фильтр: конкретная сеть (приоритетнее) или тип. */
export type NetFilter = { net: string | null; type: StationType };

export const EMPTY_FILTER: NetFilter = { net: null, type: "all" };

/** Подходит ли сеть под фильтр (net приоритетнее type). */
export function netMatches(name: string, f: NetFilter): boolean {
  if (f.net) return name === f.net;
  if (f.type === "all") return true;
  if (f.type === "vink") return isVink(name);
  if (f.type === "other") return isOther(name);
  return NEZAVIS.has(name); // НезАЗС = только Нефтьмагистраль
}

/** Человекочитаемая подпись активного фильтра. */
export function filterLabel(f: NetFilter): string {
  if (f.net) return f.net;
  if (f.type === "vink") return "ВИНК";
  if (f.type === "nezavis") return "НезАЗС";
  if (f.type === "other") return "Прочие";
  return "Все АЗС";
}
