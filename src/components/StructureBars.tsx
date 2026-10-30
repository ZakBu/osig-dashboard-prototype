"use client";

import { Panel } from "./ui";
import { fmtPct1 } from "@/lib/format";
import type { StatusRow } from "@/lib/types";

/** 3-way доступность по округам (данные ГдеБенз) за выбранный период. */
export function StructureBars({ title, rows, emptyText }: { title: string; rows: StatusRow[]; emptyText: string }) {
  return (
    <Panel
      title={<span className="whitespace-nowrap text-[17px] lg:text-[23px]">{title}</span>}
      className="h-full"
      bodyClassName="flex flex-1 flex-col"
    >
      {rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-muted-foreground text-sm">
          {emptyText}
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-0.5">
            {rows.map((r) => {
              const w = (n: number) => (r.total ? `${(n / r.total) * 100}%` : "0%");
              return (
                <div key={r.name} className="flex min-h-0 flex-1 items-center gap-3.5">
                  <div className="w-16 shrink-0 truncate text-foreground text-[17px]" title={r.name}>{r.name}</div>
                  <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="bg-emerald-500" style={{ width: w(r.open) }} />
                    <div className="bg-rose-500" style={{ width: w(r.noFuel) }} />
                    <div className="bg-violet-500" style={{ width: w(r.closed) }} />
                  </div>
                  <div className="w-14 shrink-0 text-right font-medium text-foreground text-[17px] tabular-nums">{fmtPct1(r.index)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
