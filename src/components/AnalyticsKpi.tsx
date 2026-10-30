"use client";
import { useId, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { formatNumber, type NullableMetric } from "@/lib/waste";
import { Panel } from "./ui";
import { InfoTip } from "./InfoTip";
import { PANEL, Delta } from "./DashboardPrimitives";
type AnalyticsTrendPoint = { label: string; value: number | null };
function smoothSparkPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const middle = (previous.x + point.x) / 2;
    return `${path} C${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, `M${points[0].x} ${points[0].y}`);
}

function formatAnalyticsTrendLabel(value: string) {
  const date = value.slice(0, 10);
  const [year, month, day] = date.split("-");
  const hour = value.includes("T") ? value.slice(11, 13) : "";
  return hour ? `${day}.${month}.${year} · ${hour}:00` : `${day}.${month}.${year}`;
}

export function AnalyticsKpi({ title, metric, icon: Icon, color, unit = "%", tip, periodLabel = "vs предыдущий период", trend = [], controls, footer, showTrend = true }: {
  title: string; metric: NullableMetric; icon: LucideIcon; color: string; unit?: string; tip: string; periodLabel?: string; trend?: AnalyticsTrendPoint[]; controls?: ReactNode; footer?: ReactNode; showTrend?: boolean;
}) {
  const gradientId = `analytics-area-${useId().replaceAll(":", "")}`;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const absolute = metric.value == null || metric.previous == null ? null : metric.value - metric.previous;
  const positive = (metric.changePct ?? absolute ?? 0) > 0;
  const negative = (metric.changePct ?? absolute ?? 0) < 0;
  const deltaClass = positive ? "is-positive" : negative ? "is-negative" : "is-neutral";
  const absoluteUnit = unit === "%" ? " п.п." : unit;
  const validTrend = trend.filter((point): point is { label: string; value: number } => point.value != null && Number.isFinite(point.value));
  const sourcePoints = validTrend.length
    ? validTrend
    : metric.value == null
      ? []
      : [{ label: "", value: metric.value }];
  const values = sourcePoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.04, 1);
  const points = sourcePoints.map((point, index) => ({
    ...point,
    x: sourcePoints.length > 1 ? 2 + index / (sourcePoints.length - 1) * 96 : 50,
    y: max === min ? 16 : 24 - (point.value - min) / range * 18,
  }));
  const linePath = points.length > 1 ? smoothSparkPath(points) : "";
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = firstPoint && lastPoint && linePath
    ? `${linePath} L${lastPoint.x} 28 L${firstPoint.x} 28 Z`
    : "";
  const hovered = hoveredIndex == null ? null : points[hoveredIndex];
  const displayUnit = unit.trim();
  return (
    <Panel className={`${PANEL} waste-analytics-kpi`} bodyClassName="waste-analytics-kpi__body">
      {controls && <div className="dashboard-kpi-controls">{controls}</div>}
      <div className="waste-analytics-kpi__main">
        <div className="waste-analytics-kpi__icon" style={{ color, borderColor: `${color}70`, background: `${color}12` }}>
          <Icon className="size-[22px]" strokeWidth={1.7} />
        </div>
        <div className="waste-analytics-kpi__content min-w-0 flex-1">
          <div className="waste-analytics-kpi__heading">
            <span className="waste-analytics-kpi__label">{title}</span>
            <InfoTip label={title} text={tip} />
          </div>
          <div className="waste-analytics-kpi__metric-row">
            <div className="waste-analytics-kpi__value">{formatNumber(metric.value, 1)}{metric.value != null && <span>{unit}</span>}</div>
            {metric.previous != null && <div className="waste-analytics-kpi__comparison">
              <div className={`waste-analytics-kpi__delta ${deltaClass}`}>
                <strong>{absolute == null ? "—" : `${absolute > 0 ? "+" : ""}${formatNumber(absolute, 1)}${absoluteUnit}`}</strong>
                <Delta value={metric.changePct} />
              </div>
              <div className="waste-analytics-kpi__period">{periodLabel}</div>
            </div>}
          </div>
        </div>
      </div>
      {footer}
      {showTrend && (points.length > 1 ? (
        <div
          className="waste-analytics-kpi__spark-wrap"
          data-testid={`analytics-chart-${title}`}
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(bounds.width, 1)));
            setHoveredIndex(points.length === 1 ? 0 : Math.round(fraction * (points.length - 1)));
          }}
          onPointerLeave={() => setHoveredIndex(null)}
        >
          <svg
            className="waste-analytics-kpi__spark"
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${title}: динамика по ${points.length} дням`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity=".28" />
                <stop offset="58%" stopColor={color} stopOpacity=".13" />
                <stop offset="100%" stopColor={color} stopOpacity=".015" />
              </linearGradient>
            </defs>
            <path className="waste-analytics-kpi__spark-grid" d="M1 7.5H99 M1 16H99 M1 24.5H99" />
            <path className="waste-analytics-kpi__spark-area" d={areaPath} fill={`url(#${gradientId})`} />
            <path className="waste-analytics-kpi__spark-line" d={linePath} fill="none" stroke={color} style={{ color }} />
            {hovered && <line className="waste-analytics-kpi__spark-crosshair" x1={hovered.x} x2={hovered.x} y1="2" y2="27" />}
          </svg>
          {hovered && (
            <div
              className="waste-analytics-kpi__chart-tooltip"
              style={hovered.x < 28
                ? { left: 8, transform: "none" }
                : hovered.x > 72
                  ? { right: 8, left: "auto", transform: "none" }
                  : { left: `${hovered.x}%` }}
            >
              <span>{hovered.label ? formatAnalyticsTrendLabel(hovered.label) : title}</span>
              <strong>{formatNumber(hovered.value, displayUnit === "т" ? 2 : 1)}{displayUnit ? ` ${displayUnit}` : ""}</strong>
            </div>
          )}
        </div>
      ) : (
        <div className="waste-analytics-kpi__spark-empty">Недостаточно данных по дням</div>
      ))}
    </Panel>
  );
}

