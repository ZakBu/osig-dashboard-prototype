"use client";

import { Fuel } from "lucide-react";
import { NetBadge } from "./NetBadge";
import { CheckCircleUnread, OilBarrel } from "./icons";
import type { NetFilter, StationType } from "@/lib/netType";

/** Компании с отдельными кнопками (ключ = имя сети в данных, label = подпись). */
// Единый порядок сетей (как в графиках): Роснефть, Лукойл, Газпромнефть,
// Татнефть, Нефтемагистраль, Teboil.
const COMPANIES: { net: string; label: string }[] = [
  { net: "Роснефть", label: "Роснефть" },
  { net: "Лукойл", label: "Лукойл" },
  { net: "Газпромнефть", label: "Газпром" },
  { net: "Татнефть", label: "Татнефть" },
  { net: "Нефтьмагистраль", label: "Нефтемаг." },
  { net: "Teboil", label: "Teboil" },
];

// grow: кнопки равномерно растягиваются на всю ширину блока (естественная ширина +
// равная доля свободного места).
const pill =
  "flex h-9 grow items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-1.5 text-[12.5px] font-medium transition-colors";
// Голубой активный цвет (как в исходном figma).
const active = "border-transparent bg-sky-500 text-white";
const idle = "border-input bg-background text-foreground hover:bg-muted/50";

/**
 * Фильтр по компаниям (ряд кнопок, без подписи — встраивается в верхнюю панель).
 * Кнопки задают глобальный фильтр дашборда: «Все» — сброс; компания — по сети;
 * «ВИНК»/«Прочие» — по типу. «Прочие» — агрегат вне ВИНК/Нефтьмагистрали/Teboil.
 */
export function CompanyFilterBar({
  filter,
  onPickNet,
  onType,
}: {
  filter: NetFilter;
  onPickNet: (net: string) => void;
  onType: (t: StationType) => void;
}) {
  const isAll = !filter.net && filter.type === "all";
  return (
    <div className="flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto">
      <button type="button" onClick={() => onType("all")} className={`${pill} ${isAll ? active : idle}`}>
        <CheckCircleUnread className="size-4 shrink-0" />
        Все
      </button>

      {COMPANIES.map((c) => {
        const on = filter.net === c.net;
        return (
          <button
            key={c.net}
            type="button"
            onClick={() => onPickNet(c.net)}
            className={`${pill} ${on ? active : idle}`}
            title={c.net}
          >
            <NetBadge name={c.net} className="size-6" />
            {c.label}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onType("vink")}
        className={`${pill} ${!filter.net && filter.type === "vink" ? active : idle}`}
      >
        <OilBarrel className="size-4 shrink-0" />
        ВИНК
      </button>
      <button
        type="button"
        onClick={() => onType("other")}
        className={`${pill} ${!filter.net && filter.type === "other" ? active : idle}`}
      >
        <Fuel className="size-4 shrink-0" />
        Прочие
      </button>
    </div>
  );
}
