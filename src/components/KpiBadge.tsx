"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingUp, Fuel, X } from "lucide-react";

/**
 * KPI-бейдж = кольцо-«прогресс» (яркая дуга = доля метрики, остальное — тёмный
 * трек того же цвета) с иконкой по центру. Без залитого круга — прозрачный фон.
 * value (0..100) задаёт длину яркой дуги и пересчитывается под текущий фильтр.
 */
function KpiBadge({
  color, dark, Icon, value = 100, size = 62, iconScale = 0.42, iconStroke = 2.25, slash = false,
}: {
  color: string;
  dark: string;
  Icon: LucideIcon;
  value?: number;
  size?: number;
  iconScale?: number;
  iconStroke?: number;
  slash?: boolean;
}) {
  const r = size / 2;
  const stroke = size * 0.11; // толщина кольца
  const cr = r - stroke / 2; // радиус центра кольца
  const c = 2 * Math.PI * cr;
  const frac = Math.max(0, Math.min(100, value)) / 100; // доля яркой дуги
  const g = Math.round(size * iconScale); // размер иконки в px (без %, чтобы не схлопнулась)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        {/* тёмный трек по всему кольцу */}
        <circle cx={r} cy={r} r={cr} fill="none" stroke={dark} strokeWidth={stroke} />
        {/* яркая дуга = доля метрики */}
        {frac > 0 && (
          <circle
            cx={r}
            cy={r}
            r={cr}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${frac * c} ${c}`}
            transform={`rotate(-90 ${r} ${r})`}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" style={{ color }}>
        <span className="relative flex items-center justify-center">
          <Icon size={g} strokeWidth={iconStroke} />
          {/* диагональная черта — знак «нет топлива» */}
          {slash && (
            <span
              className="pointer-events-none absolute rotate-45 rounded-full"
              style={{ width: size * 0.6, height: Math.max(2, size * 0.045), background: color }}
            />
          )}
        </span>
      </span>
    </div>
  );
}

// Палитра — в тон графикам проекта: зелёный/красный(rose)/фиолетовый + голубой акцент.
const C = {
  blue: { color: "#0ea5e9", dark: "#0c556f" },
  green: { color: "#10b981", dark: "#0a5c48" },
  red: { color: "#f43f5e", dark: "#8f2036" },
  violet: { color: "#8b5cf6", dark: "#553aa0" },
};

/** «Всего заправок» — голубое кольцо (полное) со стрелкой роста. */
export const KpiBadgeTotal = ({ size, value = 100 }: { size?: number; value?: number }) => (
  <KpiBadge {...C.blue} Icon={TrendingUp} iconStroke={2.5} size={size} value={value} />
);

/** «Доступно для заправки» — зелёное кольцо (доля доступных) с колонкой. */
export const KpiBadgeAvailable = ({ size, value }: { size?: number; value?: number }) => (
  <KpiBadge {...C.green} Icon={Fuel} size={size} value={value} />
);

/** «Закрыто, нет топлива» — красное кольцо (доля закрытых) с перечёркнутой колонкой. */
export const KpiBadgeNoFuel = ({ size, value }: { size?: number; value?: number }) => (
  <KpiBadge {...C.red} Icon={Fuel} slash size={size} value={value} />
);

/** «Закрыто постоянно» — фиолетовое кольцо (доля закрытых) с крестиком. */
export const KpiBadgeClosed = ({ size, value }: { size?: number; value?: number }) => (
  <KpiBadge {...C.violet} Icon={X} iconScale={0.46} iconStroke={3} size={size} value={value} />
);
