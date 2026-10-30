"use client";
import { useLayoutEffect, useEffect, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import type { ApexOptions } from "apexcharts";
import { formatNumber } from "@/lib/waste";
import { Panel } from "./ui";
import { ChartBox } from "./ChartBox";
import { GranControl, type Gran } from "./GranControl";
import { PANEL, PANEL_HEADER, PanelHeading } from "./DashboardPrimitives";
function formatTrendAxisLabel(bucket: string | undefined, gran: Gran) {
  if (!bucket) return "";
  const date = bucket.slice(0, 10);
  const [, month, day] = date.split("-");
  if (gran === "day") return `${day}.${month}`;
  const hour = bucket.slice(11, 13);
  return `${hour}:00`;
}

function formatTrendTooltipTitle(bucket: string, gran: Gran) {
  const [, month, day] = bucket.slice(0, 10).split("-");
  return gran === "hour" ? `${day}.${month}.${bucket.slice(0, 4)} · ${bucket.slice(11, 16)}` : `${day}.${month}.${bucket.slice(0, 4)}`;
}

function maxOrOne(points: Array<{ value: number | null }>) {
  return Math.max(1, ...points.map((point) => point.value ?? 0));
}

type TrendGeometry = {
  left: number;
  width: number;
  top: number;
  height: number;
  minY: number;
  maxY: number;
};

type ApexChartContext = {
  w?: {
    globals?: {
      translateX?: number;
      gridWidth?: number;
      translateY?: number;
      gridHeight?: number;
      minY?: number[];
      maxY?: number[];
      yAxisScale?: Array<{
        niceMin?: number;
        niceMax?: number;
        result?: number[];
      }>;
    };
  };
};

function areaOptions(
  points: Array<{ bucket: string; value: number | null }>,
  gran: Gran,
  color: string,
  unit: string,
  sparse = false,
  onGeometry?: (context?: ApexChartContext) => void,
): ApexOptions {
  const values = points.map((point) => point.value);
  const max = Math.max(0, ...values.filter((value): value is number => value != null));
  const dayCount = new Set(points.map((point) => point.bucket.slice(0, 10))).size;
  return {
    chart: {
      type: sparse ? "scatter" : "area",
      toolbar: { show: false },
      zoom: { enabled: false },
      background: "transparent",
      fontFamily: "inherit",
      parentHeightOffset: 0,
      animations: { enabled: true, easing: "easeinout", speed: 700, animateGradually: { enabled: true, delay: 100 }, dynamicAnimation: { enabled: true, speed: 350 } },
      events: {
        mounted: (context) => onGeometry?.(context as ApexChartContext),
        updated: (context) => onGeometry?.(context as ApexChartContext),
      },
    },
    theme: { mode: "dark" }, colors: [color],
    stroke: { curve: "smooth", width: 2.5 },
    markers: { size: sparse ? 8 : 0, colors: [color], strokeColors: "#03060c", strokeWidth: sparse ? 3 : 0, hover: { size: sparse ? 10 : 0 } },
    fill: { type: "gradient", gradient: { shade: "dark", type: "vertical", shadeIntensity: 0.35, opacityFrom: 0.42, opacityTo: 0.03, stops: [0, 88, 100] } },
    dataLabels: { enabled: gran === "day" && points.length <= 14, offsetY: -10, formatter: (value: number) => value == null ? "" : formatNumber(value, unit === "т" ? 1 : 0), style: { fontSize: "18px", fontWeight: 600, colors: [color] }, background: { enabled: false } },
    grid: { borderColor: "rgba(255,255,255,0.07)", strokeDashArray: 2, padding: { left: 14, right: 36, top: 18, bottom: -6 } },
    xaxis: {
      type: "category",
      categories: points.map((point) => point.bucket),
      tickPlacement: "on",
      tickAmount: Math.max(1, Math.min(gran === "hour" ? dayCount * 4 : 6, points.length - 1)),
      labels: {
        rotate: 0,
        hideOverlappingLabels: true,
        trim: false,
        formatter: (value: string) => formatTrendAxisLabel(value, gran),
        style: { colors: "#8b94a4", fontSize: gran === "hour" ? "14px" : "17px" },
      },
      axisBorder: { show: true, color: "rgba(255,255,255,0.12)" },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: { min: 0, max: max > 0 ? undefined : 1, tickAmount: 4, labels: { formatter: (value: number) => formatNumber(value, 0), style: { colors: "#8b94a4", fontSize: "17px" } } },
    // FitCanvas масштабирует весь экран через transform. Нативный hit-test ApexCharts
    // использует немасштабированную ширину SVG, поэтому вправо накапливается ошибка.
    // Ховер строится в TrendCard по фактическому DOMRect области графика.
    tooltip: { enabled: false },
    legend: { show: false }, noData: { text: "Нет данных", style: { color: "#7f899b" } },
    responsive: [{ breakpoint: 1024, options: { dataLabels: { enabled: false }, xaxis: { labels: { rotate: 0, rotateAlways: false, style: { fontSize: "12px" } } }, yaxis: { min: 0, tickAmount: 4, labels: { formatter: (value: number) => formatNumber(value, 0), style: { fontSize: "14px" } } } } }],
  };
}

export function TrendCard({ title, subtitle, tip, updated, points, gran, onGran, color, unit, controls, hideGran = false }: {
  title: string; subtitle: string; tip: string; updated: string;
  points: Array<{ bucket: string; value: number | null }>; gran: Gran; onGran: (gran: Gran) => void; color: string; unit: string; controls?: ReactNode; hideGran?: boolean;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<TrendGeometry | null>(null);
  const [hovered, setHovered] = useState<{ index: number; cursorX: number; cursorY: number } | null>(null);
  const knownPointCount = points.filter((point) => point.value != null).length;
  const sparse = knownPointCount === 1;
  const dayCount = useMemo(() => new Set(points.map((point) => point.bucket.slice(0, 10))).size, [points]);
  const daySeparators = useMemo(() => gran === "hour"
    ? points.flatMap((point, index) => {
      if (index === 0 || point.bucket.slice(0, 10) === points[index - 1]?.bucket.slice(0, 10)) return [];
      const [, month, day] = point.bucket.slice(0, 10).split("-");
      return [{ index, label: `${day}.${month}` }];
    })
    : [], [gran, points]);
  const isScrollable = gran === "hour" && dayCount > 3;
  const chartWidthPercent = isScrollable ? dayCount / 3 * 100 : 100;
  const syncGeometry = useCallback((context?: ApexChartContext) => {
    const globals = context?.w?.globals;
    if (!globals) return;
    const axis = globals.yAxisScale?.[0];
    const ticks = axis?.result?.filter((value) => Number.isFinite(value)) ?? [];
    const next: TrendGeometry = {
      left: globals.translateX ?? 0,
      width: globals.gridWidth ?? 0,
      top: globals.translateY ?? 0,
      height: globals.gridHeight ?? 0,
      minY: axis?.niceMin ?? (ticks.length ? Math.min(...ticks) : globals.minY?.[0] ?? 0),
      maxY: axis?.niceMax ?? (ticks.length ? Math.max(...ticks) : globals.maxY?.[0] ?? maxOrOne(points)),
    };
    setGeometry((current) => current && Object.keys(next).every((key) => current[key as keyof TrendGeometry] === next[key as keyof TrendGeometry]) ? current : next);
  }, [points]);
  const options = useMemo(() => areaOptions(points, gran, color, unit, sparse, syncGeometry), [points, gran, color, unit, sparse, syncGeometry]);
  const seriesData = useMemo(() => points.map((point) => point.value), [points]);

  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || !isScrollable) return;
    const frame = requestAnimationFrame(() => {
      viewport.scrollLeft = viewport.scrollWidth - viewport.clientWidth;
    });
    return () => cancelAnimationFrame(frame);
  }, [isScrollable, points]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const onMove = (event: PointerEvent) => {
      const grid = chart.querySelector<SVGGElement>(".apexcharts-grid");
      if (!grid || points.length === 0) return;
      const gridBounds = grid.getBoundingClientRect();
      const chartBounds = chart.getBoundingClientRect();
      if (event.clientY < gridBounds.top - 20 || event.clientY > gridBounds.bottom + 8) {
        setHovered(null);
        return;
      }
      const fraction = (event.clientX - gridBounds.left) / Math.max(gridBounds.width, 1);
      if (fraction < -0.015 || fraction > 1.015) {
        setHovered(null);
        return;
      }
      const index = points.length === 1 ? 0 : Math.round(Math.max(0, Math.min(1, fraction)) * (points.length - 1));
      const scaleX = chartBounds.width / Math.max(chart.offsetWidth, 1);
      const scaleY = chartBounds.height / Math.max(chart.offsetHeight, 1);
      setHovered({
        index,
        cursorX: (event.clientX - chartBounds.left) / Math.max(scaleX, 0.0001),
        cursorY: (event.clientY - chartBounds.top) / Math.max(scaleY, 0.0001),
      });
    };
    const onLeave = () => setHovered(null);
    chart.addEventListener("pointermove", onMove);
    chart.addEventListener("pointerleave", onLeave);
    return () => {
      chart.removeEventListener("pointermove", onMove);
      chart.removeEventListener("pointerleave", onLeave);
    };
  }, [points]);

  const hoverPoint = hovered ? points[hovered.index] : null;
  const pointX = geometry && hovered && points.length > 1
    ? geometry.left + (hovered.index / (points.length - 1)) * geometry.width
    : geometry?.left ?? 0;
  const pointY = geometry && hoverPoint?.value != null
    ? geometry.top + (1 - (hoverPoint.value - geometry.minY) / Math.max(geometry.maxY - geometry.minY, 1)) * geometry.height
    : geometry?.top ?? 0;
  const tooltipWidth = Math.min(224, Math.max(180, (chartRef.current?.offsetWidth ?? 248) - 24));
  const tooltipHeight = 82;
  const chartWidth = chartRef.current?.offsetWidth ?? 248;
  const chartHeight = chartRef.current?.offsetHeight ?? 160;
  const visibleLeft = scrollRef.current?.scrollLeft ?? 0;
  const visibleRight = visibleLeft + (scrollRef.current?.clientWidth ?? chartWidth);
  const tooltipGap = 18;
  const tooltipX = pointX + tooltipGap + tooltipWidth <= visibleRight - 12
    ? pointX + tooltipGap
    : Math.max(visibleLeft + 12, pointX - tooltipWidth - tooltipGap);
  const tooltipY = pointY - tooltipHeight - tooltipGap >= 12
    ? pointY - tooltipHeight - tooltipGap
    : Math.min(chartHeight - tooltipHeight - 12, pointY + tooltipGap);
  return (
    <Panel className={`${PANEL} waste-dashboard-panel h-full min-h-[350px] lg:min-h-0`} headerClassName={PANEL_HEADER} bodyClassName="waste-panel-body flex min-h-0 flex-1 flex-col pb-4 pt-0" title={<PanelHeading title={title} subtitle={subtitle} updated={updated} tip={tip} />} right={<div className="flex items-center gap-3">{controls}{!hideGran && <GranControl gran={gran} onGran={onGran} />}</div>}>
      <div
        ref={scrollRef}
        className={`waste-trend-scroll ${isScrollable ? "waste-trend-scroll--hourly" : ""}`}
        data-visible-days={Math.min(3, dayCount)}
        data-total-days={dayCount}
        onScroll={() => setHovered(null)}
        aria-label={isScrollable ? `График: показано 3 из ${dayCount} дней, доступна горизонтальная прокрутка` : undefined}
      >
        <div ref={chartRef} className="waste-trend-chart relative flex min-h-0" style={{ width: `${chartWidthPercent}%` }}>
          <ChartBox key={`${title}-${gran}-${points.length}-${sparse ? "sparse" : "continuous"}`} type={sparse ? "scatter" : "area"} options={options} series={[{ name: title, data: seriesData }]} />
          {geometry && daySeparators.map((separator) => {
            const separatorX = geometry.left + (separator.index / Math.max(points.length - 1, 1)) * geometry.width;
            return (
              <div
                key={`${title}-${separator.index}`}
                className="waste-trend-day-separator"
                style={{ left: separatorX, top: geometry.top, height: geometry.height }}
              >
                <span>{separator.label}</span>
              </div>
            );
          })}
          {geometry && hovered && hoverPoint?.value != null && (
            <>
              <div className="pointer-events-none absolute z-10 border-l border-dashed border-white/55" style={{ left: pointX, top: geometry.top, height: geometry.height }} />
              <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#03060c] shadow-[0_0_0_2px_rgba(255,255,255,0.12)]" style={{ left: pointX, top: pointY, width: 14, height: 14, background: color }} />
              <div className="waste-trend-tooltip" style={{ left: tooltipX, top: tooltipY, width: tooltipWidth }}>
                <div className="waste-chart-tooltip waste-chart-tooltip--compact">
                  <div className="waste-chart-tooltip__heading">
                    <span className="waste-chart-tooltip__dot" style={{ background: color }} />
                    <span className="waste-chart-tooltip__title">{formatTrendTooltipTitle(hoverPoint.bucket, gran)}</span>
                  </div>
                  <div className="waste-chart-tooltip__metrics">
                    <strong>{formatNumber(hoverPoint.value, unit === "т" ? 2 : 0)} {unit}</strong>
                    <span>{gran === "hour" ? "часовой интервал" : "за календарный день"}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {sparse && (
        <div className="mt-1 flex shrink-0 items-center gap-2 text-[14px] leading-5 text-[#7f899b]">
          <CircleAlert className="size-3.5 shrink-0" />
          <span>Валидная масса есть только в 1 из {points.length} интервалов</span>
        </div>
      )}
    </Panel>
  );
}

