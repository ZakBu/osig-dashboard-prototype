"use client";

import type { PriceInfo } from "@/lib/types";
import { Panel } from "./ui";
import { InfoTip } from "./InfoTip";
import { fmtInt } from "@/lib/format";

// Компактная справка с формулами (без «простыней»).
const PRICE_TIP =
  "Среднее арифметическое цен на АЗС сети за актуальный интервал мониторинга.\n" +
  "День: (цена сегодня / вчера − 1) × 100%.\n" +
  "Неделя: (цена сегодня / 7 дней назад − 1) × 100%.\n" +
  "Сравнение — для того же часа, вида топлива и группы сетей.";

const fmtRub = (v: number) => `${v.toFixed(1).replace(".", ",")} ₽/л`;
const fmtPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1).replace(".", ",")}%`;

// Марки: код-бейдж, подпись. Цвета — как на графике «Доступность топлива»:
// 92 → бирюза, 95/95+/100 → красный (одна группа), ДТ → фиолетовый.
// Порядок как везде: ДТ → 92 → 95 → 95+ → 100.
const FUELS: { code: string; label: string; color: string }[] = [
  { code: "ДТ", label: "ДТ", color: "#a855f7" },
  { code: "92", label: "АИ-92", color: "#14b8a6" },
  { code: "95", label: "АИ-95", color: "#ef4444" },
  { code: "95+", label: "АИ-95+", color: "#ef4444" },
  { code: "100", label: "АИ-100", color: "#ef4444" },
];

/** Строка изменения: подпись слева, значение справа (значения выровнены по правой
 *  стороне — без «ступенек»). Красный — дорожает (+), зелёный — дешевеет (−).
 *  na=true → «Н/Д» (в матвью показателя нет, напр. изменение за неделю). */
function Delta({ label, v, na }: { label: string; v: number | null; na?: boolean }) {
  const flat = v != null && Math.abs(v) < 0.05;
  const cls = na || v == null || flat ? "text-foreground" : v > 0 ? "text-rose-400" : "text-emerald-400";
  const arrow = na || v == null || flat ? "" : v > 0 ? "▲" : "▼";
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
      <span className="text-foreground">{label}</span>
      <span className={`whitespace-nowrap font-medium tabular-nums ${cls}`}>{na ? "Н/Д" : v == null ? "—" : flat ? "0,0%" : `${arrow}${fmtPct(v)}`}</span>
    </div>
  );
}

/** Средние цены топлива по выбранной сети: марка, цена сейчас, изменение за день/неделю. */
export function FuelPricePanel({ prices, glow }: { prices: PriceInfo[]; glow?: string }) {
  const byCode = new Map(prices.map((p) => [p.code, p]));
  return (
    <Panel
      title={
        <span className="flex min-w-0 items-center gap-1.5 text-[17px] lg:text-[23px]">
          <span className="truncate">Средние цены на топливо</span>
          <InfoTip label="Средние цены на топливо" text={PRICE_TIP} />
        </span>
      }
      className={`h-full transition-shadow duration-300 ${glow ?? ""}`}
      bodyClassName="flex flex-1 flex-col pt-1"
    >
      <div className="-mt-0.5 mb-1.5 text-[14px] text-foreground/80">по открытым АЗС · ₽/л</div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        {FUELS.map((f) => {
          const p = byCode.get(f.code);
          return (
            <div
              key={f.code}
              className={`flex min-h-0 flex-1 items-center gap-2.5 rounded-xl border px-3 py-1 ${
                p ? "border-border/60 bg-muted/25" : "border-border/40 bg-muted/10 opacity-55"
              }`}
            >
              {/* иконка бензина (марка) — слева, фикс. ширина (по самой широкой АИ-95+/АИ-100),
                  чтобы блоки день/нед выравнивались по всем строкам без ступенек и текст марки
                  не вылезал за пределы плашки */}
              <span
                className="inline-flex h-7 w-[64px] shrink-0 items-center justify-center whitespace-nowrap rounded-md px-1.5 text-[14px] font-bold text-white"
                style={{ background: p ? f.color : "#3f3f46" }}
              >
                {f.label}
              </span>
              {p ? (
                <>
                  {/* динамика за день (из матвью) и за неделю (в матвью нет → Н/Д) */}
                  <div className="ml-0.5 flex w-[84px] shrink-0 flex-col gap-0.5">
                    <Delta label="день" v={p.dDay} />
                    <Delta label="нед" v={p.dWeek} na />
                  </div>
                  {/* цена — в правый край; под ней «по N АЗС» (кол-ва в матвью нет → Н/Д) */}
                  <div className="ml-auto shrink-0 text-right">
                    <div className="whitespace-nowrap text-[22px] font-semibold leading-none text-foreground tabular-nums">
                      {fmtRub(p.avg)}
                    </div>
                    <div className="mt-0.5 whitespace-nowrap text-[13px] text-foreground/70">по {p.count < 0 ? "Н/Д" : fmtInt(p.count)} АЗС</div>
                  </div>
                </>
              ) : (
                <span className="text-[14px] text-foreground/80">нет данных о цене</span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
