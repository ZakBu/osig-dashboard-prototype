"use client";

import { useMemo } from "react";
import { Panel, Dot } from "./ui";
import { NetBadge } from "./NetBadge";
import { InfoTip } from "./InfoTip";
import type { QueuesData } from "@/lib/types";
import type { NetFilter } from "@/lib/netType";
import { fmtInt, fmtPct1 } from "@/lib/format";

const short = (n: string) => (n.length > 9 ? `${n.slice(0, 8)}…` : n);

/**
 * Очереди на АЗС: столбцы = число заправок с очередью по каждой сети. Только
 * отображение (клики отключены; фильтрация — общим фильтром сверху). Столбец
 * «Прочие» скрывается при выбранном типе «Прочие» (filter.type=other).
 */
export function QueuesPanel({
  queues, openByNet, order, emptyText, filter, glow,
}: {
  queues: QueuesData | null;
  openByNet: Record<string, number>;
  order: string[];
  emptyText: string;
  filter: NetFilter;
  glow?: string;
}) {
  // Столбцы = группы матвью из `order` (6 сетей + «Прочие», уже готовая группа).
  // queue/open/share — прямо из матвью (без клиентской агрегации, чтобы не задвоить ВИНК/Прочие).
  const rows = useMemo(() => {
    if (!queues) return [];
    return order.map((name) => {
      const open = openByNet[name] ?? 0;
      const q = queues.nets[name]?.queue ?? 0;
      const share = queues.nets[name]?.share ?? (open ? (q / open) * 100 : 0);
      return { name, queue: q, open, share };
    });
  }, [queues, openByNet, order]);

  return (
    <Panel
      title={
        <span className="flex min-w-0 items-center gap-1.5 text-[17px] lg:text-[23px]">
          <span className="truncate">Очереди <span className="text-[17px] font-normal text-foreground/70">(количество АЗС, шт.)</span></span>
          <InfoTip
            label="Очереди на АЗС"
            text="Работающие АЗС, очередь из автомобилей на которых составляет более 5 машин."
          />
        </span>
      }
      className={`h-full transition-shadow duration-300 ${glow ?? ""}`}
      bodyClassName="flex flex-1 flex-col pt-1"
    >
      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center text-muted-foreground text-sm">{emptyText}</div>
      ) : (
        <>
        <div className="flex min-h-[240px] flex-1 items-stretch justify-between gap-2 pt-1 lg:min-h-0">
          {rows.map((r) => {
            const active = filter.net === r.name;
            return (
              <div
                key={r.name}
                title={`${r.name}: очередь на ${r.queue} из ${r.open} открытых АЗС`}
                className={`flex min-w-0 flex-1 cursor-default flex-col items-center gap-2 rounded-lg px-0.5 pt-1 pb-1.5 ${active ? "bg-white/10 ring-1 ring-white/60" : ""}`}
              >
                <div className="flex flex-col items-center leading-tight">
                  <span className={`text-[20px] font-semibold tabular-nums ${active ? "text-white" : "text-foreground"}`}>
                    {fmtPct1(r.share)}
                  </span>
                  <span className="font-semibold text-[18px] text-foreground/90 tabular-nums" title="очередь / открыто АЗС">
                    {fmtInt(r.queue)}/{fmtInt(r.open)}
                  </span>
                </div>
                {/* Двухсоставная шкала по всем открытым АЗС сети:
                    красный — с очередью (>5 машин), зелёный — без очереди. */}
                <div className="flex w-9 flex-1 flex-col-reverse overflow-hidden rounded-md bg-muted/50">
                  <div className="bg-rose-500" style={{ height: r.open ? `${(r.queue / r.open) * 100}%` : "0%" }} />
                  <div className="bg-emerald-500" style={{ height: r.open ? `${((r.open - r.queue) / r.open) * 100}%` : "0%" }} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <NetBadge name={r.name} className="size-9" colored={active} />
                  <span className="max-w-[72px] truncate text-[14px] text-foreground" title={r.name}>
                    {short(r.name)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex shrink-0 justify-center text-[17px] text-foreground">
          <div className="flex flex-col items-start gap-1">
            <span className="flex items-center gap-1.5 whitespace-nowrap"><Dot className="size-2.5 bg-rose-500" />Есть очередь</span>
            <span className="flex items-center gap-1.5 whitespace-nowrap"><Dot className="size-2.5 bg-emerald-500" />Без очереди</span>
          </div>
        </div>
        </>
      )}
    </Panel>
  );
}
