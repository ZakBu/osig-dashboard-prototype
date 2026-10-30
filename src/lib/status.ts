/**
 * Единая классификация состояния АЗС в три корзины — как на дашборде.
 * Чистые функции без зависимостей: используется и в ingest-скрипте, и во фронте.
 *
 * Сырые значения `sostoyanie_azs` из выгрузки:
 *   «Открыта»                      → open
 *   «Закрыта, нет топлива»         → no_fuel
 *   «Закрыта на ремонт»            → closed_other
 *   «Закрыта»                      → closed_other
 *   «Закрыта в рамках КРТ»         → closed_other
 *   «Закрыта из-за нерентабельности» → closed_other
 */

export type StatusBucket = "open" | "no_fuel" | "closed_other";

export const BUCKETS: StatusBucket[] = ["open", "no_fuel", "closed_other"];

export function toBucket(raw: string | null | undefined): StatusBucket {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "открыта") return "open";
  if (s.includes("нет топлива")) return "no_fuel";
  // всё остальное «Закрыта …» — закрыто по прочим причинам
  return "closed_other";
}

export const BUCKET_LABEL: Record<StatusBucket, string> = {
  open: "Доступно для заправки",
  no_fuel: "Закрыто, нет топлива",
  closed_other: "Закрыто постоянно",
};

/** Короткие подписи для легенд и осей, где длинные не помещаются. */
export const BUCKET_SHORT: Record<StatusBucket, string> = {
  open: "Открыто",
  no_fuel: "Закрыто, нет топлива",
  closed_other: "Закрыто постоянно",
};

/** Имена цветов Tremor (совпадают с safelist в tailwind.config). */
export const BUCKET_COLOR: Record<StatusBucket, string> = {
  open: "emerald",
  no_fuel: "rose",
  closed_other: "violet",
};

/** HEX тех же цветов — для кастомных вьюх (тепловая карта, чипы). */
export const BUCKET_HEX: Record<StatusBucket, string> = {
  open: "#10b981",
  no_fuel: "#f43f5e",
  closed_other: "#8b5cf6",
};
