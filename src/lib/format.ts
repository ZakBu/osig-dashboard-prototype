/** Форматирование чисел/процентов в ru-RU (запятая, неразрывные пробелы). */

const nf = new Intl.NumberFormat("ru-RU");

export const fmtInt = (n: number | null | undefined): string =>
  n == null ? "—" : nf.format(Math.round(n));

/** «83,8%» */
export const fmtPct1 = (n: number | null | undefined): string =>
  n == null ? "—" : `${n.toFixed(1).replace(".", ",")}%`;

/** Подпись дельты в процентных пунктах: «+4,7 п.п.» */
export const fmtPP = (n: number | null | undefined): string => {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(1).replace(".", ",")} п.п.`;
};

/** Подпись «62 (12,1%)» для абсолютного прироста. */
export const fmtDelta = (abs: number | null, pct: number | null): string => {
  if (abs == null) return "—";
  const sign = abs > 0 ? "+" : abs < 0 ? "−" : "";
  const a = `${sign}${fmtInt(Math.abs(abs))}`;
  if (pct == null) return a;
  return `${a} (${Math.abs(pct).toFixed(1).replace(".", ",")}%)`;
};

const MONTHS = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

/** «26 июн» из ключа 'YYYY-MM-DD' (без парсинга Date — детерминированно). */
export const fmtDay = (key: string): string => {
  const [, m, d] = key.split("T")[0].split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
};

/** «10:00» из ключа 'YYYY-MM-DDTHH:00'. */
export const fmtHour = (key: string): string => {
  const t = key.split("T")[1];
  return t ? t.slice(0, 5) : key;
};

export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
