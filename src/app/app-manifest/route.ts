import { NextResponse } from "next/server";

/**
 * Web App Manifest для PWA. Отдаётся под токен-гейтом (см. middleware): в start_url
 * зашит ?k=<токен>, поэтому манифест НЕ публичный — иначе токен утёк бы. Браузер тянет
 * его по ссылке `${BASE}/app-manifest?k=…` из уже авторизованной страницы.
 * Иконки — публичные (в них нет данных), поэтому без токена.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const TOKEN = process.env.APP_ACCESS_TOKEN || "";

export const dynamic = "force-static";

export function GET() {
  const k = TOKEN ? `?k=${TOKEN}` : "";
  const manifest = {
    name: "Рейсы отходов — оперативная аналитика",
    short_name: "Рейсы отходов",
    description: "Рейсы, инфраструктура и перевезенная масса отходов",
    lang: "ru",
    dir: "ltr",
    start_url: `${BASE}/${k}`,
    scope: `${BASE}/`,
    id: `${BASE}/`,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BASE}/icons/icon-512-maskable.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return NextResponse.json(manifest, {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
