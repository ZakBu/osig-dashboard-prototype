"use client";
import { formatNumber, type AnalyticsRankingRow } from "@/lib/waste";
import { Dot } from "./ui";
import { useRingTooltip } from "./DashboardPrimitives";
export function AnalyticsRankingBars({ rows, color, total, onOpen, totalPosition = "bottom", unit = "рейсов", onSelect }: {
  rows: AnalyticsRankingRow[]; unit?: string; onSelect?: (name: string) => void;
  color: string;
  total: number;
  onOpen?: () => void;
  totalPosition?: "top" | "bottom";
}) {
  const { frameRef, tooltipRef, hovered, moveTooltip, clearTooltip } = useRingTooltip();
  const max = Math.max(1, ...rows.map((row) => row.trips));
  const totalTrips = Math.max(1, total);
  return (
    <div ref={frameRef} className="waste-ranking-frame waste-ranking-frame--analytics" role="img" aria-label={`Рейтинг, всего ${formatNumber(total)}`}>
      {totalPosition === "top" && <div className="waste-ranking-total waste-ranking-total--top"><span>Итого</span><strong>{formatNumber(total)}</strong><span>100%</span></div>}
      <div className="waste-ranking-list">
        {rows.map((row, index) => {
          const share = row.trips / totalTrips * 100;
          return (
            <div
              className="waste-ranking-row w-full text-left"
              key={row.name}
              role={onSelect || onOpen ? "button" : undefined}
              tabIndex={onSelect || onOpen ? 0 : undefined}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect ? onSelect(row.name) : onOpen?.(); } }}
              onClick={() => onSelect ? onSelect(row.name) : onOpen?.()}
              onPointerMove={(event) => moveTooltip(index, event.clientX, event.clientY)}
              onPointerLeave={clearTooltip}
            >
              <span className="waste-ranking-index">{index + 1}</span>
              <span className="waste-ranking-name" title={row.name}><Dot className="size-2.5 shrink-0" style={{ background: color }} /><span>{row.name}</span></span>
              <span className="waste-ranking-track" aria-hidden="true"><span className="waste-ranking-fill" style={{ width: `${row.trips / max * 100}%`, background: color, animationDelay: `${Math.min(index, 8) * 30}ms` }} /></span>
              <strong className="waste-ranking-value">{formatNumber(row.trips)}</strong>
              <span className="waste-ranking-share">{formatNumber(share, 1)}%</span>
            </div>
          );
        })}
      </div>
      {!rows.length && <div className="flex min-h-[150px] items-center justify-center text-[15px] text-[#737e91]">Нет данных</div>}
      {totalPosition === "bottom" && <div className="waste-ranking-total"><span>Итого</span><strong>{formatNumber(total)}</strong><span>100%</span></div>}
      {hovered && rows[hovered.index] && (
        <div ref={tooltipRef} className="waste-ring-tooltip waste-ranking-tooltip" style={{ left: hovered.x, top: hovered.y }}>
          <div className="waste-chart-tooltip">
            <div className="waste-chart-tooltip__heading"><span className="waste-chart-tooltip__dot" style={{ background: color }} /><span className="waste-chart-tooltip__title">{rows[hovered.index].name}</span></div>
            <div className="waste-chart-tooltip__metrics"><strong>{formatNumber(rows[hovered.index].trips)} {unit}</strong><span>{formatNumber(rows[hovered.index].trips / totalTrips * 100, 1)}% от общего количества</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

