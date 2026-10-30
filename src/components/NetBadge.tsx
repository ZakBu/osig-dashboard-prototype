"use client";

import { Fuel } from "lucide-react";
import { NET_LOGOS } from "./netLogos";
import { brandColor } from "./netBrand";

/** Фирменные цвета для фолбэк-кружка (мелкие сети без логотипа). */
const BRAND: Record<string, { bg: string; fg: string }> = {
  Башнефть: { bg: "#f5a623", fg: "#111111" },
};

/**
 * Бейдж сети: ЕДИНЫЙ логотип (из пинов), БЕЗ серого фона.
 * По умолчанию белый; colored=true красит логотип в фирменный цвет сети
 * (в графиках и KPI «Всего заправок»; в фильтрах — белый).
 * block-родитель обязателен — иначе size-full у svg внутри flex схлопывается в 0×0.
 * Все логотипы кадрированы одинаково (по bbox), поэтому визуально одного размера.
 */
export function NetBadge({
  name, className = "size-9", colored = false,
}: {
  name: string;
  className?: string;
  colored?: boolean;
}) {
  const logo = NET_LOGOS[name];
  if (logo) {
    // Двухцветные логотипы (Татнефть) — свой цвет на path; иначе единый фирменный.
    const perPath = colored ? logo.brandPathColors : undefined;
    const color = colored && !perPath ? brandColor(name) : undefined;
    return (
      <span className={`block ${className} shrink-0 rounded-full`} title={name}>
        <svg
          viewBox={logo.viewBox}
          className="block size-full text-white"
          style={color ? { color } : undefined}
          fill="currentColor"
          aria-hidden="true"
        >
          {logo.paths.map((d, i) => <path key={i} d={d} fill={perPath?.[i]} />)}
        </svg>
      </span>
    );
  }
  const b = name === "Прочие" ? { bg: "#ffffff", fg: "#111111" } : (BRAND[name] ?? { bg: "#3a425a", fg: "#cbd5e1" });
  return (
    <span
      className={`flex ${className} shrink-0 items-center justify-center rounded-full font-semibold text-[17px]`}
      style={{ background: b.bg, color: b.fg }}
      title={name}
    >
      {name === "Прочие" ? <Fuel className="size-1/2" strokeWidth={2.25} /> : name[0]}
    </span>
  );
}
