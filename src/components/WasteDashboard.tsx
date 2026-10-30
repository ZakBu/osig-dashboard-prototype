"use client";
import { AnalyticsKpi } from "./AnalyticsKpi";
import { TrendCard } from "./TrendCard";
import { AnalyticsRankingBars } from "./AnalyticsRankingBars";
import { Delta, PanelHeading, useRingTooltip, PANEL, PANEL_HEADER } from "./DashboardPrimitives";
import { OperationalOverview } from "./OperationalOverview";
import { demoFetch as fetch } from "@/lib/demo";

import { Popover } from "@base-ui/react/popover";
import { Dialog } from "@base-ui/react/dialog";
import type { ApexOptions } from "apexcharts";
import {
  ArrowUpRight, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, Clock3,
  Factory, Gauge, ListChecks, Loader2, PackageOpen, Recycle, RefreshCw, Scale, Search,
  Truck, Users, Warehouse, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { asset } from "@/lib/bp";
import { withK } from "@/lib/auth";
import {
  formatNumber, formatUpdated, latestPeriod, statusColor, wasteFiltersPath, WASTE_COLORS,
  type AnalyticsRankingRow, type CarrierEfficiencyAverage, type Metric, type NullableMetric,
  type WasteDashboard as WasteDashboardData, type WasteFilters, type WasteSelection, type WasteTrip, type WasteTripsPage,
} from "@/lib/waste";
import {
  buildCarrierEfficiencySeries,
  carrierEfficiencyAxisMax,
  CARRIER_BENCHMARK_COLOR,
  CARRIER_POINT_COLOR,
  selectCarrierEfficiencyRows,
} from "@/lib/waste-dashboard-visuals";
import { Skeleton } from "@coss/ui/components/skeleton";
import { ChartBox } from "./ChartBox";
import { DatePicker, type DateRange } from "./DatePicker";
import { GranControl, type Gran } from "./GranControl";
import { InfoTip } from "./InfoTip";
import { Dot, Panel } from "./ui";

type View = "summary" | "structure" | "analytics" | "source";
type Option = { value: string; label: string; detail?: string };

const EMPTY_SELECTION: WasteSelection = { carriers: [], origins: [], wasteCodes: [] };
const FILTER = "waste-filter-control h-[52px] rounded-[12px] border border-white/[0.10] bg-[#0f1626] py-2.5 pl-4 pr-3 text-[18px] font-medium leading-6 text-[#e8e8e8] transition-colors";

function capitalizeWaste(value: string) {
  return value ? `${value.charAt(0).toLocaleUpperCase("ru")}${value.slice(1)}` : value;
}

function compactWasteName(value: string) {
  const name = capitalizeWaste(value);
  const normalized = name.toLocaleLowerCase("ru");
  if (normalized.includes("лом железобетонных")) return "Лом железобетона";
  if (normalized.includes("лом бетонных")) return "Лом бетона";
  if (normalized.includes("лом асфальтовых")) return "Лом асфальта";
  if (normalized.includes("грунт, образовавшийся")) return "Чистый грунт";
  if (normalized.includes("грунт насыпной")) return "Насыпной грунт";
  if (normalized.includes("отходы грунта") && normalized.includes("практически неопас")) return "Неопасный грунт";
  if (normalized.includes("отходы грунта") && normalized.includes("малоопас")) return "Малоопасный грунт";
  return name;
}

function DashboardTabs({ value, onChange }: { value: View; onChange: (value: View) => void }) {
  const tabs = [
    { value: "summary" as const, label: "Свод", lucide: Gauge, width: "w-[164px] lg:w-[180px]", shapePath: "M12 0H193.5C198.16 0 202.51 2.42 204.96 6.39L243.77 64.92C246.51 69.05 248.24 71.1 250 72H0V12C0 5.37 5.37 0 12 0Z" },
    { value: "structure" as const, label: "Структура", icon: "/waste/tab-summary.svg", width: "w-[164px] lg:w-[205px]", shapePath: "M12 0H193.5C198.16 0 202.51 2.42 204.96 6.39L243.77 64.92C246.51 69.05 248.24 71.1 250 72H0V12C0 5.37 5.37 0 12 0Z" },
    { value: "analytics" as const, label: "Аналитика", icon: "/waste/tab-analytics.svg", width: "w-[195px] lg:w-[240px]", shapePath: "M56.5 0H193.5C198.16 0 202.51 2.42 204.96 6.39L243.77 64.92C246.51 69.05 248.24 71.1 250 72H0C1.76 71.1 3.49 69.05 6.23 64.92L45.04 6.39C47.49 2.42 51.84 0 56.5 0Z" },
    { value: "source" as const, label: "Данные", lucide: ListChecks, width: "w-[185px] lg:w-[225px]", shapePath: "M56.5 0H193.5C198.16 0 202.51 2.42 204.96 6.39L243.77 64.92C246.51 69.05 248.24 71.1 250 72H0C1.76 71.1 3.49 69.05 6.23 64.92L45.04 6.39C47.49 2.42 51.84 0 56.5 0Z" },
  ];
  return (
    <nav className="waste-dashboard-tabs flex h-[52px] min-w-max items-stretch lg:h-[64px]" aria-label="Разделы дашборда">
      {tabs.map(({ value: tab, label, icon, lucide: TabIcon, width, shapePath }, index) => {
        const active = value === tab;
        return (
          <button
            key={tab}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(tab)}
            data-active={active ? "true" : "false"}
            className={`waste-dashboard-tab group relative flex h-full ${width} items-center justify-center text-[17px] font-semibold transition-colors duration-200 lg:text-[20px] ${active ? "text-[#eef0f5]" : "text-[#929caf] hover:text-[#d3d8e2]"}`}
            style={{ zIndex: active ? 20 : tabs.length - index }}
          >
            <span
              aria-hidden="true"
              className={`waste-dashboard-tab__shadow absolute inset-x-0 top-0 ${active ? "bottom-[-1px]" : "bottom-0"}`}
            >
              <svg
                className={`waste-dashboard-tab__shape absolute inset-0 size-full transition-colors duration-200 ${active ? "text-[#0f1626]" : "text-[#2a3955] group-hover:text-[#314361]"}`}
                viewBox="0 0 250 72"
                preserveAspectRatio="none"
              >
                <path d={shapePath} fill="currentColor" />
              </svg>
            </span>
            <span className="relative z-[1] flex h-full items-center justify-center gap-2">
              {TabIcon ? <TabIcon aria-hidden="true" className="size-[18px] shrink-0 lg:size-5" /> : <span
                aria-hidden="true"
                className="size-[18px] shrink-0 bg-current lg:size-5"
                style={{ WebkitMask: `url(${asset(icon!)}) center / contain no-repeat`, mask: `url(${asset(icon!)}) center / contain no-repeat` }}
              />}
              <span className="whitespace-nowrap leading-none">{label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function MultiSelect({ label, options, value, onChange }: {
  label: string; options: Option[]; value: string[]; onChange: (value: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    return needle ? options.filter((item) => `${item.label} ${item.detail ?? ""}`.toLocaleLowerCase("ru").includes(needle)) : options;
  }, [options, query]);
  const selected = new Set(value);
  const title = value.length === 0 ? label : value.length === 1 ? options.find((item) => item.value === value[0])?.label ?? label : `${label}: ${value.length}`;
  const toggle = (item: string) => onChange(selected.has(item) ? value.filter((v) => v !== item) : [...value, item]);

  return (
    <Popover.Root onOpenChange={(open) => { if (!open) setQuery(""); }}>
      <Popover.Trigger render={
        <button type="button" data-filtered={value.length > 0 ? "true" : "false"} className={`flex w-full min-w-0 items-center justify-between gap-3 text-left ${FILTER}`}>
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <span
            aria-hidden="true"
            className="size-5 shrink-0 bg-[#8a94a6]"
            style={{ WebkitMask: `url(${asset("/waste/filter-chevron.svg")}) center / contain no-repeat`, mask: `url(${asset("/waste/filter-chevron.svg")}) center / contain no-repeat` }}
          />
        </button>
      } />
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-[170]">
          <Popover.Popup className="w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[10px] border border-[#202c42] bg-[#0a101c] shadow-2xl outline-none">
            <div className="border-b border-white/[0.07] p-2.5">
              <div className="flex items-center rounded-[7px] border border-[#202c42] bg-[#080d16] px-3">
                <Search className="size-4 text-[#778399]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Поиск"
                  className="h-10 min-w-0 flex-1 bg-transparent px-2 text-[16px] text-[#e7eaf0] outline-none placeholder:text-[#69758a]"
                />
                {query && <button type="button" aria-label="Очистить поиск" onClick={() => setQuery("")}><X className="size-4 text-[#778399]" /></button>}
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2.5 text-[15px]">
              <button type="button" className="text-[#9ba6ba] hover:text-white" onClick={(event) => { event.stopPropagation(); onChange(options.map((item) => item.value)); }}>Выбрать все</button>
              <button type="button" className="text-[#9ba6ba] hover:text-white" onClick={(event) => { event.stopPropagation(); onChange([]); }}>Сбросить</button>
            </div>
            <div className="max-h-[330px] overflow-y-auto p-1.5">
              {visible.map((item) => {
                const active = selected.has(item.value);
                return (
                  <button key={item.value} type="button" onClick={(event) => { event.stopPropagation(); toggle(item.value); }} className="flex w-full items-start gap-2.5 rounded-[6px] px-2.5 py-2 text-left hover:bg-white/[0.06]">
                    <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${active ? "border-[#3f79d3] bg-[#2865bf]" : "border-[#3a4659]"}`}>
                      {active && <Check className="size-3 text-white" strokeWidth={2.5} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words text-[16px] leading-[22px] text-[#e3e7ef]">{item.label}</span>
                      {item.detail && <span className="block text-[14px] leading-5 text-[#7f8aa0]">{item.detail}</span>}
                    </span>
                  </button>
                );
              })}
              {!visible.length && <div className="px-3 py-8 text-center text-[16px] text-[#7f8aa0]">Ничего не найдено</div>}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

type HiddenFilter = "period" | "carriers" | "origins" | "wasteCodes";

function FilterBar({ meta, period, selection, onPeriod, onSelection, hidden = [] }: {
  meta: WasteFilters; period: DateRange; selection: WasteSelection;
  onPeriod: (period: DateRange) => void; onSelection: (selection: WasteSelection) => void;
  hidden?: HiddenFilter[];
}) {
  const [optionsMeta, setOptionsMeta] = useState(meta);

  useEffect(() => {
    const controller = new AbortController();
    fetch(withK(asset(wasteFiltersPath(period, selection))), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<WasteFilters>;
      })
      .then((filters) => {
        setOptionsMeta(filters);
        const allowedCarriers = new Set(filters.carriers);
        const allowedOrigins = new Set(filters.origins);
        const allowedWasteCodes = new Set(filters.wasteTypes.map((item) => item.code));
        const next = {
          carriers: selection.carriers.filter((value) => allowedCarriers.has(value)),
          origins: selection.origins.filter((value) => allowedOrigins.has(value)),
          wasteCodes: selection.wasteCodes.filter((value) => allowedWasteCodes.has(value)),
        };
        if (next.carriers.length !== selection.carriers.length
          || next.origins.length !== selection.origins.length
          || next.wasteCodes.length !== selection.wasteCodes.length) onSelection(next);
      })
      .catch((reason) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [period, selection, onSelection]);

  const carriers = optionsMeta.carriers.map((value) => ({ value, label: value }));
  const origins = optionsMeta.origins.map((value) => ({ value, label: value }));
  const waste = optionsMeta.wasteTypes.map((item) => ({ value: item.code, label: capitalizeWaste(item.name), detail: item.code }));
  const hiddenSet = new Set(hidden);
  return (
    <div className="waste-filter-bar grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:items-center lg:justify-end">
      {!hiddenSet.has("period") && <DatePicker min={meta.availablePeriod.from ?? period.from} max={meta.availablePeriod.to ?? period.to} value={period} onChange={onPeriod} triggerClassName={`${FILTER} w-full justify-between lg:w-[180px]`} />}
      {!hiddenSet.has("carriers") && <div className="min-w-0 lg:w-[220px]"><MultiSelect label="Все перевозчики" options={carriers} value={selection.carriers} onChange={(carriers) => onSelection({ ...selection, carriers })} /></div>}
      {!hiddenSet.has("origins") && <div className="min-w-0 lg:w-[320px]"><MultiSelect label="Все объекты образования" options={origins} value={selection.origins} onChange={(origins) => onSelection({ ...selection, origins })} /></div>}
      {!hiddenSet.has("wasteCodes") && <div className="min-w-0 lg:w-[240px]"><MultiSelect label="Все виды отходов" options={waste} value={selection.wasteCodes} onChange={(wasteCodes) => onSelection({ ...selection, wasteCodes })} /></div>}
    </div>
  );
}

function relativeChange(value: number, previous: number) {
  if (previous === 0) return value === 0 ? 0 : null;
  return ((value - previous) / previous) * 100;
}

function LoadingPanel({ className = "" }: { className?: string }) {
  return <Panel className={`${PANEL} ${className}`} bodyClassName="flex flex-col gap-4 p-5"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-3 w-1/3" /><Skeleton className="mt-2 min-h-[180px] flex-1 rounded-[8px]" /></Panel>;
}

const RING_RADIUS = 39;
const RING_STROKE = 15;
const RING_OUTER_RADIUS = RING_RADIUS + RING_STROKE / 2;
const RING_INNER_RADIUS = RING_RADIUS - RING_STROKE / 2;
const RING_CORNER_RADIUS = RING_STROKE / 4;

function ringSegmentGeometry(sharePct: number, offset: number, hasValue: boolean) {
  const gap = sharePct >= 8 ? 1.15 : sharePct >= 3 ? 0.85 : Math.min(0.55, sharePct * 0.28);
  const visible = Math.max(sharePct - gap, hasValue ? 0.18 : 0);

  return {
    visible,
    offset: offset + gap / 2,
  };
}

function polarPoint(radius: number, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
  };
}

function ringSegmentPath(offsetPct: number, visiblePct: number) {
  const startAngle = -90 + offsetPct * 3.6;
  const endAngle = startAngle + visiblePct * 3.6;
  const span = Math.max(endAngle - startAngle, 0.05);
  const corner = Math.min(RING_CORNER_RADIUS, Math.max(0.75, (span * Math.PI / 180) * RING_INNER_RADIUS * 0.22));
  const outerInset = Math.asin(Math.min(0.98, corner / RING_OUTER_RADIUS)) * 180 / Math.PI;
  const innerInset = Math.asin(Math.min(0.98, corner / RING_INNER_RADIUS)) * 180 / Math.PI;
  const outerStart = polarPoint(RING_OUTER_RADIUS, startAngle + outerInset);
  const outerEnd = polarPoint(RING_OUTER_RADIUS, endAngle - outerInset);
  const innerEnd = polarPoint(RING_INNER_RADIUS, endAngle - innerInset);
  const innerStart = polarPoint(RING_INNER_RADIUS, startAngle + innerInset);
  const endOuterControl = polarPoint(RING_OUTER_RADIUS, endAngle);
  const endOuterSide = polarPoint(RING_OUTER_RADIUS - corner, endAngle);
  const endInnerSide = polarPoint(RING_INNER_RADIUS + corner, endAngle);
  const endInnerControl = polarPoint(RING_INNER_RADIUS, endAngle);
  const startInnerControl = polarPoint(RING_INNER_RADIUS, startAngle);
  const startInnerSide = polarPoint(RING_INNER_RADIUS + corner, startAngle);
  const startOuterSide = polarPoint(RING_OUTER_RADIUS - corner, startAngle);
  const startOuterControl = polarPoint(RING_OUTER_RADIUS, startAngle);
  const largeArc = span > 180 ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${RING_OUTER_RADIUS} ${RING_OUTER_RADIUS} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `Q ${endOuterControl.x.toFixed(3)} ${endOuterControl.y.toFixed(3)} ${endOuterSide.x.toFixed(3)} ${endOuterSide.y.toFixed(3)}`,
    `L ${endInnerSide.x.toFixed(3)} ${endInnerSide.y.toFixed(3)}`,
    `Q ${endInnerControl.x.toFixed(3)} ${endInnerControl.y.toFixed(3)} ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${RING_INNER_RADIUS} ${RING_INNER_RADIUS} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    `Q ${startInnerControl.x.toFixed(3)} ${startInnerControl.y.toFixed(3)} ${startInnerSide.x.toFixed(3)} ${startInnerSide.y.toFixed(3)}`,
    `L ${startOuterSide.x.toFixed(3)} ${startOuterSide.y.toFixed(3)}`,
    `Q ${startOuterControl.x.toFixed(3)} ${startOuterControl.y.toFixed(3)} ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

function WasteBars({ rows, colors, total, onOpen, totalPosition = "bottom" }: {
  rows: WasteDashboardData["wasteStructure"];
  colors: string[];
  total: number | null;
  onOpen?: () => void;
  totalPosition?: "top" | "bottom";
}) {
  const { frameRef, tooltipRef, hovered, moveTooltip, clearTooltip } = useRingTooltip();
  const maxTons = Math.max(1, ...rows.map((row) => row.tons));

  return (
    <div ref={frameRef} className="waste-ranking-frame" role="img" aria-label={`Структура массы отходов, всего ${formatNumber(total, 2)} тонн`}>
      {totalPosition === "top" && (
        <div className="waste-ranking-total waste-ranking-total--top">
          <span>Итого</span>
          <strong>{formatNumber(total, 0)}</strong>
          <span>100%</span>
        </div>
      )}
      <div className="waste-ranking-list">
        {rows.map((row, index) => (
          <div
            key={row.code}
            className="waste-ranking-row w-full text-left"
            onClick={onOpen}
            onPointerMove={(event) => moveTooltip(index, event.clientX, event.clientY)}
            onPointerLeave={clearTooltip}
          >
            <span className="waste-ranking-index">{index + 1}</span>
            <span className="waste-ranking-name" title={capitalizeWaste(row.name)}>
              <Dot className="size-2.5 shrink-0" style={{ background: colors[index] }} />
              <span>{totalPosition === "bottom" ? compactWasteName(row.name) : capitalizeWaste(row.name)}</span>
            </span>
            <span className="waste-ranking-track" aria-hidden="true">
              <span
                className="waste-ranking-fill"
                style={{ width: `${(row.tons / maxTons) * 100}%`, background: colors[index], animationDelay: `${index * 80}ms` }}
              />
            </span>
            <strong className="waste-ranking-value">{formatNumber(row.tons, 0)}</strong>
            <span className="waste-ranking-share">{formatNumber(row.sharePct, 1)}%</span>
          </div>
        ))}
      </div>
      {totalPosition === "bottom" && (
        <div className="waste-ranking-total">
          <span>Итого</span>
          <strong>{formatNumber(total, 0)}</strong>
          <span>100%</span>
        </div>
      )}
      {hovered && rows[hovered.index] && (
        <div ref={tooltipRef} className="waste-ring-tooltip waste-ranking-tooltip" style={{ left: hovered.x, top: hovered.y }}>
          <div className="waste-chart-tooltip">
            <div className="waste-chart-tooltip__heading">
              <span className="waste-chart-tooltip__dot" style={{ background: colors[hovered.index] }} />
              <span className="waste-chart-tooltip__title">{capitalizeWaste(rows[hovered.index].name)}</span>
            </div>
            {rows[hovered.index].code !== "__other__" && <div className="waste-chart-tooltip__code">ФККО {rows[hovered.index].code}</div>}
            <div className="waste-chart-tooltip__metrics">
              <strong>{formatNumber(rows[hovered.index].tons, 2)} т</strong>
              <span>{formatNumber(rows[hovered.index].sharePct, 1)}% от известной массы</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WasteStructureModal({ open, onClose, meta, initialPeriod, initialSelection }: {
  open: boolean;
  onClose: () => void;
  meta: WasteFilters;
  initialPeriod: DateRange;
  initialSelection: WasteSelection;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [selection, setSelection] = useState(initialSelection);
  const [modalData, setModalData] = useState<WasteDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPeriod(initialPeriod);
    setSelection({ ...initialSelection, wasteCodes: [] });
  }, [open, initialPeriod, initialSelection]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    fetch(withK(asset("/api/waste/dashboard")), {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ period, filters: selection, granularity: "day", wasteLimit: 1000 }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<WasteDashboardData>;
      })
      .then((next) => { setModalData(next); setLoading(false); })
      .catch((reason) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [open, period, selection]);
  const rows = modalData?.wasteStructure ?? [];
  const colors = rows.map((_, index) => WASTE_COLORS[index % WASTE_COLORS.length]);
  const updated = formatUpdated(modalData?.dataThrough ?? null);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[140] bg-black/65 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <div className="pointer-events-none fixed inset-0 z-[141] overflow-y-auto overscroll-contain p-3 sm:p-5">
          <Dialog.Popup className="pointer-events-auto mx-auto mt-1 mb-4 flex h-[min(92dvh,1040px)] min-h-[620px] w-[min(94vw,110rem)] flex-col rounded-[12px] border border-[#202c42] bg-[#050912] p-5 shadow-2xl outline-none transition-[opacity,transform] duration-200 ease-out data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Dialog.Title className="text-[27px] font-semibold leading-9 text-[#eef0f5]">Структура видов отходов</Dialog.Title>
                <Dialog.Description className="mt-1 text-[15px] leading-[22px] text-[#7f899b]">{updated ? `Обновлено ${updated} · ` : ""}масса завершенных рейсов, т</Dialog.Description>
              </div>
              <Dialog.Close className="flex size-9 shrink-0 items-center justify-center rounded-[8px] text-[#8f99aa] transition-colors hover:bg-white/[0.06] hover:text-white" aria-label="Закрыть">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="mb-4 border-b border-white/[0.07] pb-4">
              <FilterBar
                meta={meta}
                period={period}
                selection={selection}
                onPeriod={setPeriod}
                onSelection={setSelection}
                hidden={["wasteCodes"]}
              />
            </div>
            <div className="waste-modal-ranking min-h-0 flex-1">
              {loading && !modalData ? <LoadingPanel className="min-h-[460px]" />
                : error ? <div className="flex min-h-[420px] items-center justify-center text-[16px] text-[#8f99aa]">Не удалось загрузить детализацию</div>
                  : rows.length ? <WasteBars rows={rows} colors={colors} total={modalData?.metrics.mass.value ?? null} totalPosition="top" />
                    : <div className="flex min-h-[420px] items-center justify-center text-[16px] text-[#8f99aa]">Нет данных для выбранных фильтров</div>}
            </div>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function WasteStructurePanel({ data, updated, meta, period, selection }: {
  data: WasteDashboardData;
  updated: string;
  meta: WasteFilters;
  period: DateRange;
  selection: WasteSelection;
}) {
  const [open, setOpen] = useState(false);
  const rows = data.wasteStructure;
  const colors = rows.map((_, index) => WASTE_COLORS[index % WASTE_COLORS.length]);
  return (
    <>
      <div
        className="waste-structure-entry group relative min-h-[510px] outline-none lg:min-h-0"
        role="button"
        tabIndex={0}
        aria-label="Открыть полную структуру видов отходов"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a")) return;
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span aria-hidden className="waste-structure-entry__icon absolute right-4 top-4 z-20 inline-flex size-7 items-center justify-center rounded-[7px] border border-white/[0.08] bg-white/[0.025] text-[#737f92]">
          <ArrowUpRight className="size-4" />
        </span>
        <Panel
          className={`${PANEL} waste-dashboard-panel h-full min-h-[510px] lg:min-h-0`}
          headerClassName={PANEL_HEADER}
          bodyClassName="waste-panel-body flex min-h-0 flex-1 flex-col pb-4 pt-0"
          title={<PanelHeading title="Структура видов отходов" subtitle="масса, тонн" updated={updated} tip="Рейтинг видов отходов по известной положительной массе завершенных рейсов. Нажмите на карточку, чтобы открыть детализацию." />}
        >
          <WasteBars rows={rows} colors={colors} total={data.metrics.mass.value} />
        </Panel>
      </div>
      <WasteStructureModal open={open} onClose={() => setOpen(false)} meta={meta} initialPeriod={period} initialSelection={selection} />
    </>
  );
}

function StatusRing({ groups, completedShare, totalTrips }: {
  groups: Array<{ key: string; label: string; color: string; value: number; previous: number; sharePct: number }>;
  completedShare: number;
  totalTrips: number;
}) {
  const { frameRef, tooltipRef, hovered, moveTooltip, clearTooltip } = useRingTooltip();
  let offset = 0;
  return (
    <div ref={frameRef} className="waste-ring-frame">
      <svg viewBox="0 0 100 100" className="size-full overflow-visible" role="img" aria-label={`Завершено ${formatNumber(completedShare, 1)}% рейсов`}>
        {groups.map((group, index) => {
          const segment = ringSegmentGeometry(group.sharePct, offset, group.value > 0);
          offset += group.sharePct;
          return (
            <path
              key={group.key}
              d={ringSegmentPath(segment.offset, segment.visible)}
              fill={group.color}
              className="waste-ring-segment waste-status-segment"
              style={{ animationDelay: `${index * 90}ms` }}
              tabIndex={0}
              onPointerMove={(event) => moveTooltip(index, event.clientX, event.clientY)}
              onPointerLeave={clearTooltip}
              onFocus={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                moveTooltip(index, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
              }}
              onBlur={clearTooltip}
            />
          );
        })}
      </svg>
      <div className="waste-ring-center">
        <div className="font-semibold text-[clamp(34px,6.1cqw,46px)] tabular-nums text-[#eef0f5]">{formatNumber(totalTrips)}</div>
        <div className="mt-1 text-[clamp(15px,2.9cqw,18px)] uppercase text-[#8b94a4]">рейсов</div>
        <div className="mt-1.5 text-[clamp(14px,2.65cqw,17px)] font-medium text-[#43be6b]">{formatNumber(completedShare, 1)}% завершено</div>
      </div>
      {hovered && groups[hovered.index] && (
        <div ref={tooltipRef} className="waste-ring-tooltip waste-ring-tooltip--status" style={{ left: hovered.x, top: hovered.y }}>
          <div className="waste-chart-tooltip">
            <div className="waste-chart-tooltip__heading">
              <span className="waste-chart-tooltip__dot" style={{ background: groups[hovered.index].color }} />
              <span className="waste-chart-tooltip__title">{groups[hovered.index].label}</span>
            </div>
            <div className="waste-chart-tooltip__metrics">
              <strong>{formatNumber(groups[hovered.index].value)} рейсов</strong>
              <span>{formatNumber(groups[hovered.index].sharePct, 1)}% от всех рейсов</span>
            </div>
            <div className="waste-chart-tooltip__delta">
              Динамика к прошлому периоду: <Delta value={relativeChange(groups[hovered.index].value, groups[hovered.index].previous)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPanel({ data, updated }: { data: WasteDashboardData; updated: string }) {
  const groups = useMemo(() => {
    const buckets = [
      { key: "completed", label: "Выполнено", color: "#43be6b", value: 0, previous: 0 },
      { key: "transit", label: "В пути", color: "#c7b348", value: 0, previous: 0 },
      { key: "weighing", label: "На взвешивание", color: "#4d78c6", value: 0, previous: 0 },
      { key: "canceled", label: "Отменено", color: "#c44b4d", value: 0, previous: 0 },
    ];
    for (const row of data.statusStructure) {
      const status = row.status.trim().toLocaleLowerCase("ru");
      const index = status === "завершен" ? 0
        : status.includes("отмен") || status.includes("отклон") ? 3
          : status.includes("разгруз") || status.includes("приема") || status.includes("взвеш") ? 2
            : 1;
      buckets[index].value += row.value;
      buckets[index].previous += row.previous;
    }
    const total = buckets.reduce((sum, row) => sum + row.value, 0);
    return buckets.map((row) => ({ ...row, sharePct: total > 0 ? (row.value / total) * 100 : 0 }));
  }, [data.statusStructure]);
  return (
    <Panel className={`${PANEL} waste-dashboard-panel min-h-[510px] lg:min-h-0`} headerClassName={PANEL_HEADER} bodyClassName="waste-panel-body waste-status-layout min-h-0 flex-1 pb-4 pt-0" title={<PanelHeading title="Доля завершенных рейсов" subtitle="количество рейсов" updated={updated} tip="Доля рейсов с точным статусом «Завершен» среди всех рейсов выбранного периода." />}>
      <div className="waste-status-chart waste-donut-stage flex min-h-[250px] min-w-0 flex-1 items-center justify-center">
        <StatusRing groups={groups} completedShare={data.metrics.completedShare.value} totalTrips={data.metrics.trips.value} />
      </div>
      <div className="waste-status-legend waste-status-legend--detailed grid min-w-0 grid-cols-2 gap-x-6 gap-y-3">
        {groups.map((row) => (
          <div key={row.key} className="waste-status-legend-item min-w-0">
            <div className="flex min-w-0 items-center gap-2.5 text-[19px] font-medium leading-6 text-[#a7b0c0]">
              <Dot className="size-2.5 shrink-0" style={{ background: row.color }} />
              <span className="truncate">{row.label}</span>
            </div>
            <div className="ml-5 mt-0.5 flex items-baseline gap-2 tabular-nums">
              <strong className="text-[25px] font-semibold text-[#eef0f5]">{formatNumber(row.value)}</strong>
              <span className="text-[17px] font-semibold"><Delta value={relativeChange(row.value, row.previous)} /></span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const INFRA = [
  { key: "vehicles" as const, label: "Транспорт", Icon: Truck, color: "#287bd8" },
  { key: "originSites" as const, label: "Объекты образования", Icon: Building2, color: "#31aeba" },
  { key: "receptionSites" as const, label: "Объекты приема", Icon: Warehouse, color: "#43be6b" },
  { key: "carriers" as const, label: "Перевозчики", Icon: Users, color: "#c7b348" },
];

function InfrastructurePanel({ data, totals, updated }: { data: WasteDashboardData; totals: WasteDashboardData; updated: string }) {
  const { frameRef, tooltipRef, hovered, moveTooltip, clearTooltip } = useRingTooltip();
  return (
    <Panel className={`${PANEL} waste-dashboard-panel min-h-[420px] lg:min-h-0`} headerClassName={PANEL_HEADER} bodyClassName="waste-panel-body flex min-h-0 flex-1 flex-col pb-4 pt-0" title={<PanelHeading title="Задействованность ресурсов" subtitle="уникальные объекты" updated={updated} tip="Уникальные ресурсы выбранного периода относительно всех ресурсов в доступном диапазоне базы с учетом активных фильтров." />}>
      <div ref={frameRef} className="waste-resource-list">
        {INFRA.map(({ key, label, Icon, color }, index) => {
          const metric = data.metrics[key];
          const total = Math.max(metric.value, totals.metrics[key].value);
          const share = total > 0 ? metric.value / total * 100 : 0;
          return (
            <div
              key={key}
              className="waste-resource-row"
              tabIndex={0}
              onPointerMove={(event) => moveTooltip(index, event.clientX, event.clientY)}
              onPointerLeave={clearTooltip}
              onFocus={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                moveTooltip(index, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
              }}
              onBlur={clearTooltip}
            >
              <div className="waste-resource-icon" style={{ borderColor: `${color}70`, background: `${color}16`, color }}><Icon className="size-5" strokeWidth={1.8} /></div>
              <span className="waste-resource-label">{label}</span>
              <span className="waste-resource-track" aria-hidden="true"><span className="waste-resource-fill" style={{ width: `${share}%`, animationDelay: `${index * 80}ms` }} /></span>
              <span className="waste-resource-ratio"><strong>{formatNumber(metric.value)}</strong><span>/ {formatNumber(total)}</span></span>
              <strong className="waste-resource-share">{formatNumber(share, 1)}%</strong>
            </div>
          );
        })}
        {hovered && INFRA[hovered.index] && (() => {
          const item = INFRA[hovered.index];
          const current = data.metrics[item.key].value;
          const total = Math.max(current, totals.metrics[item.key].value);
          const share = total > 0 ? current / total * 100 : 0;
          return (
            <div ref={tooltipRef} className="waste-ring-tooltip waste-resource-tooltip" style={{ left: hovered.x, top: hovered.y }}>
              <div className="waste-chart-tooltip waste-chart-tooltip--compact">
                <div className="waste-chart-tooltip__heading">
                  <span className="waste-chart-tooltip__dot" style={{ background: item.color }} />
                  <span className="waste-chart-tooltip__title">{item.label}</span>
                </div>
                <div className="waste-chart-tooltip__metrics">
                  <strong>{formatNumber(current)} / {formatNumber(total)}</strong>
                  <span>{formatNumber(share, 1)}% задействовано</span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </Panel>
  );
}

const ANALYTICS_COLORS = ["#2878e8", "#43be6b", "#a55de8"];
const ANALYTICS_HEAT_COLORS = ["#102a4c", "#17518a", "#1e75a4", "#2998a4", "#43aa83", "#8bb55d", "#c5ad4b", "#df7948", "#cf4558"];

type AnalyticsTrendPoint = { label: string; value: number | null };

function toTrendPoints(rows: Array<{ day: string; value: number | null }> = []): AnalyticsTrendPoint[] {
  const days = new Map<string, { sum: number; count: number }>();
  rows.forEach((row) => {
    const label = row.day.slice(0, 10);
    const current = days.get(label) ?? { sum: 0, count: 0 };
    if (row.value != null && Number.isFinite(row.value)) {
      current.sum += row.value;
      current.count += 1;
    }
    days.set(label, current);
  });
  return [...days.entries()].map(([label, day]) => ({
    label,
    value: day.count ? day.sum / day.count : null,
  }));
}

function toTripTrendPoints(rows: Array<{ bucket: string; value: number }> = []): AnalyticsTrendPoint[] {
  const days = new Map<string, number>();
  rows.forEach((row) => {
    const label = row.bucket.slice(0, 10);
    days.set(label, (days.get(label) ?? 0) + row.value);
  });
  return [...days.entries()].map(([label, value]) => ({ label, value }));
}

type AnalyticsRankingKind = "carriers" | "origins" | "receptions";

const ANALYTICS_RANKING_META: Record<AnalyticsRankingKind, { title: string; tip: string }> = {
  carriers: { title: "Топ перевозчиков", tip: "Перевозчики с наибольшим количеством рейсов после применения всех фильтров." },
  origins: { title: "Топ объектов образования", tip: "Объекты образования с наибольшим количеством рейсов после применения всех фильтров." },
  receptions: { title: "Топ объектов приема", tip: "Объекты приема с наибольшим количеством рейсов после применения всех фильтров." },
};

function selectionForRanking(kind: AnalyticsRankingKind, selection: WasteSelection): WasteSelection {
  if (kind === "carriers") return { ...selection, carriers: [] };
  if (kind === "origins") return { ...selection, origins: [] };
  return selection;
}

function AnalyticsRanking({ kind, rows, color, total, updated, onOpen }: {
  kind: AnalyticsRankingKind;
  rows: AnalyticsRankingRow[];
  color: string;
  total: number;
  updated: string;
  onOpen: () => void;
}) {
  const { title, tip } = ANALYTICS_RANKING_META[kind];
  const topRows = rows.slice(0, 5);
  return (
    <div className="waste-ranking-entry waste-structure-entry group relative min-h-0 outline-none" role="button" tabIndex={0} onClick={(event) => { if (!(event.target as HTMLElement).closest("button, a")) onOpen(); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(); } }}>
      <span aria-hidden className="waste-structure-entry__icon absolute right-4 top-4 z-20 inline-flex size-7 items-center justify-center rounded-[7px] border border-white/[0.08] bg-white/[0.025] text-[#737f92]"><ArrowUpRight className="size-4" /></span>
      <Panel className={`${PANEL} waste-dashboard-panel waste-analytics-ranking-panel`} headerClassName={PANEL_HEADER} bodyClassName="waste-panel-body flex min-h-0 flex-1 flex-col pb-3 pt-0" title={<PanelHeading title={title} subtitle="количество рейсов" updated={updated} tip={`${tip} Нажмите на карточку, чтобы открыть полный рейтинг.`} />}>
        <AnalyticsRankingBars rows={topRows} color={color} total={total} onOpen={onOpen} />
      </Panel>
    </div>
  );
}

function AnalyticsRankingModal({ kind, open, onClose, meta, initialPeriod, initialSelection, initialData }: {
  kind: AnalyticsRankingKind | null;
  open: boolean;
  onClose: () => void;
  meta: WasteFilters;
  initialPeriod: DateRange;
  initialSelection: WasteSelection;
  initialData: WasteDashboardData;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [selection, setSelection] = useState(initialSelection);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!open || !kind) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;
    setPeriod(initialPeriod);
    setSelection(selectionForRanking(kind, initialSelection));
    setData(initialData);
  }, [open, kind, initialPeriod, initialSelection, initialData]);
  useEffect(() => {
    if (!open || !kind) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(withK(asset("/api/waste/dashboard")), {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ period, filters: selection, granularity: "day", rankingLimit: "all", includeDetails: false, includeAnalytics: true }),
    })
      .then(async (response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<WasteDashboardData>; })
      .then((next) => { setData(next); setLoading(false); })
      .catch((reason) => { if (reason instanceof Error && reason.name === "AbortError") return; setLoading(false); });
    return () => controller.abort();
  }, [open, kind, period, selection]);
  if (!kind) return null;
  const rows = data.analytics.rankings[kind];
  const total = rows.reduce((sum, row) => sum + row.trips, 0);
  const title = ANALYTICS_RANKING_META[kind].title;
  const color = ANALYTICS_COLORS[kind === "carriers" ? 0 : kind === "origins" ? 1 : 2];
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[140] bg-black/65 backdrop-blur-sm" />
        <div className="pointer-events-none fixed inset-0 z-[141] overflow-y-auto overscroll-contain p-3 sm:p-5">
          <Dialog.Popup className="pointer-events-auto mx-auto my-2 flex h-[min(90dvh,980px)] min-h-[600px] w-[min(94vw,104rem)] flex-col rounded-[12px] border border-[#202c42] bg-[#050912] p-5 shadow-2xl outline-none sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4"><div><Dialog.Title className="text-[27px] font-semibold text-[#eef0f5]">{title}</Dialog.Title><Dialog.Description className="mt-1 text-[15px] text-[#7f899b]">Полный рейтинг · {formatNumber(rows.length)} строк</Dialog.Description></div><Dialog.Close className="flex size-9 items-center justify-center rounded-[8px] text-[#8f99aa] hover:bg-white/[0.06] hover:text-white" aria-label="Закрыть"><X className="size-4" /></Dialog.Close></div>
            <div className="mb-4 border-b border-white/[0.07] pb-4"><FilterBar meta={meta} period={period} selection={selection} onPeriod={setPeriod} onSelection={setSelection} hidden={kind === "carriers" ? ["carriers"] : kind === "origins" ? ["origins"] : []} /></div>
            <div className="waste-modal-ranking relative min-h-0 flex-1">
              <AnalyticsRankingBars rows={rows} color={color} total={total} totalPosition="top" />
              {loading && <div className="pointer-events-none sticky bottom-3 ml-auto flex w-fit items-center gap-2 rounded-[7px] border border-white/[0.08] bg-[#080d16]/95 px-3 py-2 text-[14px] text-[#9aa4b6]"><Loader2 className="size-3.5 animate-spin" />Обновление</div>}
            </div>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type HeatmapCellSelection = { day: string; hour: number; trips: number };
type TripsInterval = { from: string; to: string };

function AnalyticsHeatmap({ rows, meta, selection, updated = "", compact = false }: {
  rows: WasteDashboardData["analytics"]["intensity"];
  meta: WasteFilters;
  selection: WasteSelection;
  updated?: string;
  compact?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<{ day: string; hour: number; trips: number; x: number; y: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<HeatmapCellSelection | null>(null);
  const days = [...new Set(rows.map((row) => row.day))];
  const shortPeriod = !compact && days.length <= 2;
  const values = new Map(rows.map((row) => [`${row.day}-${row.hour}`, row.trips]));
  const max = Math.max(1, ...rows.map((row) => row.trips));
  const heatColor = (trips: number) => {
    const normalized = Math.max(0, trips) / max;
    return ANALYTICS_HEAT_COLORS[Math.min(ANALYTICS_HEAT_COLORS.length - 1, Math.floor(normalized * (ANALYTICS_HEAT_COLORS.length - 1)))];
  };
  const weekdayRows = useMemo(() => {
    const labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const matrix = labels.map((label) => ({ label, values: [0, 0, 0, 0] }));
    for (const row of rows) {
      const day = new Date(`${row.day}T00:00:00Z`);
      const weekday = (day.getUTCDay() + 6) % 7;
      matrix[weekday].values[Math.min(3, Math.floor(row.hour / 6))] += row.trips;
    }
    return matrix;
  }, [rows]);
  const compactMax = Math.max(1, ...weekdayRows.flatMap((row) => row.values));
  const show = (event: React.PointerEvent, day: string, hour: number, trips: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    const scaleX = bounds.width / Math.max(frame.offsetWidth, 1);
    const scaleY = bounds.height / Math.max(frame.offsetHeight, 1);
    const cursorX = (event.clientX - bounds.left) / Math.max(scaleX, 0.001);
    const cursorY = (event.clientY - bounds.top) / Math.max(scaleY, 0.001);
    const width = 248;
    const height = 112;
    const x = cursorX + width + 18 <= frame.offsetWidth
      ? cursorX + 14
      : Math.max(8, cursorX - width - 14);
    const y = cursorY >= height + 18
      ? cursorY - height - 12
      : Math.min(frame.offsetHeight - height - 8, cursorY + 16);
    setHovered({ day, hour, trips, x, y });
  };
  return (
    <Panel
      className={`${PANEL} waste-dashboard-panel waste-analytics-heat-panel ${compact ? "waste-analytics-heat-panel--compact" : ""}`}
      headerClassName={compact ? "waste-analytics-panel-header" : PANEL_HEADER}
      bodyClassName="waste-analytics-heat-body"
      title={compact
        ? <div className="flex items-center gap-1.5"><span className="waste-analytics-panel-title">Интенсивность день / время</span><InfoTip label="Интенсивность рейсов" text="Распределение всех рейсов выбранного периода по календарным дням и часам Москвы." /></div>
        : <PanelHeading title="Интенсивность рейсов" subtitle="по дням и часам" updated={updated} tip="Распределение всех рейсов выбранного периода по календарным дням и часам Москвы." />}
    >
      <div ref={frameRef} className="waste-analytics-heat-frame" onPointerLeave={() => setHovered(null)}>
        {compact ? (
          <div className="waste-trips-intensity-grid">
            <span />
            {["00–06", "06–12", "12–18", "18–24"].map((label) => <span className="waste-trips-intensity-head" key={label}>{label}</span>)}
            {weekdayRows.map((row, weekdayIndex) => <div className="contents" key={row.label}>
              <span className="waste-trips-intensity-day">{row.label}</span>
              {row.values.map((trips, block) => {
                const ratio = trips / compactMax;
                return <button key={block} type="button" className="waste-trips-intensity-cell" style={{ "--activity": ratio, "--waste-cell-delay": `${(weekdayIndex * 4 + block) * 12}ms` } as React.CSSProperties} onPointerMove={(event) => show(event, row.label, block * 6, trips)}><span>{formatNumber(trips)}</span></button>;
              })}
            </div>)}
          </div>
        ) : <div className="waste-analytics-heat-scroll">
          <div className={`waste-analytics-heat-grid ${shortPeriod ? "waste-analytics-heat-grid--short" : ""}`} style={{ gridTemplateColumns: shortPeriod ? "92px repeat(6, minmax(34px, 1fr))" : "58px repeat(24, minmax(12px, 1fr))" }}>
            {!shortPeriod && <>
              <span />
              {Array.from({ length: 24 }, (_, hour) => <span className="waste-analytics-heat-hour" key={hour}>{hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}</span>)}
            </>}
            {shortPeriod ? days.map((day, dayIndex) => (
              <div className="contents" key={day}>
                {[0, 6, 12, 18].map((startHour) => (
                  <div className="contents" key={startHour}>
                    <span className="waste-analytics-heat-day waste-analytics-heat-day--short">
                      <strong>{day.slice(8, 10)}.{day.slice(5, 7)}</strong>
                      <small>{String(startHour).padStart(2, "0")}–{String(startHour + 5).padStart(2, "0")}</small>
                    </span>
                    {Array.from({ length: 6 }, (_, offset) => {
                      const hour = startHour + offset;
                      const trips = values.get(`${day}-${hour}`) ?? 0;
                      return <button key={hour} type="button" aria-label={`${day}, ${hour}:00, ${trips} рейсов`} className="waste-analytics-heat-cell waste-analytics-heat-cell--labeled" style={{ background: heatColor(trips), "--waste-cell-delay": `${Math.min(dayIndex * 24 + hour, 120) * 3}ms` } as React.CSSProperties} onPointerMove={(event) => show(event, day, hour, trips)} onClick={() => setSelectedCell({ day, hour, trips })}><span>{formatNumber(trips)}</span></button>;
                    })}
                  </div>
                ))}
              </div>
            )) : days.map((day, dayIndex) => (
              <div className="contents" key={day}>
                <span className="waste-analytics-heat-day">{day.slice(8, 10)}.{day.slice(5, 7)}</span>
                {Array.from({ length: 24 }, (_, hour) => {
                  const trips = values.get(`${day}-${hour}`) ?? 0;
                  return <button key={hour} type="button" aria-label={`${day}, ${hour}:00, ${trips} рейсов`} className="waste-analytics-heat-cell waste-analytics-heat-cell--labeled" style={{ background: heatColor(trips), "--waste-cell-delay": `${Math.min(dayIndex * 24 + hour, 120) * 3}ms` } as React.CSSProperties} onPointerMove={(event) => show(event, day, hour, trips)} onClick={() => setSelectedCell({ day, hour, trips })}><span>{formatNumber(trips)}</span></button>;
                })}
              </div>
            ))}
          </div>
        </div>}
        {!compact && <div className="waste-analytics-heat-scale"><span>Ниже</span>{ANALYTICS_HEAT_COLORS.map((color) => <i key={color} style={{ background: color }} />)}<span>Выше</span></div>}
        {hovered && <div className="waste-trend-tooltip" style={{ left: hovered.x, top: hovered.y, width: 248 }}><div className="waste-chart-tooltip waste-chart-tooltip--compact waste-chart-tooltip--heat"><div className="waste-chart-tooltip__heading"><span className="waste-chart-tooltip__dot" style={{ background: heatColor(hovered.trips) }} /><span className="waste-chart-tooltip__title">{compact ? `${hovered.day} · ${String(hovered.hour).padStart(2, "0")}–${String(hovered.hour + 6).padStart(2, "0")}` : `${hovered.day.slice(8, 10)}.${hovered.day.slice(5, 7)} · ${String(hovered.hour).padStart(2, "0")}:00`}</span></div><div className="waste-chart-tooltip__metrics"><strong>{formatNumber(hovered.trips)} рейсов</strong><span>{compact ? "Интервал 6 часов" : "Интервал 1 час"}</span></div></div></div>}
      </div>
      {!compact && <HeatmapTripsModal cell={selectedCell} onClose={() => setSelectedCell(null)} meta={meta} initialSelection={selection} />}
    </Panel>
  );
}

function chartText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function carrierEfficiencyTooltip(
  row: AnalyticsRankingRow | CarrierEfficiencyAverage,
  isAverage: boolean,
  average: CarrierEfficiencyAverage | null,
) {
  const color = isAverage ? CARRIER_BENCHMARK_COLOR : CARRIER_POINT_COLOR;
  const signedPercent = (value: number) => `${value > 0 ? "+" : ""}${formatNumber(value, 1)}%`;
  const tripsDelta = average?.trips ? (row.trips / average.trips - 1) * 100 : null;
  const massDelta = average?.mass && row.mass != null ? (row.mass / average.mass - 1) * 100 : null;
  const comparison = isAverage
    ? `Среднее рассчитано по ${formatNumber(average?.carriers ?? 0)} перевозчикам с известной массой`
    : tripsDelta != null && massDelta != null
      ? `К среднему: рейсы ${signedPercent(tripsDelta)} · масса ${signedPercent(massDelta)}`
      : "";
  return `<div class="waste-chart-tooltip waste-chart-tooltip--scatter"><div class="waste-chart-tooltip__heading"><span class="waste-chart-tooltip__dot" style="background:${color}"></span><span class="waste-chart-tooltip__title">${chartText(row.name)}</span></div><div class="waste-chart-tooltip__metrics"><span><b>${formatNumber(row.trips, isAverage ? 1 : 0)}</b> рейсов</span><span><b>${formatNumber(row.mass, 1)}</b> т известной массы</span><span><b>${formatNumber(row.vehicles, isAverage ? 1 : 0)}</b> ТС</span></div>${comparison ? `<div class="waste-chart-tooltip__delta">${comparison}</div>` : ""}</div>`;
}

function CarrierEfficiency({ rows, average, selectedCarriers, updated }: {
  rows: AnalyticsRankingRow[];
  average: CarrierEfficiencyAverage | null;
  selectedCarriers: string[];
  updated: string;
}) {
  const plotted = useMemo(() => selectCarrierEfficiencyRows(rows, selectedCarriers), [rows, selectedCarriers]);
  const regularMarkerSize = selectedCarriers.length || plotted.length <= 80 ? 6 : 4;
  const maxTrips = carrierEfficiencyAxisMax(plotted, average, "trips");
  const maxMass = carrierEfficiencyAxisMax(plotted, average, "mass");
  const series = useMemo(() => buildCarrierEfficiencySeries(plotted, average), [average, plotted]);
  const options = useMemo<ApexOptions>(() => ({
    chart: { type: "scatter", toolbar: { show: false }, animations: { enabled: true, speed: 550 }, fontFamily: "inherit", foreColor: "#8b94a4" },
    colors: [CARRIER_POINT_COLOR, CARRIER_BENCHMARK_COLOR],
    annotations: average ? {
      xaxis: [{ x: average.trips, borderColor: "rgba(203, 213, 228, 0.34)", strokeDashArray: 5 }],
      yaxis: [{ y: average.mass ?? 0, borderColor: "rgba(203, 213, 228, 0.34)", strokeDashArray: 5 }],
    } : undefined,
    grid: { borderColor: "rgba(255,255,255,0.07)", strokeDashArray: 2, padding: { left: 8, right: 12, top: 8, bottom: -2 } },
    markers: {
      size: average ? [regularMarkerSize, 10] : regularMarkerSize,
      strokeWidth: 2,
      strokeColors: "#101827",
      hover: { sizeOffset: 3 },
      discrete: average ? [{
        seriesIndex: 1,
        dataPointIndex: 0,
        fillColor: "#f2f5fa",
        strokeColor: "#7d8ba0",
        size: 10,
        shape: "circle",
      }] : [],
    },
    dataLabels: { enabled: false },
    xaxis: { min: 0, max: maxTrips, tickAmount: 5, title: { text: "Рейсы", style: { color: "#737e91", fontSize: "13px", fontWeight: 400 } }, labels: { formatter: (value: string) => formatNumber(Number(value)), style: { fontSize: "13px" } }, axisBorder: { color: "rgba(255,255,255,0.1)" }, axisTicks: { show: false }, tooltip: { enabled: true, formatter: (value: string) => `${formatNumber(Number(value))} рейсов`, style: { fontSize: "12px", fontFamily: "inherit" } }, crosshairs: { show: true, width: 1, position: "front", stroke: { color: "rgba(177, 190, 210, 0.55)", width: 1, dashArray: 4 } } },
    yaxis: { min: 0, max: maxMass, tickAmount: 5, title: { text: "Масса, т", style: { color: "#737e91", fontSize: "13px", fontWeight: 400 } }, labels: { formatter: (value: number) => formatNumber(value), style: { fontSize: "13px" } }, tooltip: { enabled: true, offsetX: -2 }, crosshairs: { show: true, position: "front", stroke: { color: "rgba(177, 190, 210, 0.55)", width: 1, dashArray: 4 } } },
    legend: { show: false },
    tooltip: { intersect: true, shared: false, custom: ({ seriesIndex, dataPointIndex }: { seriesIndex: number; dataPointIndex: number }) => { const isAverage = Boolean(average && seriesIndex === 1); const row = isAverage ? average : plotted[dataPointIndex]; return row ? carrierEfficiencyTooltip(row, isAverage, average) : ""; } },
    noData: { text: "Нет данных о массе", style: { color: "#737e91" } },
  }), [average, maxMass, maxTrips, plotted, regularMarkerSize]);
  return (
    <Panel className={`${PANEL} waste-dashboard-panel waste-analytics-efficiency-panel`} headerClassName={PANEL_HEADER} bodyClassName="waste-analytics-chart-body" title={<PanelHeading title="Эффективность перевозчиков" subtitle="рейсы и известная масса" updated={updated} tip={`Синие точки показывают ${formatNumber(plotted.length)} перевозчиков. Светлая точка и пунктирные линии — средние значения по ${formatNumber(average?.carriers ?? 0)} перевозчикам за тот же период с сохранением остальных фильтров.`} />}>
      <ChartBox type="scatter" options={options} series={series} />
    </Panel>
  );
}

function AnalyticsView({ data, loading, meta, period, selection }: {
  data: WasteDashboardData | undefined;
  loading: boolean;
  meta: WasteFilters;
  period: DateRange;
  selection: WasteSelection;
}) {
  const [rankingModal, setRankingModal] = useState<AnalyticsRankingKind | null>(null);
  if (loading || !data) return <div className="waste-analytics-grid"><div className="waste-analytics-kpis">{Array.from({ length: 6 }, (_, index) => <LoadingPanel key={index} />)}</div><div className="waste-analytics-rankings">{Array.from({ length: 3 }, (_, index) => <LoadingPanel key={index} />)}</div><div className="waste-analytics-bottom"><LoadingPanel /><LoadingPanel /></div></div>;
  const metrics = data.analytics.metrics;
  const averagePerDay = metric(
    data.metrics.trips.value / daysBetween(data.period),
    data.metrics.trips.previous / daysBetween(data.comparisonPeriod),
  );
  const updated = formatUpdated(data.dataThrough);
  return (
    <div className="waste-analytics-grid">
      <div className="waste-analytics-kpis">
        <AnalyticsKpi title="Средняя масса рейса" metric={metrics.averageMass} trend={toTrendPoints(data.analytics.trends?.averageMass)} icon={Scale} color="#43be6b" unit=" т" tip="Известная масса завершенных рейсов, деленная на число завершенных рейсов с валидной положительной массой." />
        <AnalyticsKpi title="Рейсов на одно ТС" metric={metrics.tripsPerVehicle} trend={toTrendPoints(data.analytics.trends?.tripsPerVehicle)} icon={Gauge} color="#2878e8" unit="" tip="Количество рейсов, деленное на число уникальных транспортных средств выбранного периода." />
        <AnalyticsKpi title="Среднее в день" metric={averagePerDay} trend={toTripTrendPoints(data.trends.trips)} icon={CalendarDays} color="#72c84b" unit="" tip="Среднее количество рейсов за календарный день выбранного периода." />
        <AnalyticsKpi title="Топ-5 объектов приема" metric={metrics.receptionTop5Share} trend={toTrendPoints(data.analytics.trends?.receptionTop5Share)} icon={Warehouse} color="#a55de8" tip="Доля рейсов, приходящаяся на пять крупнейших объектов приема." />
        <AnalyticsKpi title="Топ-5 объектов образования" metric={metrics.originTop5Share} trend={toTrendPoints(data.analytics.trends?.originTop5Share)} icon={Building2} color="#31aeba" tip="Доля рейсов, сформированная пятью крупнейшими объектами образования." />
        <AnalyticsKpi title="Топ-5 перевозчиков" metric={metrics.carrierTop5Share} trend={toTrendPoints(data.analytics.trends?.carrierTop5Share)} icon={Truck} color="#ef8b42" tip="Доля рейсов, выполненная пятью крупнейшими перевозчиками." />
      </div>
      <div className="waste-analytics-rankings">
        <AnalyticsRanking kind="carriers" rows={data.analytics.rankings.carriers.slice(0, 5)} color={ANALYTICS_COLORS[0]} total={data.metrics.trips.value} updated={updated} onOpen={() => setRankingModal("carriers")} />
        <AnalyticsRanking kind="origins" rows={data.analytics.rankings.origins.slice(0, 5)} color={ANALYTICS_COLORS[1]} total={data.metrics.trips.value} updated={updated} onOpen={() => setRankingModal("origins")} />
        <AnalyticsRanking kind="receptions" rows={data.analytics.rankings.receptions.slice(0, 5)} color={ANALYTICS_COLORS[2]} total={data.metrics.trips.value} updated={updated} onOpen={() => setRankingModal("receptions")} />
      </div>
      <div className="waste-analytics-bottom"><AnalyticsHeatmap rows={data.analytics.intensity} meta={meta} selection={selection} updated={updated} /><CarrierEfficiency rows={data.analytics.carrierEfficiency} average={data.analytics.carrierEfficiencyAverage} selectedCarriers={selection.carriers} updated={updated} /></div>
      <AnalyticsRankingModal kind={rankingModal} open={rankingModal != null} onClose={() => setRankingModal(null)} meta={meta} initialPeriod={period} initialSelection={selection} initialData={data} />
    </div>
  );
}

type TripsModalKind = "calendar" | "statuses";

function daysBetween(period: DateRange) {
  const start = new Date(`${period.from}T00:00:00Z`);
  const end = new Date(`${period.to}T00:00:00Z`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function metric(value: number, previous: number): NullableMetric {
  return { value, previous, changePct: relativeChange(value, previous) };
}

function operationalGroups(data: WasteDashboardData) {
  const completed = data.statusStructure.find((row) => row.status === "Завершен");
  const cancelled = data.statusStructure.filter((row) => /отмен|отклон/i.test(row.status));
  const cancelledValue = cancelled.reduce((sum, row) => sum + row.value, 0);
  const cancelledPrevious = cancelled.reduce((sum, row) => sum + row.previous, 0);
  const active = data.statusStructure.filter((row) => row.status !== "Завершен" && !/отмен|отклон/i.test(row.status));
  return {
    completed: metric(completed?.value ?? 0, completed?.previous ?? 0),
    active: metric(active.reduce((sum, row) => sum + row.value, 0), active.reduce((sum, row) => sum + row.previous, 0)),
    cancelled: metric(cancelledValue, cancelledPrevious),
  };
}

function ActivityCalendar({ data, expanded = false }: { data: WasteDashboardData; expanded?: boolean }) {
  const values = new Map(data.trends.trips.map((point) => [point.bucket.slice(0, 10), point.value]));
  const periodStart = new Date(`${data.period.from}T00:00:00Z`);
  const periodEnd = new Date(`${data.period.to}T00:00:00Z`);
  const monthStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1));
  const monthDays = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (monthStart.getUTCDay() + 6) % 7;
  const weeks = Math.ceil((offset + monthDays) / 7);
  const max = Math.max(1, ...values.values());
  const total = [...values.values()].reduce((sum, value) => sum + value, 0);
  const average = total / Math.max(daysBetween(data.period), 1);
  const monthLabel = new Intl.DateTimeFormat("ru-RU", { month: "long", year: expanded ? "numeric" : undefined, timeZone: "UTC" }).format(monthStart);
  const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  return (
    <div className={`waste-trips-calendar ${expanded ? "waste-trips-calendar--expanded" : ""}`}>
      <div className="waste-trips-calendar__meta">
        <strong>{monthLabel.charAt(0).toLocaleUpperCase("ru") + monthLabel.slice(1)}</strong>
        <span>{formatNumber(total)} рейсов · {formatNumber(average, 1)} в среднем за день</span>
      </div>
      <div className="waste-trips-calendar__grid" style={{ gridTemplateColumns: `32px repeat(${weeks}, minmax(0, 1fr))` }}>
        {weekdays.map((weekday, weekdayIndex) => <div className="contents" key={weekday}>
          <span className="waste-trips-calendar__weekday">{weekday}</span>
          {Array.from({ length: weeks }, (_, weekIndex) => {
            const day = weekIndex * 7 + weekdayIndex - offset + 1;
            if (day < 1 || day > monthDays) return <span className="waste-trips-calendar__empty" key={weekIndex} />;
            const date = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), day));
            const key = date.toISOString().slice(0, 10);
            const value = values.get(key) ?? 0;
            const ratio = value / max;
            const selected = date >= periodStart && date <= periodEnd;
            return <button type="button" className={`waste-trips-calendar__day ${selected ? "is-selected" : ""}`} key={key} title={`${day}: ${formatNumber(value)} рейсов`} style={{ "--activity": ratio } as React.CSSProperties}>{day}</button>;
          })}
        </div>)}
      </div>
      <div className="waste-trips-calendar__scale"><span>Ниже нагрузка</span><i /><i /><i /><i /><i /><span>Выше нагрузка</span></div>
    </div>
  );
}

function statusGroups(data: WasteDashboardData) {
  const buckets = [
    { key: "completed", label: "Завершено", color: "#43be6b", value: 0, previous: 0 },
    { key: "active", label: "В процессе", color: "#c7b348", value: 0, previous: 0 },
    { key: "cancelled", label: "Отменено", color: "#c44b4d", value: 0, previous: 0 },
  ];
  for (const row of data.statusStructure) {
    const status = row.status.trim().toLocaleLowerCase("ru");
    const index = status === "завершен" ? 0 : status.includes("отмен") || status.includes("отклон") ? 2 : 1;
    buckets[index].value += row.value;
    buckets[index].previous += row.previous;
  }
  const total = buckets.reduce((sum, row) => sum + row.value, 0);
  return buckets.map((row) => ({ ...row, sharePct: total > 0 ? row.value / total * 100 : 0 }));
}

function StatusControl({ data, expanded = false }: { data: WasteDashboardData; expanded?: boolean }) {
  const total = Math.max(1, data.metrics.trips.value);
  return (
    <div className={`waste-trips-statuses ${expanded ? "waste-trips-statuses--expanded" : ""}`}>
      {data.statusStructure.map((row) => {
        const color = statusColor(row.status);
        return (
          <div className="waste-trips-status-row" key={row.status}>
            <Dot style={{ backgroundColor: color }} />
            <span className="waste-trips-status-row__label">{row.status}</span>
            <span className="waste-trips-status-row__track"><i style={{ width: `${Math.max(2, row.value / total * 100)}%`, background: color }} /></span>
            <strong>{formatNumber(row.value)}</strong>
            <span className="waste-trips-status-row__share">{formatNumber(row.sharePct, 1)}%</span>
            <span className="waste-trips-status-row__delta"><Delta value={row.changePct} /></span>
          </div>
        );
      })}
      {!data.statusStructure.length && <div className="flex min-h-[150px] items-center justify-center text-[#737e91]">Нет данных</div>}
    </div>
  );
}

function TripsWidgetModal({ kind, open, onClose, meta, initialPeriod, initialSelection }: {
  kind: TripsModalKind | null; open: boolean; onClose: () => void; meta: WasteFilters;
  initialPeriod: DateRange; initialSelection: WasteSelection;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [selection, setSelection] = useState(initialSelection);
  const [data, setData] = useState<WasteDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPeriod(initialPeriod);
    setSelection(initialSelection);
  }, [open, initialPeriod, initialSelection]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(withK(asset("/api/waste/dashboard")), {
      method: "POST", signal: controller.signal, headers: { "content-type": "application/json" },
      body: JSON.stringify({ period, filters: selection, granularity: "day", rankingLimit: "all" }),
    })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<WasteDashboardData>; })
      .then((next) => { setData(next); setLoading(false); })
      .catch((reason) => { if (reason instanceof Error && reason.name === "AbortError") return; setLoading(false); });
    return () => controller.abort();
  }, [open, period, selection]);
  const title = kind === "calendar" ? "Календарь активности рейсов" : "Операционный контроль статусов";
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[140] bg-black/65 backdrop-blur-sm" />
        <div className="pointer-events-none fixed inset-0 z-[141] overflow-y-auto p-3 sm:p-5">
          <Dialog.Popup className="pointer-events-auto mx-auto my-3 flex h-[min(86dvh,860px)] min-h-[560px] w-[min(92vw,92rem)] flex-col rounded-[12px] border border-[#202c42] bg-[#050912] p-5 shadow-2xl outline-none sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><Dialog.Title className="text-[27px] font-semibold text-[#eef0f5]">{title}</Dialog.Title><Dialog.Description className="mt-1 text-[15px] text-[#7f899b]">Детализация пересчитывается по фильтрам окна</Dialog.Description></div>
              <Dialog.Close className="flex size-9 items-center justify-center rounded-[8px] text-[#8f99aa] hover:bg-white/[0.06] hover:text-white" aria-label="Закрыть"><X className="size-4" /></Dialog.Close>
            </div>
            <div className="mb-5 border-b border-white/[0.07] pb-4"><FilterBar meta={meta} period={period} selection={selection} onPeriod={setPeriod} onSelection={setSelection} /></div>
            <div className="min-h-0 flex-1 overflow-auto rounded-[8px] border border-white/[0.05] bg-[#03060c] p-5">
              {loading && !data ? <LoadingPanel className="h-full" /> : data && (kind === "calendar" ? <ActivityCalendar data={data} expanded /> : <StatusControl data={data} expanded />)}
            </div>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TripDetailModal({ trip, onClose }: { trip: WasteTrip | null; onClose: () => void }) {
  const fields = trip ? [
    ["Номер рейса", trip.tripNo], ["Подача, факт", formatUpdated(trip.submittedAt)], ["Статус", trip.status],
    ["Транспорт", trip.vehicle], ["Водитель", trip.driver], ["Перевозчик", trip.carrier],
    ["Объект образования", trip.originObject], ["Организация образования", trip.originName],
    ["Объект приема", trip.destinationObject], ["Организация приема", trip.destinationName],
    ["Вид отхода", trip.wasteType ? capitalizeWaste(trip.wasteType) : null], ["Код ФККО", trip.wasteCode],
    ["Масса груза", trip.cargoMass == null ? trip.cargoMassRaw : `${formatNumber(trip.cargoMass, 3)} т`],
    ["Максимальная масса", trip.maxMass == null ? null : `${formatNumber(trip.maxMass, 1)} т`],
  ] : [];
  return (
    <Dialog.Root open={!!trip} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[150] bg-black/65 backdrop-blur-sm" />
        <div className="pointer-events-none fixed inset-0 z-[151] flex items-center justify-center p-4">
          <Dialog.Popup className="pointer-events-auto w-[min(92vw,800px)] rounded-[12px] border border-[#202c42] bg-[#070c15] p-6 shadow-2xl outline-none">
            <div className="mb-5 flex items-start justify-between"><div><Dialog.Title className="text-[26px] font-semibold">Рейс {trip?.tripNo}</Dialog.Title><Dialog.Description className="mt-1 text-[#7f899b]">Первичная запись из реестра</Dialog.Description></div><Dialog.Close className="flex size-9 items-center justify-center rounded-[8px] text-[#8f99aa] hover:bg-white/[0.06]"><X className="size-4" /></Dialog.Close></div>
            <div className="waste-trip-detail">{fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || "—"}</strong></div>)}</div>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type PrefetchedTrips = { key: string; data: WasteTripsPage };
const TRIP_COLUMN_LABELS = ["№ рейса", "Дата и время", "ТС", "Перевозчик", "Объект образования", "Объект приема", "Масса, т", "Статус"];
const DEFAULT_TRIP_COLUMN_WIDTHS = [150, 150, 110, 175, 220, 220, 90, 150];

function tripsRequestKey(period: DateRange, selection: WasteSelection, interval?: TripsInterval) {
  return JSON.stringify({ period, filters: selection, interval });
}

function TripsRegistry({ period, selection, interval, prefetched, pageSize = 25 }: {
  period: DateRange;
  selection: WasteSelection;
  interval?: TripsInterval;
  prefetched: PrefetchedTrips | null;
  pageSize?: number;
}) {
  const requestKey = tripsRequestKey(period, selection, interval);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [columnWidths, setColumnWidths] = useState<number[]>(() => {
    if (typeof window === "undefined") return DEFAULT_TRIP_COLUMN_WIDTHS;
    try {
      const saved = window.localStorage.getItem("waste-trip-column-widths");
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length === DEFAULT_TRIP_COLUMN_WIDTHS.length ? parsed : DEFAULT_TRIP_COLUMN_WIDTHS;
    } catch {
      return DEFAULT_TRIP_COLUMN_WIDTHS;
    }
  });
  const initialData = prefetched?.key === requestKey && prefetched.data.pageSize === rowsPerPage ? prefetched.data : null;
  const [page, setPage] = useState(1);
  const [data, setData] = useState<WasteTripsPage | null>(initialData);
  const [selectedTrip, setSelectedTrip] = useState<WasteTrip | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const consumedPrefetch = useRef<string | null>(null);
  useEffect(() => setPage(1), [requestKey, rowsPerPage]);
  useEffect(() => {
    window.localStorage.setItem("waste-trip-column-widths", JSON.stringify(columnWidths));
  }, [columnWidths]);
  useEffect(() => {
    if (page === 1 && prefetched?.key === requestKey && prefetched.data.pageSize === rowsPerPage && consumedPrefetch.current !== requestKey) {
      consumedPrefetch.current = requestKey;
      setData(prefetched.data);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetch(withK(asset("/api/waste/trips")), {
      method: "POST", signal: controller.signal, headers: { "content-type": "application/json" },
      body: JSON.stringify({ period, filters: selection, interval, page, pageSize: rowsPerPage }),
    })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<WasteTripsPage>; })
      .then((next) => { setData(next); setLoading(false); })
      .catch((reason) => { if (reason instanceof Error && reason.name === "AbortError") return; setLoading(false); });
    return () => controller.abort();
  }, [period, selection, interval, page, rowsPerPage, prefetched, requestKey]);
  const pageItems = useMemo(() => {
    const total = data?.totalPages ?? 1;
    const visible = [...new Set([1, total, page - 2, page - 1, page, page + 1, page + 2])]
      .filter((value) => value >= 1 && value <= total)
      .sort((left, right) => left - right);
    const items: Array<number | string> = [];
    visible.forEach((value, index) => {
      if (index > 0 && value - visible[index - 1] > 1) items.push(`ellipsis-${value}`);
      items.push(value);
    });
    return items;
  }, [data?.totalPages, page]);
  const startColumnResize = (index: number, event: ReactMouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidths[index];
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(76, Math.min(520, startWidth + moveEvent.clientX - startX));
      setColumnWidths((widths) => widths.map((width, columnIndex) => columnIndex === index ? nextWidth : width));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  const resetColumnWidths = () => setColumnWidths([...DEFAULT_TRIP_COLUMN_WIDTHS]);
  return (
    <Panel
      className={`${PANEL} waste-dashboard-panel waste-trips-registry-panel`}
      headerClassName="waste-analytics-panel-header waste-source-header"
      bodyClassName="waste-trips-registry"
      title={<div><div className="flex items-center gap-2"><ListChecks className="size-5 text-[#4d8ee8]" /><span className="waste-analytics-panel-title">Реестр рейсов</span><InfoTip label="Реестр рейсов" text="Первичные записи рейсов после применения общих фильтров. Нажмите строку, чтобы открыть полную карточку." /></div><div className="waste-analytics-panel-caption">Первичные записи за выбранный период</div></div>}
      right={<div className="waste-source-toolbar"><span className="waste-source-count">{data ? `${formatNumber(data.total)} строк` : "Загрузка"}</span><button type="button" onClick={resetColumnWidths} aria-label="Сбросить ширину столбцов"><RefreshCw /><span>Сбросить ширину</span></button></div>}
    >
      <div className="waste-trips-table-scroll">
        <table className="waste-trips-table">
          <colgroup>{columnWidths.map((width, index) => <col key={TRIP_COLUMN_LABELS[index]} style={{ width }} />)}</colgroup>
          <thead><tr>{TRIP_COLUMN_LABELS.map((label, index) => <th key={label}><span>{label}</span><span role="separator" aria-label={`Изменить ширину столбца «${label}»`} aria-orientation="vertical" className="waste-trips-column-resizer" onMouseDown={(event) => startColumnResize(index, event)} onDoubleClick={() => setColumnWidths((widths) => widths.map((width, columnIndex) => columnIndex === index ? DEFAULT_TRIP_COLUMN_WIDTHS[index] : width))} /></th>)}</tr></thead>
          <tbody>
            {data?.rows.map((row) => <tr key={row.tripNo} tabIndex={0} onClick={() => setSelectedTrip(row)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedTrip(row); }}>
              <td><strong>{row.tripNo}</strong></td><td>{formatUpdated(row.submittedAt)}</td><td>{row.vehicle || "—"}</td><td>{row.carrier || "—"}</td><td>{row.originObject || "—"}</td><td>{row.destinationObject || "—"}</td><td>{formatNumber(row.cargoMass, 3)}</td><td><span className="waste-trip-status" style={{ color: statusColor(row.status), borderColor: `${statusColor(row.status)}70`, background: `${statusColor(row.status)}14` }}>{row.status}</span></td>
            </tr>)}
          </tbody>
        </table>
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-[#03060c]/72"><Loader2 className="size-6 animate-spin text-[#71809a]" /></div>}
        {!loading && !data?.rows.length && <div className="flex min-h-[190px] items-center justify-center text-[#737e91]">Нет рейсов для выбранных фильтров</div>}
      </div>
      <div className="waste-trips-pagination">
        <div className="waste-trips-pagination__summary">
          <label>Строк на странице:<select aria-label="Строк на странице" value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))}>{[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <span>{data ? `${formatNumber((data.page - 1) * data.pageSize + (data.rows.length ? 1 : 0))}–${formatNumber((data.page - 1) * data.pageSize + data.rows.length)} из ${formatNumber(data.total)}` : "Загрузка"}</span>
        </div>
        <nav className="waste-trips-pagination__pages" aria-label="Страницы реестра">
          <button type="button" aria-label="Предыдущая страница" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></button>
          {pageItems.map((item) => typeof item === "number" ? <button type="button" key={item} aria-label={`Страница ${item}`} aria-current={item === page ? "page" : undefined} className={item === page ? "is-active" : ""} onClick={() => setPage(item)}>{formatNumber(item)}</button> : <span key={item} aria-hidden="true">…</span>)}
          <button type="button" aria-label="Следующая страница" disabled={!data || page >= data.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight /></button>
        </nav>
      </div>
      <TripDetailModal trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
    </Panel>
  );
}

function heatmapInterval(cell: HeatmapCellSelection): TripsInterval {
  const start = new Date(`${cell.day}T${String(cell.hour).padStart(2, "0")}:00:00Z`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    from: start.toISOString().slice(0, 19),
    to: end.toISOString().slice(0, 19),
  };
}

function HeatmapTripsModal({ cell, onClose, meta, initialSelection }: {
  cell: HeatmapCellSelection | null;
  onClose: () => void;
  meta: WasteFilters;
  initialSelection: WasteSelection;
}) {
  const [selection, setSelection] = useState(initialSelection);
  useEffect(() => {
    if (cell) setSelection(initialSelection);
  }, [cell, initialSelection]);
  if (!cell) return null;

  const interval = heatmapInterval(cell);
  const period = { from: cell.day, to: cell.day };
  const dateLabel = `${cell.day.slice(8, 10)}.${cell.day.slice(5, 7)}.${cell.day.slice(0, 4)}`;
  const startHour = String(cell.hour).padStart(2, "0");
  const endHour = String((cell.hour + 1) % 24).padStart(2, "0");

  return (
    <Dialog.Root open onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <div className="pointer-events-none fixed inset-0 z-[151] overflow-y-auto overscroll-contain p-3 sm:p-5">
          <Dialog.Popup className="pointer-events-auto mx-auto my-1 flex h-[min(94dvh,1040px)] min-h-[620px] w-[min(96vw,118rem)] flex-col rounded-[12px] border border-[#202c42] bg-[#050912] p-5 shadow-2xl outline-none transition-[opacity,transform] duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Dialog.Title className="text-[27px] font-semibold leading-9 text-[#eef0f5]">Рейсы за {dateLabel} · {startHour}:00–{endHour}:00</Dialog.Title>
                <Dialog.Description className="mt-1 text-[15px] leading-[22px] text-[#7f899b]">Интервал 1 час · {formatNumber(cell.trips)} рейсов на тепловой карте</Dialog.Description>
              </div>
              <Dialog.Close className="flex size-9 shrink-0 items-center justify-center rounded-[8px] text-[#8f99aa] transition-colors hover:bg-white/[0.06] hover:text-white" aria-label="Закрыть">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="mb-4 border-b border-white/[0.07] pb-4">
              <FilterBar
                meta={meta}
                period={period}
                selection={selection}
                onPeriod={() => undefined}
                onSelection={setSelection}
                hidden={["period"]}
              />
            </div>
            <div className="waste-source-view min-h-0 flex-1">
              <TripsRegistry period={period} selection={selection} interval={interval} prefetched={null} pageSize={50} />
            </div>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TripsView({ data, loading, meta, period, selection }: {
  data: WasteDashboardData | undefined;
  loading: boolean;
  meta: WasteFilters;
  period: DateRange;
  selection: WasteSelection;
}) {
  const [modal, setModal] = useState<TripsModalKind | null>(null);
  const [participantKind, setParticipantKind] = useState<AnalyticsRankingKind>("carriers");
  const [rankingModal, setRankingModal] = useState<AnalyticsRankingKind | null>(null);
  if (loading || !data) return <div className="waste-trips-grid"><div className="waste-trips-kpis">{Array.from({ length: 6 }, (_, index) => <LoadingPanel key={index} />)}</div><div className="waste-trips-overview">{Array.from({ length: 2 }, (_, index) => <LoadingPanel key={index} />)}</div><div className="waste-trips-operational"><LoadingPanel /><LoadingPanel /></div></div>;
  const groups = operationalGroups(data);
  const peak = data.trends.trips.reduce((best, point) => point.value > best.value ? point : best, { bucket: "", value: 0 });
  const peakMass = data.trends.mass.reduce((best, point) => (point.value ?? 0) > (best.value ?? 0) ? point : best, { bucket: "", value: null as number | null, completedTrips: 0, knownMassTrips: 0, coveragePct: null as number | null });
  const days = daysBetween(data.period);
  const participantRows = data.analytics.rankings[participantKind];
  const participantColor = "#9bcf45";
  const statusRows = statusGroups(data);
  const participantLabels: Record<AnalyticsRankingKind, string> = { carriers: "Перевозчики", origins: "Объекты образования", receptions: "Объекты приема" };
  const averageTrips = metric(data.metrics.trips.value / days, data.metrics.trips.previous / days);
  const peakMetric: NullableMetric = { value: peak.value, previous: null, changePct: null };
  const peakLabel = peak.bucket ? `${peak.bucket.slice(8, 10)}.${peak.bucket.slice(5, 7)}` : "—";
  return (
    <div className="waste-trips-grid">
      <div className="waste-trips-kpis">
        <AnalyticsKpi title="Рейсов за период" metric={data.metrics.trips} icon={Truck} color="#2878e8" unit="" periodLabel={`за ${days} дней`} tip="Все уникальные рейсы после применения фильтров." />
        <AnalyticsKpi title="Завершено" metric={groups.completed} icon={Check} color="#43be6b" unit="" periodLabel={`за ${days} дней`} tip="Рейсы с точным статусом «Завершен»." />
        <AnalyticsKpi title="В работе" metric={groups.active} icon={Clock3} color="#c7b348" unit="" periodLabel={`за ${days} дней`} tip="Все незавершенные рейсы, кроме отмененных и отклоненных." />
        <AnalyticsKpi title="Отменено и отклонено" metric={groups.cancelled} icon={CircleAlert} color="#d45155" unit="" periodLabel={`за ${days} дней`} tip="Отмененные и отклоненные рейсы выбранного периода." />
        <AnalyticsKpi title={`Пиковый день · ${peakLabel}`} metric={peakMetric} icon={CalendarDays} color="#a55de8" unit="" periodLabel="максимум за день" tip="Максимальное число рейсов за один календарный день выбранного периода." />
        <AnalyticsKpi title="Среднее в день" metric={averageTrips} icon={Gauge} color="#31aeba" unit="" periodLabel={`за ${days} дней`} tip="Среднее количество рейсов за календарный день выбранного периода." />
      </div>
      <div className="waste-trips-overview">
        <div role="button" tabIndex={0} className="waste-trips-widget" onClick={() => setModal("calendar")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setModal("calendar"); } }}><Panel className={`${PANEL} waste-dashboard-panel h-full`} headerClassName="waste-trips-compact-header" bodyClassName="waste-trips-widget-body" title={<div className="flex items-center gap-2"><span className="waste-analytics-panel-title">Календарь активности</span><ArrowUpRight className="size-4 text-[#6f7b8f]" /></div>}><ActivityCalendar data={data} /></Panel></div>
        <AnalyticsHeatmap rows={data.analytics.intensity} meta={meta} selection={selection} compact />
      </div>
      <div className="waste-trips-operational">
        <Panel className={`${PANEL} waste-dashboard-panel waste-trips-participants-panel`} headerClassName="waste-trips-section-header" bodyClassName="waste-trips-participants-body" title={<span className="waste-analytics-panel-title">Топ участников</span>} right={<div className="waste-trips-participant-tabs">{(Object.keys(participantLabels) as AnalyticsRankingKind[]).map((kind) => <button type="button" className={participantKind === kind ? "is-active" : ""} key={kind} onClick={() => setParticipantKind(kind)}>{participantLabels[kind]}</button>)}</div>}>
          <AnalyticsRankingBars rows={participantRows.slice(0, 5)} color={participantColor} total={data.metrics.trips.value} onOpen={() => setRankingModal(participantKind)} />
          <button type="button" className="waste-trips-show-all" onClick={() => setRankingModal(participantKind)}>Показать все <ArrowUpRight className="size-4" /></button>
        </Panel>
        <div role="button" tabIndex={0} className="waste-trips-widget" onClick={() => setModal("statuses")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setModal("statuses"); } }}>
          <Panel className={`${PANEL} waste-dashboard-panel h-full`} headerClassName="waste-trips-section-header" bodyClassName="waste-trips-control-body" title={<div className="flex items-center gap-2"><span className="waste-analytics-panel-title">Операционный контроль</span><ArrowUpRight className="size-4 text-[#6f7b8f]" /></div>}>
            <div className="waste-trips-control-main"><div className="waste-trips-control-ring"><span>Рейсы по статусам</span><StatusRing groups={statusRows} completedShare={data.metrics.completedShare.value} totalTrips={data.metrics.trips.value} /></div><div className="waste-trips-control-status"><span>Контроль статусов</span><StatusControl data={data} /></div></div>
            <div className="waste-trips-control-stats"><span><small>Пиковый день</small><strong>{formatNumber(peak.value)}</strong></span><span><small>Пиковая масса</small><strong>{formatNumber(peakMass.value, 0)} т</strong></span><span><small>Ср. рейсов в день</small><strong>{formatNumber(data.metrics.trips.value / days)}</strong></span></div>
          </Panel>
        </div>
      </div>
      <TripsWidgetModal kind={modal} open={modal != null} onClose={() => setModal(null)} meta={meta} initialPeriod={period} initialSelection={selection} />
      <AnalyticsRankingModal kind={rankingModal} open={rankingModal != null} onClose={() => setRankingModal(null)} meta={meta} initialPeriod={period} initialSelection={selection} initialData={data} />
    </div>
  );
}

function EmptyOverlay({ text }: { text: string }) {
  return <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#101827]/35"><div className="rounded-[8px] border border-white/[0.08] bg-[#060a12]/95 px-6 py-4 text-center text-[18px] text-[#99a3b5] shadow-2xl">{text}</div></div>;
}

export function WasteDashboard() {
  const [view, setView] = useState<View>("summary");
  const [meta, setMeta] = useState<WasteFilters | null>(null);
  const [period, setPeriod] = useState<DateRange | null>(null);
  const [selection, setSelection] = useState<WasteSelection>(EMPTY_SELECTION);
  const [tripGran, setTripGran] = useState<Gran>("day");
  const [massGran, setMassGran] = useState<Gran>("day");
  const [datasets, setDatasets] = useState<Partial<Record<Gran, WasteDashboardData>>>({});
  const [resourceTotals, setResourceTotals] = useState<WasteDashboardData | null>(null);
  const [prefetchedTrips, setPrefetchedTrips] = useState<PrefetchedTrips | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(withK(asset("/api/waste/filters")), { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json() as Promise<WasteFilters>; })
      .then((filters) => {
        setMeta(filters);
        if (filters.availablePeriod.from && filters.availablePeriod.to) setPeriod(latestPeriod(filters.availablePeriod.to, 14, filters.availablePeriod.from));
        else setLoading(false);
      })
      .catch((reason) => { if (reason instanceof Error && reason.name === "AbortError") return; setError("Не удалось загрузить значения фильтров"); setLoading(false); });
    return () => controller.abort();
  }, []);

  const load = useCallback(async (
    signal: AbortSignal,
    gran: Gran,
    activePeriod: DateRange,
    activeSelection: WasteSelection,
    options: { includeDetails?: boolean; includeAnalytics?: boolean } = {},
  ) => {
    const response = await fetch(withK(asset("/api/waste/dashboard")), {
      method: "POST", signal, headers: { "content-type": "application/json" },
      body: JSON.stringify({
        period: activePeriod,
        filters: activeSelection,
        granularity: gran,
        wasteLimit: 7,
        rankingLimit: options.includeAnalytics ? "all" : 5,
        ...options,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<WasteDashboardData>;
  }, []);

  const loadTrips = useCallback(async (
    signal: AbortSignal,
    activePeriod: DateRange,
    activeSelection: WasteSelection,
  ) => {
    const response = await fetch(withK(asset("/api/waste/trips")), {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ period: activePeriod, filters: activeSelection, page: 1, pageSize: 25 }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<WasteTripsPage>;
  }, []);

  useEffect(() => {
    if (!period || !meta?.availablePeriod.from || !meta.availablePeriod.to) return;
    const version = ++requestVersion.current;
    const controller = new AbortController();
    const granularities = [...new Set<Gran>(["day", tripGran, massGran])];
    const fullPeriod = { from: meta.availablePeriod.from, to: meta.availablePeriod.to };
    setLoading(true);
    setError(null);
    const dashboardRequest = Promise.all(granularities.map(async (gran) => [gran, await load(controller.signal, gran, period, selection, {
      includeAnalytics: gran === "day",
    })] as const));
    const tripsRequest = loadTrips(controller.signal, period, selection).catch(() => null);
    const totalsRequest = load(controller.signal, "day", fullPeriod, selection, {
      includeDetails: false,
      includeAnalytics: false,
    }).catch(() => null);

    Promise.all([dashboardRequest, tripsRequest, totalsRequest])
      .then(([entries, trips, totals]) => {
        if (version !== requestVersion.current) return;
        setDatasets(Object.fromEntries(entries));
        setPrefetchedTrips(trips ? { key: tripsRequestKey(period, selection), data: trips } : null);
        if (totals) setResourceTotals(totals);
        setLoading(false);
      })
      .catch((reason) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        if (version !== requestVersion.current) return;
        setError("Не удалось загрузить данные");
        setLoading(false);
      });
    return () => controller.abort();
  }, [period, selection, tripGran, massGran, load, loadTrips, meta]);

  const data = datasets.day ?? datasets[tripGran] ?? datasets[massGran];
  const updated = formatUpdated(data?.dataThrough ?? null);
  const emptyDatabase = !!meta && !meta.availablePeriod.from;
  const emptySelection = !!data && data.metrics.trips.value === 0;
  const showSkeleton = loading && !data;
  const refresh = () => period && setPeriod({ ...period });

  return (
    <main className="waste-dashboard-root flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#010409] text-[#e8eaf0] lg:h-full lg:min-h-0 lg:overflow-hidden">
      <header className="waste-dashboard-header flex shrink-0 flex-col gap-3 px-3 pt-3 lg:h-[84px] lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:px-5 lg:pt-0">
        <div className="waste-tabs-scroll -mx-3 overflow-x-auto px-3 lg:mx-0 lg:mt-5 lg:self-start lg:overflow-visible lg:px-0"><DashboardTabs value={view} onChange={setView} /></div>
        {meta && period ? <FilterBar meta={meta} period={period} selection={selection} onPeriod={setPeriod} onSelection={setSelection} hidden={view === "summary" ? ["period"] : []} /> : <div className="grid flex-1 grid-cols-2 gap-2 lg:flex lg:justify-end">{[140, 195, 267, 205].map((width) => <Skeleton key={width} className="h-12 rounded-[12px]" style={{ width }} />)}</div>}
      </header>

      <section className="waste-dashboard-canvas relative m-3 mt-3 flex min-h-0 flex-1 flex-col rounded-[8px] bg-[#0f1626] p-2.5 lg:mx-5 lg:mb-5 lg:mt-[-1px] lg:rounded-tl-none lg:p-[14px]">
        {view === "summary" ? <OperationalOverview selection={selection} /> : view === "structure" ? (
          <div className="waste-summary-grid relative grid min-h-0 flex-1 grid-cols-1 gap-2.5 lg:grid-rows-[minmax(0,510fr)_minmax(0,398fr)] lg:gap-[14px]">
            {showSkeleton || !data ? (
              <>
                <div className="grid min-h-0 grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,560fr)_minmax(0,640fr)_minmax(0,600fr)] lg:gap-[14px]"><LoadingPanel /><LoadingPanel /><LoadingPanel /></div>
                <div className="grid min-h-0 grid-cols-1 gap-2.5 lg:grid-cols-2 lg:gap-[14px]"><LoadingPanel /><LoadingPanel /></div>
              </>
            ) : (
              <>
                <div className="grid min-h-0 grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,560fr)_minmax(0,640fr)_minmax(0,600fr)] lg:gap-[14px]">
                  <WasteStructurePanel data={data} updated={updated} meta={meta!} period={period!} selection={selection} />
                  <StatusPanel data={data} updated={updated} />
                  <InfrastructurePanel data={data} totals={resourceTotals ?? data} updated={updated} />
                </div>
                <div className="grid min-h-0 grid-cols-1 gap-2.5 lg:grid-cols-2 lg:gap-[14px]">
                  <TrendCard title="Рейсы" subtitle="количество" tip="Количество уникальных рейсов в каждом часовом или дневном интервале." updated={updated} points={(datasets[tripGran] ?? data).trends.trips} gran={tripGran} onGran={setTripGran} color="#43d56d" unit="рейсов" />
                  <TrendCard title="Масса" subtitle={`тонн · покрытие ${formatNumber(data.metrics.mass.coveragePct, 1)}%`} tip={`Масса только завершенных рейсов с валидным положительным значением. Покрытие: ${formatNumber(data.metrics.mass.coveragePct, 1)}%.`} updated={updated} points={(datasets[massGran] ?? data).trends.mass} gran={massGran} onGran={setMassGran} color="#a55de8" unit="т" />
                </div>
              </>
            )}
            {(emptyDatabase || emptySelection) && <EmptyOverlay text="Загрузите данные для отображения дашборда" />}
          </div>
        ) : view === "analytics" ? (
          <div className="relative h-full min-h-0 flex-1">
            <AnalyticsView data={data} loading={showSkeleton} meta={meta!} period={period!} selection={selection} />
            {(emptyDatabase || emptySelection) && <EmptyOverlay text="Загрузите данные для отображения дашборда" />}
          </div>
        ) : (
          <div className="waste-source-view relative min-h-0 flex-1">
            {meta && period && <TripsRegistry period={period} selection={selection} prefetched={prefetchedTrips} />}
            {(emptyDatabase || emptySelection) && <EmptyOverlay text="Загрузите данные для отображения дашборда" />}
          </div>
        )}

        {view !== "summary" && loading && data && <div className="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-2 rounded-[7px] border border-white/[0.08] bg-[#080d16]/95 px-3 py-2 text-[14px] text-[#9aa4b6]"><Loader2 className="size-3.5 animate-spin" />Обновление</div>}
        {view !== "summary" && error && <div className="absolute inset-x-4 top-4 z-40 flex items-center justify-between gap-4 rounded-[8px] border border-[#7d2738] bg-[#251019] px-4 py-3 text-[15px] text-[#f1c4cd]"><span className="flex items-center gap-2"><CircleAlert className="size-4" />{error}</span><button type="button" onClick={refresh} className="flex items-center gap-2 rounded-[6px] bg-white/[0.08] px-3 py-1.5 hover:bg-white/[0.14]"><RefreshCw className="size-3.5" />Повторить</button></div>}
      </section>
    </main>
  );
}
