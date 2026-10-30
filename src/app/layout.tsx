import type { Metadata, Viewport } from "next";
import { fontSans, fontMono, fontHeading } from "@coss/ui/fonts";
import "@/coss/styles/globals.css";
import { PwaRegister } from "./PwaRegister";

// basePath + токен инлайнятся на этапе build (см. next.config env). Метаданные PWA
// НЕ меняют десктоп-вёрстку — только добавляют устанавливаемость и иконку приложения.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const TOKEN = process.env.APP_ACCESS_TOKEN || "";
const K = TOKEN ? `?k=${TOKEN}` : "";

export const metadata: Metadata = {
  title: "Рейсы отходов — оперативная аналитика",
  description: "Дашборд рейсов, инфраструктуры и перевезенной массы отходов.",
  applicationName: "Рейсы отходов",
  manifest: `${BASE}/app-manifest${K}`,
  appleWebApp: {
    capable: true,
    title: "Рейсы отходов",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }],
    apple: [{ url: `${BASE}/icons/apple-touch-icon.png`, sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // safe-area под чёлку/дом-бар
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      className={`dark ${fontSans.variable} ${fontMono.variable} ${fontHeading.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased" suppressHydrationWarning>
        <div style={{position:"fixed",bottom:8,right:12,zIndex:9999,fontSize:11,color:"#aaa",background:"#111",padding:"4px 8px",borderRadius:6}}>Демонстрационные данные</div>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
