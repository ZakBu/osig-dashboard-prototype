"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { Loader2, Fuel, Presentation, RussianRuble, LayoutDashboard, Cctv, type LucideIcon } from "lucide-react";
import type { CameraData, DashboardData, StatusRow, TrendResponse, SupplyData } from "@/lib/types";
import {
  fuelByDay, fuelRetro24, limitsByDay, limitsRetro24, priceByDay, priceRetro24, queueTrendByDay, queueTrendRetro24, registryNets, selectSummary, bandPeriodLabel, filterGroup, type FuelSeriesPoint,
} from "@/lib/trend";
import { EMPTY_FILTER, type NetFilter, type StationType } from "@/lib/netType";
import { asset } from "@/lib/bp";
import { withK } from "@/lib/auth";
import { Dot, Panel } from "./ui";
import { InfoTip } from "./InfoTip";
import { SidebarHierarchy } from "./SidebarHierarchy";
import { CameraHierarchy } from "./CameraHierarchy";
import { TrendPanel } from "./TrendPanel";
import { QueueTrendPanel } from "./QueueTrendPanel";
import { GranControl } from "./GranControl";
import { useDayScroll } from "./useDayScroll";
import { FuelPricePanel } from "./FuelPricePanel";
import { RestrictionsPanel } from "./RestrictionsPanel";
import { AvailabilityModal } from "./AvailabilityModal";
import { brandColor } from "./netBrand";
import { NetColumns } from "./NetColumns";
import { BottomTabBar } from "./BottomTabBar";
import { FuelSupplyPanel } from "./FuelSupplyPanel";
import { ChartBox } from "./ChartBox";
import { CompanyFilterBar } from "./CompanyFilterBar";
import { PresentationsPanel } from "./PresentationsPanel";
import { ReportViewer } from "./ReportViewer";
import { fmtInt } from "@/lib/format";
import { Card } from "@coss/ui/components/card";
import type { ReportMeta } from "@/lib/reports";

type ViewMode = "dashboard" | "fuel" | "reports" | "prices" | "cameras";
const VIEW_TABS: { value: ViewMode; text: string; Icon: LucideIcon }[] = [
  { value: "dashboard", text: "Свод", Icon: LayoutDashboard },
  { value: "fuel", text: "Топливная обеспеченность", Icon: Fuel },
  { value: "prices", text: "Цены", Icon: RussianRuble },
  { value: "cameras", text: "Камеры", Icon: Cctv },
  { value: "reports", text: "Доклады", Icon: Presentation },
];

// Сохраняемое между перезагрузками состояние UI (localStorage).
const UI_STATE_KEY = "azs-dash-ui-v1";
type PersistedUI = { view: ViewMode; filter: NetFilter; report: ReportMeta | null; reportPage: number };

// Голубой активный цвет (как в исходном figma) для табов и фильтров.
export const ACTIVE_BLUE = "bg-sky-500 text-white";

/** Переключатель режима (expanding-pill): подпись показывается ТОЛЬКО у активной вкладки,
 *  при переключении плавно раскрывается (flex-grow + max-width лейбла). Остальные — значки. */
function ViewTabs({ view, onView }: { view: ViewMode; onView: (v: ViewMode) => void }) {
  // Раскрываем подпись активной вкладки после монтирования → плавная анимация при переключении.
  const [ready, setReady] = useState(false);
  const [activeWidths, setActiveWidths] = useState<number[]>([]);
  const [collapsedWidth, setCollapsedWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const r = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(r);
  }, []);
  useEffect(() => {
    const measure = () => {
      // Ширина активной кнопки = ширина ЕЁ собственной подписи (у каждого таба своя),
      // чтобы короткие («Камеры», «Доклады») не растягивались под самый длинный таб.
      const widths = measureRefs.current.map((el) => el?.offsetWidth ?? 0);
      const collapsed = Math.max(...iconRefs.current.map((el) => el?.offsetWidth ?? 0));
      if (widths.some((w) => w > 0)) setActiveWidths(widths);
      if (collapsed > 0) setCollapsedWidth(collapsed);
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    // ResizeObserver ловит reflow при поздней загрузке веб-шрифта → ширина активного таба
    // всегда точная (иначе меряется по фолбэк-шрифту и подпись обрезается).
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    measureRefs.current.forEach((el) => el && ro?.observe(el));
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const base =
    "flex h-full min-h-10 items-center justify-center overflow-hidden rounded-md py-1 font-medium text-[17px] transition-[width,padding,background-color,color] duration-300 ease-out";
  const label = "overflow-hidden whitespace-nowrap transition-all duration-300 ease-out";
  const tab = (v: ViewMode, text: string, Icon: LucideIcon, index: number) => {
    const active = view === v;
    const show = active && ready;
    const aw = activeWidths[index] ?? null;
    return (
      <button
        key={v}
        type="button"
        onClick={() => onView(v)}
        title={text}
        aria-label={text}
        // Активная кнопка — ширина по СВОЕЙ подписи (компактная, не растянута под самый
        // длинный таб); свёрнутые — ширина иконки. Обе плавно анимируются (transition width);
        // раскрытие подписи гейтит ширина кнопки (overflow-hidden) → текст не обгоняет анимацию.
        style={show ? (aw ? { width: aw } : undefined) : (collapsedWidth ? { width: collapsedWidth } : undefined)}
        className={`${base} shrink-0 ${v === "reports" ? "hidden lg:flex" : ""} ${show ? "px-4" : "px-1"} ${active ? ACTIVE_BLUE : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
      >
        <Icon className="size-6 shrink-0" />
        <span className={`${label} ${show ? "ml-2 max-w-[340px] opacity-100" : "ml-0 max-w-0 opacity-0"}`}>{text}</span>
      </button>
    );
  };
  return (
    <div ref={containerRef} className="relative flex w-full items-stretch justify-between gap-1">
      <div className="pointer-events-none absolute opacity-0" aria-hidden="true">
        {VIEW_TABS.map(({ text, Icon }, index) => (
          <div
            key={text}
            ref={(el) => { measureRefs.current[index] = el; }}
            className="inline-flex h-full min-h-10 items-center justify-center rounded-md px-4 py-1 font-medium text-[17px]"
          >
            <Icon className="size-6 shrink-0" />
            <span className="ml-2 whitespace-nowrap">{text}</span>
          </div>
        ))}
        {VIEW_TABS.map(({ text, Icon }, index) => (
          <div
            key={`${text}-icon`}
            ref={(el) => { iconRefs.current[index] = el; }}
            className="inline-flex h-full min-h-10 items-center justify-center rounded-md px-1 py-1 font-medium text-[17px]"
          >
            <Icon className="size-6 shrink-0" />
          </div>
        ))}
      </div>
      {VIEW_TABS.map(({ value, text, Icon }, index) => tab(value, text, Icon, index))}
    </div>
  );
}

/** Виды топлива для графика цен: пары «база / премиум» в палитре проекта
 *  (ДТ #a855f7, АИ-92 #14b8a6, АИ-95 #ef4444, АИ-100 #f59e0b — как в остальных панелях;
 *  премиум-марка = светлый оттенок того же тона). */
const PRICE_FUELS = [
  { key: "pdt", name: "ДТ", color: "#a855f7" },
  { key: "pdtp", name: "ДТ+", color: "#c4b5fd" },
  { key: "p92", name: "АИ-92", color: "#14b8a6" },
  { key: "p92p", name: "АИ-92+", color: "#5eead4" },
  { key: "p95", name: "АИ-95", color: "#ef4444" },
  { key: "p95p", name: "АИ-95+", color: "#fca5a5" },
  { key: "p100", name: "АИ-100", color: "#f59e0b" },
  { key: "p100p", name: "АИ-100+", color: "#fcd34d" },
];

/** Столбцы таблицы цен — те же 8 видов и в том же порядке, что линии графика
 *  (ДТ → 92 → 95 → 100, как во всём проекте). */
const PRICE_COLUMNS = [
  { key: "pdt", title: "ДТ", color: "#a855f7" },
  { key: "pdtp", title: "ДТ+", color: "#c4b5fd" },
  { key: "p92", title: "АИ-92", color: "#14b8a6" },
  { key: "p92p", title: "АИ-92+", color: "#5eead4" },
  { key: "p95", title: "АИ-95", color: "#ef4444" },
  { key: "p95p", title: "АИ-95+", color: "#fca5a5" },
  { key: "p100", title: "АИ-100", color: "#f59e0b" },
  { key: "p100p", title: "АИ-100+", color: "#fcd34d" },
];

const fmtRub = (v: number) => v.toFixed(2).replace(".", ",");
/** Целые рубли — для оси Y и подписей на графике цен (без копеек, чтобы не наезжали). */
const fmtRubInt = (v: number) => `${Math.round(v)}`;
const fmtDeltaPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")}%`;
const MONTHS_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_RU_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

// ── Камеры ─────────────────────────────────────────────────────────────────
// Единый источник для вкладки «Камеры»: номер витрины, тексты-заглушки и палитра
// типов камер в тон графикам проекта (blue/green/violet, как в KpiBadge):
// один цвет = кольцо покрытия = линия графика = точка легенды.
const CAMERA_VITRINA = "27243";
const CAMERA_TOTAL_VITRINA = "27166";
const CAMERA_EMPTY = `Нет данных камер. Дождитесь синка DTW (витрина ${CAMERA_VITRINA}) или POST /api/sync.`;
// Один цвет = кольцо покрытия (АЗС) = линия графика (камеры) = точка легенды.
// key   — поле тренда (кол-во КАМЕР по типу); azsKey — поле снимка (кол-во АЗС по типу).
// «Камеры 2/3» = setup (обзор камеры изначально наведён на АЗС, предустановленный пресет).
// Палитра — как в графиках «Топливо»/«Цены»: янтарь / бирюза / зелёный / пурпур.
const CAMERA_TYPES = [
  { key: "obzor", azsKey: "azsObzor", label: "Обзорные", series: "Обзорные", hex: "#14b8a6", ring: "text-teal-500", dot: "bg-teal-500" },
  { key: "setup", azsKey: "azsSetup", label: "Камеры, наведенные на АЗС", series: "Камеры, наведенные на АЗС", hex: "#10b981", ring: "text-emerald-500", dot: "bg-emerald-500" },
  { key: "grz", azsKey: "azsGrz", label: "Камеры распознавания ГРЗ", series: "Камеры распознавания ГРЗ", hex: "#a855f7", ring: "text-purple-500", dot: "bg-purple-500" },
] as const;
// Внешнее (золотое) кольцо и центр бублика + верхняя линия графика — АЗС/камеры любого
// типа (count_azs_all_cameras / count_cameras_all). Внутренние кольца/линии дробят по типам.
const CAMERA_ALL = { key: "all", azsKey: "azsAll", label: "Камеры всех видов", series: "Камеры всех видов", hex: "#f59e0b", ring: "text-amber-500", dot: "bg-amber-500" } as const;
// Линии графика роста — Всех видов / Обзорные / Камеры 2/3. ГРЗ показываем ОТДЕЛЬНОЙ
// строкой: у него другой порядок величины (0…8) — на общей оси он прибивал бы остальные
// к потолку и делал их нечитаемыми.
const CAMERA_CHART = [CAMERA_ALL, CAMERA_TYPES[0], CAMERA_TYPES[1]] as const;

/**
 * Концентрические кольца покрытия (custom SVG): для каждого типа — тёмный трек + дуга доли
 * (round-cap, свой цвет). В центре — крупно «X из Y». Показатели по типам — в ЛЕГЕНДЕ рядом.
 */
// У камер «Всех видов» ≈ «Обзорные» (линии почти совпадают), поэтому подписи близких линий
// не ПРЯЧЕМ (как в TrendPanel), а РАЗДВИГАЕМ по вертикали — чтобы были видны ВСЕ значения.
// Идемпотентно: исходный вертикальный сдвиг ApexCharts храним в data-oty и восстанавливаем.
function spreadLabels(root?: Element | null) {
  if (!root) return;
  const parse = (t: string | null): [number, number] => {
    const m = /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)/.exec(t ?? "");
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
  };
  type It = { el: SVGGraphicsElement; tx: number; ty: number; h: number; top: number; cx: number };
  const items: It[] = [];
  for (const g of root.querySelectorAll(".apexcharts-datalabels")) {
    for (const el of g.querySelectorAll(":scope > g.apexcharts-data-labels")) {
      const g2 = el as SVGGraphicsElement;
      const [tx, ty] = parse(g2.getAttribute("transform"));
      const saved = g2.getAttribute("data-oty");
      const oty = saved != null ? parseFloat(saved) : ty;
      if (saved == null) g2.setAttribute("data-oty", String(ty));
      g2.setAttribute("transform", `translate(${tx}, ${oty})`); // сброс к исходному сдвигу
      let bb: DOMRect | null = null;
      try { bb = g2.getBBox(); } catch { bb = null; }
      if (!bb || bb.width === 0) continue;
      items.push({ el: g2, tx, ty: oty, h: bb.height, top: bb.y + oty, cx: bb.x + bb.width / 2 });
    }
  }
  const cols = new Map<number, It[]>();
  for (const it of items) { const k = Math.round(it.cx / 20); (cols.get(k) ?? cols.set(k, []).get(k)!).push(it); }
  const GAP = 2;
  for (const arr of cols.values()) {
    arr.sort((a, b) => a.top - b.top); // сверху вниз
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1], cur = arr[i];
      const minTop = prev.top + prev.h + GAP;
      if (cur.top < minTop) {
        const push = minTop - cur.top;
        cur.ty += push; cur.top += push;
        cur.el.setAttribute("transform", `translate(${cur.tx}, ${cur.ty})`);
      }
    }
  }
}
const CAMERA_COVER_TIP =
  "Количество АЗС Москвы, с установленными камерами и (или) попадающих в зону обзора городских камер:\n" +
  "Количество АЗС Москвы, попадающих в зону обзора городских камер;\n" +
  "Количество АЗС Москвы, оснащённых камерами видеонаблюдения, позволяющих считывать государственные регистрационные знаки заправляющихся автомобилей (ГРЗ);\n" +
  "Количество АЗС Москвы, обеспеченных камерами, наведенными на АЗС.";
// Аналитика очередей (ИИ-анализ видеопотока ДИТ) — источника данных пока нет:
// показываем честную заглушку «функционал в процессе отладки» с описанием метрик.
const fmtDateLabel = (key: string) => {
  const [, month, day] = key.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${MONTHS_RU[(month || 1) - 1]}`;
};
const shiftDateKey = (key: string, days: number) => {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};
const rowValue = (row: FuelSeriesPoint | undefined, key: string) => {
  const value = row?.[key];
  return typeof value === "number" ? value : null;
};
const deltaPct = (current: number | null, base: number | null) =>
  current == null || base == null || base === 0 ? null : ((current - base) / base) * 100;
// 9 колонок делят ширину панели поровну (без фикс-пикселей → без горизонтального скролла).
const PRICE_GRID = "grid-cols-[minmax(0,1.3fr)_repeat(8,minmax(0,1fr))]";

/** Таблица «Средние цены на отпускаемое топливо»: последний день / прошлый день / неделю назад
 *  из ценового ряда (mv_price) + строки Δ за день и за неделю. Значения — среднее за день. */
function PriceTable({
  daily,
  hoverFuelKey,
  onFuelHover,
}: {
  daily: FuelSeriesPoint[];
  hoverFuelKey?: string | null;
  onFuelHover?: (key: string | null) => void;
}) {
  const byDay = new Map(daily.map((row) => [row.key, row]));
  const sorted = [...daily].sort((a, b) => (a.key < b.key ? 1 : -1));
  const latest = sorted[0];
  // База сравнения = точный день (−1 / −6) либо ближайший доступный старший день; но всегда
  // СТРОГО старше latest — иначе (напр. когда данных всего один день) вернём undefined → «Н/Д»,
  // а не ложный «0,00%».
  const olderBase = (exactKey: string, fallback?: FuelSeriesPoint) => {
    const base = byDay.get(exactKey) ?? fallback;
    return base && latest && base.key !== latest.key ? base : undefined;
  };
  const previous = latest ? olderBase(shiftDateKey(latest.key, -1), sorted[1]) : undefined;
  const weekAgo = latest ? olderBase(shiftDateKey(latest.key, -6), sorted[sorted.length - 1]) : undefined;
  const rows = [latest, previous, weekAgo].filter((row, index, arr): row is FuelSeriesPoint => !!row && arr.findIndex((item) => item?.key === row.key) === index);
  const hoverIndex = PRICE_COLUMNS.findIndex((column) => column.key === hoverFuelKey);
  const dataRow = (row: FuelSeriesPoint) => (
    <div key={row.key} className={`grid ${PRICE_GRID} min-h-[2.5rem] flex-1 items-center gap-x-2 border-b border-white/12 text-[13.5px] lg:min-h-0`}>
      <div onMouseEnter={() => onFuelHover?.(null)} className="sticky left-0 z-[1] truncate bg-card pr-1 text-[17px] text-foreground/70 lg:static lg:bg-transparent lg:pr-0">{fmtDateLabel(row.key)}</div>
      {PRICE_COLUMNS.map((c) => {
        const value = rowValue(row, c.key);
        return (
          <div key={c.key} onMouseEnter={() => onFuelHover?.(c.key)} className="text-center text-[17.5px] tabular-nums text-foreground">{value != null ? fmtRub(value) : "Н/Д"}</div>
        );
      })}
    </div>
  );
  const deltaRow = (label: string) => (
    <div key={label} className={`grid ${PRICE_GRID} min-h-[3rem] flex-1 items-center gap-x-2 border-b border-white/12 text-[13.5px] last:border-b-0 lg:min-h-0`}>
      <div onMouseEnter={() => onFuelHover?.(null)} className="sticky left-0 z-[1] whitespace-pre-line bg-card pr-1 text-[17px] leading-tight text-foreground/70 lg:static lg:bg-transparent lg:pr-0">
        <span className="lg:hidden">{label.includes("неделю") ? "Δ нед." : "Δ день"}</span>
        <span className="hidden lg:inline">{label}</span>
      </div>
      {PRICE_COLUMNS.map((c) => {
        const delta = label.includes("неделю")
          ? deltaPct(rowValue(latest, c.key), rowValue(weekAgo, c.key))
          : deltaPct(rowValue(latest, c.key), rowValue(previous, c.key));
        // Как в проекте (FuelPricePanel): дорожает (+) — алый, дешевеет (−) — изумруд, ~0 — нейтрально.
        const flat = delta != null && Math.abs(delta) < 0.005;
        const cls = delta == null || flat ? "text-foreground" : delta > 0 ? "text-rose-400" : "text-emerald-400";
        return (
          <div key={c.key} onMouseEnter={() => onFuelHover?.(c.key)} className={`text-center text-[17px] font-semibold tabular-nums ${cls}`}>{delta == null ? "Н/Д" : flat ? "0,00%" : fmtDeltaPct(delta)}</div>
        );
      })}
    </div>
  );
  return (
    <Panel
      className="h-full"
      bodyClassName="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-0 lg:px-6"
      title={
        <span className="flex min-w-0 items-center gap-1.5 text-[17px] lg:text-[23px]">
          <span className="min-w-0 truncate">Средние цены на отпускаемое топливо <span className="text-[17px] font-normal text-foreground/70">(стоимость топлива, руб/л)</span></span>
          <InfoTip
            label="Средние цены на отпускаемое топливо"
            text="Средняя цена отпускаемого топлива по выбранной группе АЗС. Для расчёта данных за день используется среднее арифметическое значение цены топлива по данным трёхчасовых интервалов мониторинга в течение дня."
          />
        </span>
      }
    >
      {/* Вся таблица (шапка + строки) — одна flex-колонка на высоту панели, строки тянутся
          поровну → без вертикального скролла; 9 колонок делят ширину → без горизонтального. */}
      <div onMouseLeave={() => onFuelHover?.(null)} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-auto pt-1 lg:overflow-visible">
        {/* Подсветка наведённого столбца — на всю высоту, синхронно с линией графика. */}
        {hoverIndex >= 0 && (
          <div className={`pointer-events-none absolute inset-0 grid ${PRICE_GRID} gap-x-2`} aria-hidden="true">
            <div />
            {PRICE_COLUMNS.map((column) => (
              <div key={column.key} className={column.key === hoverFuelKey ? "rounded-md border border-white/50 bg-white/[0.05]" : ""} />
            ))}
          </div>
        )}
        <div className={`grid ${PRICE_GRID} min-w-[560px] shrink-0 items-end gap-x-2 pb-1.5 text-[17px] lg:min-w-0`}>
          {/* Первая колонка-заголовок пустая: «стоимость топлива, руб/л» уже в заголовке панели (не дублируем). */}
          <div onMouseEnter={() => onFuelHover?.(null)} className="sticky left-0 z-[1] bg-card lg:static lg:bg-transparent" />
          {PRICE_COLUMNS.map((c) => (
            <button
              key={c.key}
              type="button"
              onMouseEnter={() => onFuelHover?.(c.key)}
              onFocus={() => onFuelHover?.(c.key)}
              onBlur={() => onFuelHover?.(null)}
              className="flex cursor-default items-center justify-center gap-1.5 py-0.5 font-medium text-foreground"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
        <div className="flex min-h-0 min-w-[560px] flex-1 flex-col border-t border-white/15 lg:min-w-0">
          {rows.map(dataRow)}
          {["Изменения\nза прошлый день", "Изменения\nза неделю"].map(deltaRow)}
        </div>
      </div>
    </Panel>
  );
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [supply, setSupply] = useState<SupplyData | null>(null);
  const [cameras, setCameras] = useState<CameraData | null>(null);
  const [filter, setFilter] = useState<NetFilter>(EMPTY_FILTER);
  const [view, setView] = useState<ViewMode>("dashboard");
  // Дриллдаун «кубики» по комбинациям топлива (Полностью/Частично доступны).
  // Режим попапа-дриллдауна доступности (клик по «Полностью/Частично доступны»).
  const [drill, setDrill] = useState<"full" | "partial" | "limits" | null>(null);
  const [report, setReport] = useState<ReportMeta | null>(null);
  // Подсветка вида топлива на вкладке «Цены» (наведение синхронно на график и столбец таблицы).
  const [hoverFuelKey, setHoverFuelKey] = useState<string | null>(null);
  // Текущая страница просмотрщика вынесена наверх — общая для полосы слайдов и PDF-вьювера.
  const [reportPage, setReportPage] = useState(1);
  const selectReport = (r: ReportMeta | null) => { setReport(r); setReportPage(1); };

  // Восстановление состояния UI после перезагрузки (view/фильтр/доклад/страница).
  // Читаем в эффекте (не в render) — иначе рассинхрон гидрации SSR. Первый write
  // пропускаем, чтобы монтирование не затёрло сохранённое дефолтами.
  const skipPersist = useRef(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(UI_STATE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<PersistedUI>;
      if (s.view === "dashboard" || s.view === "fuel" || s.view === "reports" || s.view === "prices" || s.view === "cameras") setView(s.view);
      if (s.filter && typeof s.filter === "object") setFilter(s.filter);
      if (s.report && s.report.id) setReport(s.report);
      if (typeof s.reportPage === "number" && s.reportPage >= 1) setReportPage(s.reportPage);
    } catch { /* localStorage недоступен — не критично */ }
  }, []);
  useEffect(() => {
    if (skipPersist.current) { skipPersist.current = false; return; }
    try {
      localStorage.setItem(UI_STATE_KEY, JSON.stringify({ view, filter, report, reportPage } satisfies PersistedUI));
    } catch { /* приватный режим и т.п. */ }
  }, [view, filter, report, reportPage]);

  const loadTrend = useCallback(() => {
    fetch(withK(asset("/api/trend"))).then((r) => r.json()).then(setTrend).catch(() => setTrend(null));
  }, []);
  const loadDashboard = useCallback(() => {
    fetch(withK(asset("/api/dashboard")))
      .then((r) => r.json())
      .then((json: DashboardData) => setData(json))
      .catch(() => setData({ empty: true }));
  }, []);

  useEffect(() => { loadTrend(); }, [loadTrend]);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    fetch(withK(asset("/api/supply"))).then((r) => r.json()).then(setSupply).catch(() => setSupply(null));
  }, []);
  useEffect(() => {
    fetch(withK(asset("/api/cameras")))
      .then((r) => r.json())
      .then((json: CameraData) => setCameras(json))
      .catch(() => setCameras(null));
  }, []);

  // На вкладке «Цены» — тихое автообновление раз в 60 c (цены/реестр меняются в течение дня).
  useEffect(() => {
    if (view !== "prices") return;
    loadDashboard();
    loadTrend();
    const id = window.setInterval(() => { loadDashboard(); loadTrend(); }, 60_000);
    return () => window.clearInterval(id);
  }, [view, loadDashboard, loadTrend]);

  // Выбор типа (ВИНК/НезАЗС/Все) сбрасывает конкретную сеть; выбор сети приоритетнее типа.
  const setType = (type: StationType) => setFilter({ net: null, type });
  const pickNet = (net: string | null) => setFilter((f) => ({ net, type: net ? "all" : f.type }));

  const reg = data?.registry;
  // Группа матвью под текущий фильтр (Все / сеть / ВИНК / Прочие) — ключ ко всем рядам.
  const group = filterGroup(filter);
  const avail = useMemo(() => trend?.availByGroup?.[group] ?? [], [trend, group]);
  const qser = useMemo(() => trend?.queueByGroup?.[group] ?? [], [trend, group]);
  const lser = useMemo(() => trend?.limitByGroup?.[group] ?? [], [trend, group]);

  // KPI «АЗС Москвы» = последний срез матвью выбранной группы (значения как есть).
  const summary = useMemo(() => (reg ? selectSummary(reg, filter) : null), [reg, filter]);
  // Ряд «Доступность топлива» (по видам) — прямо из матвью доступность_топлива.
  const fuelDay = useMemo(() => fuelByDay(avail), [avail]);
  const fuelHour = useMemo(() => fuelRetro24(avail), [avail]);
  // Ряды очередей во времени — для графика по конкретной сети (при filter.net).
  const queueDay = useMemo(() => queueTrendByDay(qser), [qser]);
  const queueHour = useMemo(() => queueTrendRetro24(qser), [qser]);
  const limitDay = useMemo(() => limitsByDay(lser), [lser]);
  const limitHour = useMemo(() => limitsRetro24(lser), [lser]);
  const limitDayByGroup = useMemo(() => Object.fromEntries(Object.entries(trend?.limitByGroup ?? {}).map(([key, rows]) => [key, limitsByDay(rows)])), [trend]);
  const limitHourByGroup = useMemo(() => Object.fromEntries(Object.entries(trend?.limitByGroup ?? {}).map(([key, rows]) => [key, limitsRetro24(rows)])), [trend]);
  // Ряды цен во времени для выбранной группы (mv_price): «Дни» (среднее за день) и «Часы».
  const priceSeries = useMemo(() => trend?.priceByGroup?.[group] ?? [], [trend, group]);
  const priceDay = useMemo(() => priceByDay(priceSeries), [priceSeries]);
  const priceHour = useMemo(() => priceRetro24(priceSeries), [priceSeries]);
  const nets = useMemo(() => (reg ? registryNets(reg, filter.type) : []), [reg, filter.type]);

  const emptyText = "Нет данных";
  // «Актуальный период» — полоса времени суток последнего снимка (напр. «02.07.2026, 00:00 - 06:00»).
  const upd = data?.updatedAt ? bandPeriodLabel(data.updatedAt) : "";
  const limitUpd = trend?.limitUpdatedAt ? trend.limitUpdatedAt : upd;
  // Цветной подсветки контура блоков нет — только белое выделение столбцов в графиках.
  const glow = "";

  // Отпуск топлива (27200) считает по имени сети из витрины (Teboil→Тебойл). Агрегаты ВИНК/Прочие
  // витрина не хранит — панель считает их сама суммой сетей (ВИНК = 4 ВИНК, Прочие = Нефтьмаг+Тебойл).
  const supplyCompany = filter.net
    ? (filter.net === "Teboil" ? "Тебойл" : filter.net)
    : filter.type === "vink" ? "ВИНК"
      : filter.type === "other" ? "Прочие"
        : "Все";

  const cameraRows = cameras?.rows ?? [];
  // Бублик и график — под активный фильтр: сеть → её имя; тип → ВИНК/Прочие/Нефтьмагистраль/Все.
  const activeCameraGroup = filter.net
    ? filter.net
    : filter.type === "vink" ? "ВИНК"
      : filter.type === "other" ? "Прочие"
        : filter.type === "nezavis" ? "Нефтьмагистраль"
          : "Все";
  const cameraActive = cameraRows.find((r) => r.name === activeCameraGroup)
    ?? cameraRows.find((r) => r.name === "Все")
    ?? null;
  // Плитки — все компании (без агрегатов Все/ВИНК). Как на «Своде»: показываем «обеспечено/всего»
  // и %. Знаменатель = count_all_azs сети из 27166 (реестр); зелёный сектор = обеспечены камерами
  // (azsAll), красный = не обеспечены (total − azsAll). Клампим на случай azsAll>total (кривой срез).
  const cameraNetColumnsRows = useMemo<StatusRow[]>(
    () => cameraRows
      .filter((r) => r.name !== "Все" && r.name !== "ВИНК")
      .map((r) => {
        const totalNet = reg?.nets?.[r.name]?.total ?? r.totalAzs;
        const covered = Math.min(r.azsAll, totalNet);
        return { name: r.name, open: covered, noFuel: Math.max(0, totalNet - r.azsAll), closed: 0, total: totalNet, index: r.coverShare ?? 0 };
      }),
    [cameraRows, reg],
  );
  // Полный дневной ряд камер выбранной группы (границы датапикера).
  const cameraTrendAll = useMemo(
    () => (cameras?.trend ?? []).filter((p) => p.group === activeCameraGroup).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [cameras, activeCameraGroup],
  );
  // График камер только дневной (часов нет) → в шапке ТОЛЬКО датапикер: окно последних 7 дней,
  // заканчивающихся на выбранной дате (как во всём проекте). По умолчанию — последний день данных.
  const camDayMin = cameraTrendAll.length ? cameraTrendAll[0].date : "";
  const camDayMax = cameraTrendAll.length ? cameraTrendAll[cameraTrendAll.length - 1].date : "";
  const [camDayEnd, setCamDayEnd] = useState(camDayMax);
  useEffect(() => { setCamDayEnd(camDayMax); }, [camDayMax]);
  const cameraTrend = useMemo(() => {
    if (!cameraTrendAll.length) return cameraTrendAll;
    const end = camDayEnd || camDayMax;
    const [y, m, d] = end.split("-").map(Number);
    const s = new Date(Date.UTC(y, m - 1, d) - 6 * 86_400_000);
    const start = `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`;
    return cameraTrendAll.filter((p) => p.date >= start && p.date <= end);
  }, [cameraTrendAll, camDayEnd, camDayMax]);
  // Колесо/тачпад над графиком камер двигает окно дат с шагом 1 день.
  const camWheelRef = useDayScroll({ enabled: true, dayEnd: camDayEnd || camDayMax, dayMin: camDayMin, dayMax: camDayMax, onChange: setCamDayEnd });
  const fmtCameraDate = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${Number(d)} ${MONTHS_RU_SHORT[Number(m) - 1]}`;
  };
  const cameraLineOptions: ApexOptions = useMemo(() => {
    // Плотная шкала (НЕ от нуля): три основные линии близки — разносим их по высоте.
    const vals = cameraTrend.flatMap((p) => [p.all, p.obzor, p.setup]);
    const lo = vals.length ? Math.min(...vals) : 0;
    const hi = vals.length ? Math.max(...vals) : 100;
    const niceStep = (x: number): number => {
      const mag = 10 ** Math.floor(Math.log10(Math.max(1, x)));
      for (const m of [1, 2, 2.5, 3, 4, 5, 10]) if (m * mag >= x) return m * mag;
      return 10 * mag;
    };
    // Плотная ось: ~3 крупных деления над диапазоном данных → линии расходятся по высоте,
    // между конечными подписями хватает места. Сверху — запас ~0.55 шага под верхнюю подпись.
    const span = Math.max(1, hi - lo);
    const yStep = niceStep(span / 2.2);
    const yMin = Math.max(0, Math.floor((lo - span * 0.06) / yStep) * yStep);
    const yMax = Math.ceil((hi + yStep * 0.55) / yStep) * yStep;
    const yTicks = Math.max(2, Math.round((yMax - yMin) / yStep));
    const colors = CAMERA_CHART.map((t) => t.hex);
    return {
      chart: {
        type: "line", toolbar: { show: false }, zoom: { enabled: false }, background: "transparent", fontFamily: "inherit",
        parentHeightOffset: 0, animations: { enabled: true, easing: "easeinout", speed: 700, dynamicAnimation: { enabled: true, speed: 350 } },
        // Близкие подписи (Всех видов ≈ Обзорные) РАЗДВИГАЕМ по вертикали — видны ВСЕ значения.
        events: {
          mounted: (c: { el?: Element } | undefined) => spreadLabels(c?.el),
          updated: (c: { el?: Element } | undefined) => spreadLabels(c?.el),
          animationEnd: (c: { el?: Element } | undefined) => spreadLabels(c?.el),
        },
      },
      theme: { mode: "dark" },
      colors,
      dataLabels: {
        // Подпись на КАЖДОЙ точке (цветной блок в тон линии / белый текст) — как в «Доступности топлива».
        enabled: true,
        formatter: (v: number) => fmtInt(v),
        // Плашку поднимаем чуть НАД точкой (минимальный зазор, точка видна под ней).
        offsetY: -6,
        style: { fontSize: "15px", fontWeight: 700, colors },
        background: { enabled: true, foreColor: "#ffffff", borderWidth: 0, borderRadius: 4, padding: 2, opacity: 1 },
      },
      stroke: { curve: "smooth", width: 3 },
      markers: { size: 4, colors, strokeWidth: 0, hover: { size: 6 } },
      legend: { show: false }, // своя легенда под графиком — совпадает с подписями блока покрытия
      fill: { type: "solid", opacity: 1 },
      grid: { borderColor: "rgba(255,255,255,0.06)", padding: { left: 24, right: 56, top: 14, bottom: 0 } },
      xaxis: {
        categories: cameraTrend.map((p) => fmtCameraDate(p.date)),
        labels: { offsetY: -2, style: { colors: "#e5e7eb", fontSize: "15px" }, rotate: 0, hideOverlappingLabels: false },
        axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false },
      },
      yaxis: {
        min: yMin, max: yMax, tickAmount: yTicks,
        labels: { offsetX: -8, formatter: (v: number) => fmtInt(Math.round(v)), style: { colors: "#e5e7eb", fontSize: "15px" } },
      },
      tooltip: { theme: "dark", y: { formatter: (v: number) => `${fmtInt(v)} камер` } },
      // Моб.: поворачиваем/прячем подписи оси X, чтобы не наслаивались (десктоп >1024 не затронут).
      responsive: [{ breakpoint: 1024, options: { xaxis: { labels: { rotate: -45, rotateAlways: true, hideOverlappingLabels: true, style: { fontSize: "11px" } } }, dataLabels: { style: { fontSize: "12px" } } } }],
    };
  }, [cameraTrend]);
  const cameraLineSeries = useMemo(
    () => CAMERA_CHART.map((t) => ({ name: t.series, data: cameraTrend.map((p) => p[t.key]) })),
    [cameraTrend],
  );
  return (
    <main className="flex min-h-dvh w-full flex-col gap-2 p-0.5 pt-[env(safe-area-inset-top)] pb-[calc(64px+env(safe-area-inset-bottom))] lg:h-full lg:min-h-0 lg:pt-0.5 lg:pb-0.5">
      {/* Попап-дриллдаун «Полностью/Частично доступны» — по клику в сайдбаре. Данные из той же
          витрины 27166 (текущий фильтр), что и сводка → цифры совпадают. */}
      <AvailabilityModal summary={summary} mode={drill} onClose={() => setDrill(null)} limitDay={limitDay} limitHour={limitHour} limitsAvailable={trend ? lser.length > 0 : null} updated={limitUpd} registry={reg} limitDayByGroup={limitDayByGroup} limitHourByGroup={limitHourByGroup} initialLimitGroup={group} group={group} />
      {data?.empty ? (
        <EmptyDb />
      ) : !summary ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Загрузка данных…
        </div>
      ) : view === "dashboard" ? (
        <>
        {/* Дашборд: два блока сверху (табы слева, фильтры справа), ниже — аналитика */}
        <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-stretch">
          <Card className={`hidden shrink-0 items-center px-2.5 py-2 transition-shadow duration-300 lg:flex lg:w-[29%] lg:min-w-max ${glow}`}>
            <ViewTabs view={view} onView={setView} />
          </Card>
          <Card className={`flex min-w-0 flex-1 items-center px-3 py-2 transition-shadow duration-300 ${glow}`}>
            <CompanyFilterBar filter={filter} onPickNet={pickNet} onType={setType} />
          </Card>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[29%_1fr] lg:grid-rows-[1fr_1fr]">
          <div className="reveal min-h-0 lg:row-span-2" style={{ animationDelay: "0ms" }}>
            <Panel
              className={`h-full transition-shadow duration-300 ${glow}`}
              bodyClassName="flex flex-1 flex-col gap-2.5 overflow-y-auto lg:min-h-0"
            >
              {/* Шапка: строка 1 — заголовок + кнопка (правый угол); строка 2 — метка среза
                  (ниже, белым, с трекингом, чтобы цифры даты не слипались). */}
              <div className="flex shrink-0 flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 truncate text-[17px] lg:text-[23px] font-medium leading-tight text-foreground">{filter.net ?? "АЗС Москвы"}</span>
                </div>
              </div>
              <SidebarHierarchy s={summary} net={filter.net} type={filter.type} onDrill={setDrill} />
            </Panel>
          </div>
          <div className="reveal grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-[1fr_minmax(230px,21%)]" style={{ animationDelay: "90ms" }}>
            <div className="min-h-0">
              <TrendPanel available={trend?.available ?? null} day={fuelDay} hour={fuelHour} emptyText={emptyText} glow={glow} updated={upd} />
            </div>
            {/* Ограничения отпуска «в бак» / «в канистры» — во всех фильтрах (из summary). */}
            <div className="min-h-0">
              <RestrictionsPanel bak={summary.bak} noCanister={summary.no_canister} total={summary.total} shareTank={summary.shareLimitTank} shareCanister={summary.shareLimitCanister} glow={glow} onOpen={() => setDrill("limits")} />
            </div>
          </div>
          {group !== "Все" ? (
            /* Выбрана ГРУППА (сеть / ВИНК / Прочие) — очереди во времени (слева) + средние
               цены по этой группе (справа), как у конкретной сети. Цены берём по имени группы
               из pricesByNet (витрина хранит и агрегаты ВИНК/Прочие). Цвет очереди: сеть —
               брендовый, ВИНК/Прочие — зелёный проекта. */
            <div className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-[1.55fr_1fr]">
              <div className="reveal min-h-0 min-w-0" style={{ animationDelay: "260ms" }}>
                <QueueTrendPanel day={queueDay} hour={queueHour} color={filter.net ? (brandColor(filter.net) ?? "#94a3b8") : "#10b981"} emptyText={emptyText} glow={glow} />
              </div>
              <div className="reveal min-h-0 min-w-0" style={{ animationDelay: "340ms" }}>
                <FuelPricePanel prices={data?.pricesByNet?.[group] ?? []} glow={glow} />
              </div>
            </div>
          ) : (
            <div className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-[1.55fr_1fr]">
              {/* Очереди по группе (Все/ВИНК/Прочие) — тот же временной график и РАЗМЕР,
                  что и по конкретной сети (ряд count_queue выбранной группы). Цвет — зелёный
                  проекта (как «Доступно» на графике доступности). */}
              <div className="reveal min-h-0 min-w-0" style={{ animationDelay: "260ms" }}>
                <QueueTrendPanel day={queueDay} hour={queueHour} color="#10b981" emptyText={emptyText} glow={glow} />
              </div>
              <div className="reveal min-h-0 min-w-0" style={{ animationDelay: "340ms" }}>
                <NetColumns rows={nets} emptyText={emptyText} selectedNet={filter.net} glow={glow} ringSize={58} />
              </div>
            </div>
          )}
        </div>
        </>
      ) : view === "fuel" ? (
        /* Топливная обеспеченность — новый раздел (динамика отпуска топлива). Каркас;
           контент собираем ПО ПРОЕКТУ на текущей библиотеке (coss + ApexCharts), без хендролла. */
        <>
          {/* Как на главной: табы слева совпадают по ширине с колонкой «АЗС Москвы», фильтр справа. */}
          <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-stretch">
            <Card className={`hidden shrink-0 items-center px-2.5 py-2 transition-shadow duration-300 lg:flex lg:w-[29%] lg:min-w-max ${glow}`}>
              <ViewTabs view={view} onView={setView} />
            </Card>
            <Card className={`flex min-w-0 flex-1 items-center px-3 py-2 transition-shadow duration-300 ${glow}`}>
              <CompanyFilterBar filter={filter} onPickNet={pickNet} onType={setType} />
            </Card>
          </div>
          <div className="reveal min-h-0 flex-1">
            <FuelSupplyPanel data={supply} company={supplyCompany} glow={glow} />
          </div>
        </>
      ) : view === "prices" ? (
        /* Цены: график средних цен по видам (TrendPanel с ценовыми рядами) + таблица средних цен.
           Как на главной: табы слева совпадают по ширине с колонкой «АЗС Москвы», фильтр сетей справа. */
        <>
          <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-stretch">
            <Card className={`hidden shrink-0 items-center px-2.5 py-2 transition-shadow duration-300 lg:flex lg:w-[29%] lg:min-w-max ${glow}`}>
              <ViewTabs view={view} onView={setView} />
            </Card>
            <Card className={`flex min-w-0 flex-1 items-center px-3 py-2 transition-shadow duration-300 ${glow}`}>
              <CompanyFilterBar filter={filter} onPickNet={pickNet} onType={setType} />
            </Card>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-rows-[1fr_0.95fr]">
            <div className="reveal min-h-0" style={{ animationDelay: "0ms" }}>
              <TrendPanel
                available={trend?.available ?? null}
                day={priceDay}
                hour={priceHour}
                emptyText={emptyText}
                glow={glow}
                updated={upd}
                title="Цена топлива по видам"
                subtitle="средняя стоимость, руб/л"
                tip="Средняя цена топлива по выбранной группе АЗС. Для расчёта данных за день используется среднее арифметическое значение цены топлива по данным трёхчасовых интервалов мониторинга в течение дня."
                fuels={PRICE_FUELS}
                valueSuffix="₽/л"
                formatValue={fmtRub}
                formatAxis={fmtRubInt}
                formatLabel={fmtRubInt}
                labelFontSize="15px"
                yStep={20}
                yPadBelow={5}
                yPadAbove={10}
                defaultGran="day"
                selectableFuels
                defaultVisibleFuelKeys={["pdt", "p92", "p95"]}
                hoverFuelKey={hoverFuelKey}
                onFuelHover={setHoverFuelKey}
              />
            </div>
            <div className="reveal min-h-0" style={{ animationDelay: "90ms" }}>
              <PriceTable daily={priceDay} hoverFuelKey={hoverFuelKey} onFuelHover={setHoverFuelKey} />
            </div>
          </div>
        </>
      ) : view === "cameras" ? (
        <>
          <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-stretch">
            <Card className={`hidden shrink-0 items-center px-2.5 py-2 transition-shadow duration-300 lg:flex lg:w-[29%] ${glow}`}>
              <ViewTabs view={view} onView={setView} />
            </Card>
            <Card className={`flex min-w-0 flex-1 items-center px-3 py-2 transition-shadow duration-300 ${glow}`}>
              <CompanyFilterBar filter={filter} onPickNet={pickNet} onType={setType} />
            </Card>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[29%_1fr] lg:grid-rows-[1fr_1fr]">
            {/* СЛЕВА НА ВСЮ ВЫСОТУ — покрытие камерами: концентрические кольца + легенда. */}
            <Panel
              className={`reveal min-h-0 lg:col-start-1 lg:row-span-2 ${glow}`}
              bodyClassName="flex min-h-0 flex-col gap-2 pt-3 pb-3"
            >
              {/* Заголовок в теле, ровно 2 строки; (i) — сразу после «шт.».
                  % покрытия города теперь В ЦЕНТРЕ кольца (совмещён с «558 из 682»). */}
              <div className="shrink-0 font-medium text-[17px] lg:text-[23px] leading-tight text-foreground">
                АЗС, обеспеченные камерами<br />видеонаблюдения,{" "}
                <span className="inline-flex items-center gap-1 whitespace-nowrap align-middle">шт.<InfoTip text={CAMERA_COVER_TIP} /></span>
              </div>
              {cameraActive ? (
                /* Иерархия покрытия камерами (в стиле «АЗС Москвы», HierarchyKit). Знаменатель —
                   count_all_azs из 27166 (как на «Своде»). Пояснение — внутри, сразу под кольцом. */
                <CameraHierarchy c={cameraActive} total={cameraActive.name === activeCameraGroup ? summary.total : undefined} />
              ) : (
                <div className="flex flex-1 items-center justify-center text-center text-muted-foreground text-sm">
                  {CAMERA_EMPTY}
                </div>
              )}
            </Panel>
            {/* СПРАВА СВЕРХУ — график роста камер (переехал на место «Аналитики»). */}
            <Panel
              title={<span className="flex min-w-0 items-center gap-1.5 text-[17px] lg:text-[23px]"><span className="truncate">Количество камер видеонаблюдения, направленных на АЗС</span><InfoTip text={"Рост количества камер видеонаблюдения, использующихся для мониторинга АЗС Москвы: камеры всех видов, обзорные, камеры, наведенные на АЗС."} /></span>}
              right={cameraTrendAll.length > 0 ? (
                <GranControl pickerOnly gran="day" onGran={() => {}} dayEnd={camDayEnd} onDayEnd={setCamDayEnd} dayMin={camDayMin} dayMax={camDayMax} />
              ) : null}
              className={`reveal min-h-0 lg:col-start-2 lg:row-start-1 ${glow}`}
              bodyClassName="flex min-h-0 flex-1 flex-col pt-0"
            >
              {/* «Обновлено» — ЕДИНОЕ время загрузки данных для всех вкладок (тот же `upd`, что на «Своде»): дата + интервал 1:1. */}
              {upd && <div className="mb-1 mt-0.5 shrink-0 text-[17px] font-normal tracking-wide text-foreground/85">обновлено {upd}</div>}
              {cameraTrend.length > 0 ? (
                <>
                  <div ref={camWheelRef} className="flex min-h-0 flex-1 flex-col">
                    <ChartBox type="line" options={cameraLineOptions} series={cameraLineSeries as ApexAxisChartSeries} className="min-h-[180px] flex-1 lg:min-h-0" />
                  </div>
                  {/* Легенда — шрифт как на «Своде» (17px, точка 3.5); цвет несёт точка. */}
                  <div className="mt-1 flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[17px] text-foreground">
                    {CAMERA_CHART.map((t) => (
                      <span key={t.key} className="inline-flex items-center gap-1.5"><Dot className={`size-3.5 shrink-0 ${t.dot}`} />{t.label}</span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-center text-muted-foreground text-sm">
                  {CAMERA_EMPTY}
                </div>
              )}
            </Panel>
            {/* СПРАВА СНИЗУ — плитки «АЗС по сетевым компаниям» на всю ширину.
                Карточка «Аналитика по камерам» временно вынесена в ветку feat/camera-analytics. */}
            <div className="reveal min-h-0 min-w-0 lg:col-start-2 lg:row-start-2" style={{ animationDelay: "340ms" }}>
              <NetColumns
                rows={cameraNetColumnsRows}
                emptyText={CAMERA_EMPTY}
                selectedNet={filter.net}
                glow={glow}
                titleClassName="text-[17px] lg:text-[23px]"
                ringSize={72}
                sideValues
                labels={{
                  active: "Обеспечено камерами",
                  red: "Не обеспечено камерами",
                  violet: "",
                  title: "АЗС по сетевым компаниям",
                  tip: "Доля АЗС, находящихся в зоне обзора камер видеонаблюдения, от общего количества АЗС в разрезе владельцев АЗС.",
                }}
              />
            </div>
          </div>
        </>
      ) : (
        /* Доклады: табы сверху-слева, список под ними, PDF справа на всю высоту —
           фильтров нет, поэтому PDF занимает и верхнее правое место (без пустоты).
           Левая колонка — 29% (ТА ЖЕ ширина, что сайдбар/табы на остальных вкладках),
           чтобы блок табов был одинаковым везде; PDF (1fr) занимает остальное. */
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-2 lg:grid-cols-[29%_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
          <Card className="hidden shrink-0 items-center px-2.5 py-2 lg:flex lg:col-start-1 lg:row-start-1">
            <ViewTabs view={view} onView={setView} />
          </Card>
          <div className="reveal min-h-0 lg:col-start-1 lg:row-start-2" style={{ animationDelay: "0ms" }}>
            <PresentationsPanel
              selected={report}
              page={reportPage}
              onSelect={selectReport}
              onPickPage={setReportPage}
              onBackToList={() => selectReport(null)}
            />
          </div>
          <div className="reveal min-h-0 min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1" style={{ animationDelay: "90ms" }}>
            <ReportViewer report={report} onBack={() => selectReport(null)} page={reportPage} onPage={setReportPage} />
          </div>
        </div>
      )}
      {/* iOS-нижняя навигация — только моб. (десктоп использует верхний ViewTabs). */}
      <BottomTabBar view={view} onView={(v) => setView(v as ViewMode)} />
    </main>
  );
}

function EmptyDb() {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-semibold text-foreground text-lg">В SQLite пока нет данных</h2>
      <p className="mt-2 text-muted-foreground text-sm">
        Дождитесь автосинка DTW или запустите вручную:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-3 text-left text-foreground text-xs">
        POST /api/sync?k=…
      </pre>
    </div>
  );
}
