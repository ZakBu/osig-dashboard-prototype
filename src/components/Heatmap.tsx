"use client";

import { useMemo } from "react";
import type { HeatCell } from "@/lib/types";
import { Panel } from "./ui";
import { InfoTip } from "./InfoTip";
import { WEEKDAYS, fmtPct1 } from "@/lib/format";

// Шкала доступности цветами проекта: красный (низкая) → янтарь → зелёный (высокая).
const STOPS: [number, [number, number, number]][] = [
  [0.0, [244, 63, 94]],   // rose-500 — низкая доступность
  [0.5, [245, 158, 11]],  // amber-500 — средняя
  [1.0, [16, 185, 129]],  // emerald-500 — высокая доступность
];

function rampColor(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  let lo = STOPS[0];
  let hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (x >= STOPS[i][0] && x <= STOPS[i + 1][0]) { lo = STOPS[i]; hi = STOPS[i + 1]; break; }
  }
  const k = hi[0] === lo[0] ? 0 : (x - lo[0]) / (hi[0] - lo[0]);
  const c = lo[1].map((ch, i) => Math.round(ch + (hi[1][i] - ch) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Окно мониторинга: 10:00 – 00:00 (часы 10…23).
const HOURS = Array.from({ length: 14 }, (_, i) => i + 10);
const GRADIENT = `linear-gradient(90deg, ${STOPS.map((s) => `rgb(${s[1].join(",")})`).join(", ")})`;
const pad2 = (h: number) => String(h).padStart(2, "0");
const showTick = (h: number) => (h % 2 === 0 && h !== 22) || h === 23; // 10,12,…,20,23

export function Heatmap({ cells, emptyText }: { cells: HeatCell[]; emptyText: string }) {
  const { map, days } = useMemo(() => {
    const m = new Map<string, HeatCell>();
    const present = new Set<number>();
    for (const c of cells) {
      if (c.hour < 10) continue; // вне окна мониторинга
      m.set(`${c.dow}:${c.hour}`, c);
      present.add(c.dow);
    }
    return { map: m, days: [...present].sort((a, b) => a - b) };
  }, [cells]);

  // Абсолютная шкала: 0% доступности → красный, 100% → зелёный.
  const norm = (v: number) => Math.max(0, Math.min(1, v / 100));

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5 text-[17px] lg:text-[23px]">
          Тепловая карта доступности топлива
          <InfoTip
            label="Тепловая карта доступности топлива"
            text="Распределение временных интервалов наибольшей и наименьшей доступности топлива в Москве, где период с низкой доступностью - менее 50% АЗС в Москве доступны для заправки, период с высокой доступностью - более 100% АЗС в Москве доступны для заправки."
          />
        </span>
      }
      className="h-full"
      bodyClassName="flex flex-1 flex-col"
    >
      {cells.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center text-muted-foreground text-sm">{emptyText}</div>
      ) : (
        <>
          <div className="flex flex-1 flex-col justify-center overflow-x-auto pt-1">
            <div className="flex min-w-[320px] flex-col gap-1.5">
              {days.map((dow) => (
                <div key={dow} className="flex items-center gap-1.5">
                  <div className="flex w-7 shrink-0 items-center justify-end text-muted-foreground text-xs">
                    {WEEKDAYS[dow - 1]}
                  </div>
                  <div className="flex flex-1 gap-1.5">
                    {HOURS.map((h) => {
                      const cell = map.get(`${dow}:${h}`);
                      return (
                        <div
                          key={h}
                          className="aspect-square flex-1 rounded-[4px]"
                          style={{ backgroundColor: cell ? rampColor(norm(cell.index)) : "rgba(255,255,255,0.04)" }}
                          title={
                            cell
                              ? `${WEEKDAYS[dow - 1]} ${pad2(h)}:00 — ${fmtPct1(cell.index)}`
                              : `${WEEKDAYS[dow - 1]} ${pad2(h)}:00 — нет данных`
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-7 shrink-0" />
                <div className="flex flex-1 gap-1.5">
                  {HOURS.map((h) => (
                    <div key={h} className="flex-1 text-center text-[13px] text-muted-foreground/70 tabular-nums">
                      {showTick(h) ? pad2(h) : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 whitespace-nowrap border-border/60 border-t pt-3 text-[20px] text-foreground">
            <span className="shrink-0">Низкая доступность</span>
            <div className="h-2.5 flex-1 rounded-full" style={{ background: GRADIENT }} />
            <span className="shrink-0">Высокая доступность</span>
          </div>
        </>
      )}
    </Panel>
  );
}
