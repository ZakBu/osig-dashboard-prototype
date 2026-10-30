/**
 * Клиентский токен доступа из «секретной ссылки» (?k=…).
 *
 * Модель безопасности: приложение открывается только по URL с высокоэнтропийным
 * токеном (капабилити-ссылка). Токен кладём в sessionStorage — чтобы пережить
 * SPA-навигацию и подставлять его во ВСЕ защищённые запросы (fetch и <img>/pdf).
 * На cookie не полагаемся (кросс-доменный iframe их часто блокирует). На сервере
 * (SSR) — пусто; валидация токена делается в middleware.ts.
 */
let TOKEN: string | null = null;

function token(): string {
  if (TOKEN !== null) return TOKEN;
  if (typeof window === "undefined") return (TOKEN = "");
  try {
    const k = new URL(window.location.href).searchParams.get("k");
    if (k) sessionStorage.setItem("azs_k", k);
    TOKEN = k || sessionStorage.getItem("azs_k") || "";
  } catch {
    TOKEN = "";
  }
  return TOKEN;
}

/** Добавляет ?k=<токен> к URL (для fetch и src, где нельзя выставить заголовок). */
export const withK = (url: string): string => {
  const t = token();
  if (!t) return url;
  return `${url}${url.includes("?") ? "&" : "?"}k=${encodeURIComponent(t)}`;
};
