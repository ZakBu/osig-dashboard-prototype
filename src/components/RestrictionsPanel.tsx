"use client";

import { ArrowUpRight, Car } from "lucide-react";
import { Card } from "@coss/ui/components/card";
import { cn } from "@coss/ui/lib/utils";
import { fmtInt } from "@/lib/format";

/** Канистра (джеррикан) — в lucide нет, рисуем сами: корпус + ручка + горловина + ребро. */
export function Jerrycan({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M7 8.5V7.1c0-.6.5-1.1 1.1-1.1h1.7" />
      <rect x="5" y="8.5" width="12" height="11.5" rx="1.7" />
      <path d="M17 10.8h1.6c.77 0 1.4.63 1.4 1.4V14" />
      <path d="M8.7 12.4h4.6" />
    </svg>
  );
}

/**
 * Одна строка ограничения — карточка в общем стиле дашборда (как блоки сайдбара):
 * рамка + красная иконка + «По объёму отпуска [тег]» (обычный регистр, как везде) +
 * крупное число + доля % (считаем от всех АЗС, в данных её нет) + «из M АЗС» + подпись.
 */
export function RestrictRow({
  icon, tag, value, total, share, caption,
}: {
  icon: React.ReactNode; tag: string; value: number; total: number; share: number | null; caption: string;
}) {
  // Доля — ПРЕДПОСЧИТАНА витриной 27166 (share_limit_tank / share_limit_canister), сами не делим.
  const pct = share;
  return (
    <div className="flex flex-1 flex-col justify-center rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">{icon}</span>
        <div className="min-w-0 text-[14px] font-semibold leading-tight text-foreground">
          По объёму отпуска{" "}
          <span className="whitespace-nowrap rounded bg-rose-500/20 px-1.5 py-px text-rose-300">{tag}</span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
        <span className="text-[27px] font-bold leading-none text-foreground">{fmtInt(value)}</span>
        {pct != null && <span className="text-[17px] font-semibold leading-none text-foreground/90">{pct.toFixed(1).replace(".", ",")}%</span>}
        <span className="whitespace-nowrap text-[13px] text-foreground/60">из {fmtInt(total)} АЗС</span>
      </div>
      <div className="mt-0.5 text-[13px] leading-snug text-foreground/70">{caption}</div>
    </div>
  );
}

/**
 * «Ограничения на покупку топлива» — панель в общем стиле (coss Card с шапкой-заголовком,
 * как у остальных панелей). Две строки: в бак / в канистры, во всех фильтрах
 * (значения из summary.bak / summary.no_canister / summary.total).
 */
export function RestrictionsPanel({
  bak, noCanister, total, shareTank, shareCanister, glow, onOpen,
}: {
  bak: number; noCanister: number; total: number; shareTank: number | null; shareCanister: number | null; glow?: string; onOpen?: () => void;
}) {
  return (
    <button type="button" aria-label="Ограничения на покупку топлива" onClick={onOpen} className="group h-full w-full text-left">
      <Card className={cn("flex h-full flex-col overflow-hidden transition-colors duration-300 hover:border-white/25 hover:bg-muted/40", glow)}>
        <div className="flex shrink-0 items-start justify-between gap-2 px-4 pt-2">
          <div className="min-w-0 font-medium text-[17px] leading-tight text-foreground">Ограничения на покупку топлива</div>
          {/* Значок «перейти/открыть» (как на сайтах) — панель кликабельна, открывает попап. */}
          <span aria-hidden className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-foreground/55 transition-colors group-hover:border-white/25 group-hover:text-foreground">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-4 pt-2">
          <RestrictRow
            icon={<Car className="size-4" />}
            tag="в бак"
            value={bak}
            total={total}
            share={shareTank}
            caption="не более 20–50 л топлива"
          />
          <RestrictRow
            icon={<Jerrycan className="size-[18px]" />}
            tag="в канистры"
            value={noCanister}
            total={total}
            share={shareCanister}
            caption="не заправляют в канистры"
          />
        </div>
      </Card>
    </button>
  );
}
