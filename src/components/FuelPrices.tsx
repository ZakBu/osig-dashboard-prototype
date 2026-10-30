"use client";

import type { FuelPrice } from "@/lib/types";
import { Panel } from "./ui";
import { asset } from "@/lib/bp";

const fmtRub = (v: number) => `${v.toFixed(1).replace(".", ",")} ₽/л`;

// Канонический список марок (фиксированный порядок и иконки), чтобы блоки не «прыгали»:
// марку без данных под текущий фильтр показываем серой (disabled).
const FUELS: { code: string; icon: string }[] = [
  { code: "92", icon: "/fuel/92.png" },
  { code: "95", icon: "/fuel/95.png" },
  { code: "95+", icon: "/fuel/95plus.png" },
  { code: "100", icon: "/fuel/100.png" },
  { code: "ДТ", icon: "/fuel/dt.png" },
];

export function FuelPrices({ prices }: { prices: FuelPrice[] }) {
  const byCode = new Map(prices.map((p) => [p.code, p]));
  return (
    <Panel
      title={<span className="text-[17px] lg:text-[23px]">Средние цены на топливо</span>}
      className="h-full"
      bodyClassName="flex flex-1 flex-col"
    >
      <div className="-mt-1 mb-3 text-foreground/90 text-sm">по открытым АЗС</div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {FUELS.map((f) => {
          const p = byCode.get(f.code);
          return (
            <div
              key={f.code}
              className={`flex min-h-0 flex-1 items-center gap-3 rounded-xl border px-3 py-1.5 transition-colors ${
                p ? "border-border/60 bg-muted/30" : "border-border/40 bg-muted/10 opacity-55"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset(f.icon)}
                alt={f.code}
                className={`size-10 shrink-0 object-contain ${p ? "" : "grayscale"}`}
              />
              {p ? (
                <>
                  <div className="min-w-0 flex-1 text-foreground text-[20px]">по {p.count} АЗС</div>
                  <div className="font-normal text-[29px] text-foreground tabular-nums">{fmtRub(p.avg)}</div>
                </>
              ) : (
                <div className="min-w-0 flex-1 text-[18px] text-muted-foreground">нет информации о наличии</div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
