"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { Panel, Dot } from "./ui";
import { InfoTip } from "./InfoTip";
import { ChartBox } from "./ChartBox";
import { GranControl } from "./GranControl";
import { useDayScroll } from "./useDayScroll";
import type { FuelSeriesPoint } from "@/lib/trend";
import { windowByEnd } from "@/lib/trend";
import { fmtDay, fmtInt } from "@/lib/format";

type Gran = "day" | "hour";

type FuelMetric = { key: string; name: string; color: string };

/** Виды топлива графика «Доступность топлива» (порядок как везде: ДТ → 92 → 95+). */
const FUELS: FuelMetric[] = [
  { key: "any", name: "Доступно", color: "#10b981" },
  { key: "gdt", name: "ДТ, ДТ+", color: "#a855f7" },
  { key: "g92", name: "92, 92+", color: "#14b8a6" },
  { key: "g95", name: "95, 95+", color: "#ef4444" },
] as FuelMetric[];

const TIP = "Работающие АЗС, на которых реализуются основные виды топлива на момент мониторинга.";

/**
 * Линейно заполняет ВНУТРЕННИЕ пропуски (null между точками с данными), чтобы линия
 * шла непрерывно через снимки без данных о видах (в ApexCharts 3.54 нет connectNulls).
 * Ведущие/замыкающие null остаются. Подписи/маркеры ставим только на реальные точки.
 */
function fillGaps(v: (number | null)[]): (number | null)[] {
  const out = v.slice();
  const first = v.findIndex((x) => x != null);
  if (first < 0) return out;
  let last = first;
  for (let k = v.length - 1; k >= 0; k--) if (v[k] != null) { last = k; break; }
  let a = first;
  while (a < last) {
    if (v[a] == null) { a++; continue; }
    let b = a + 1;
    while (b <= last && v[b] == null) b++;
    if (b <= last && b > a + 1) {
      const va = v[a] as number, vb = v[b] as number, step = (vb - va) / (b - a);
      for (let j = a + 1; j < b; j++) out[j] = va + step * (j - a);
    }
    a = b;
  }
  return out;
}

/**
 * Подписи стоят РОВНО на своих точках (шкала сходится) — их НЕ двигаем. Там, где боксы
 * налегают (близкие значения на нескольких линиях), лишние ПРЯЧЕМ, а не сдвигаем: иначе
 * подпись уезжает от своего значения. Оставляем максимальный непересекающийся набор (жадно
 * по нижнему краю). Скрытые значения видны по наведению (tooltip) и самой линией.
 * Идемпотентно: каждый прогон сначала показывает все, затем заново решает, кого спрятать.
 */
function deOverlapLabels(root?: Element | null) {
  if (!root) return;
  const parseTy = (t: string | null): number => {
    const m = /translate\(\s*[-\d.]+[\s,]+([-\d.]+)/.exec(t ?? "");
    return m ? parseFloat(m[1]) : 0;
  };
  type Box = { el: SVGGraphicsElement & { style: CSSStyleDeclaration }; top: number; bottom: number; cx: number };
  const boxes: Box[] = [];
  for (const g of root.querySelectorAll(".apexcharts-datalabels")) {
    for (const el of g.querySelectorAll(":scope > g.apexcharts-data-labels")) {
      const g2 = el as SVGGraphicsElement & { style: CSSStyleDeclaration };
      g2.style.visibility = ""; // показать все перед замером
      let bb: DOMRect | null = null;
      try { bb = g2.getBBox(); } catch { bb = null; }
      if (!bb || bb.width === 0) continue;
      // getBBox игнорирует собственный transform → истинная позиция = bbox + translateY.
      const top = bb.y + parseTy(g2.getAttribute("transform"));
      boxes.push({ el: g2, top, bottom: top + bb.height, cx: bb.x + bb.width / 2 });
    }
  }
  const cols = new Map<number, Box[]>();
  for (const b of boxes) {
    const key = Math.round(b.cx / 20);
    (cols.get(key) ?? cols.set(key, []).get(key)!).push(b);
  }
  const GAP = 1;
  for (const arr of cols.values()) {
    // Максимум непересекающихся: сортировка по нижнему краю + жадный выбор «самых ранних».
    arr.sort((a, b) => a.bottom - b.bottom);
    let lastBottom = -Infinity;
    for (const b of arr) {
      if (b.top >= lastBottom + GAP) { b.el.style.visibility = ""; lastBottom = b.bottom; }
      else b.el.style.visibility = "hidden";
    }
  }
}

export function TrendPanel({
  available, day, hour, emptyText, glow, updated, title, subtitle, tip, fuels = FUELS, valueSuffix = "АЗС", formatValue = fmtInt,
  formatAxis = formatValue, formatLabel = formatValue, labelFontSize = "15px",
  yStep = 50, yPadBelow = 40, yPadAbove = 45, defaultGran = "hour", selectableFuels = false, defaultVisibleFuelKeys,
  hoverFuelKey = null, onFuelHover, showGranSwitch = true, showDayPicker = false, tipClassName, titleClassName = "text-[17px] lg:text-[23px]",
}: {
  available: boolean | null;
  day: FuelSeriesPoint[];
  hour: FuelSeriesPoint[];
  emptyText: string;
  glow?: string;
  updated?: string;
  title?: string;
  subtitle?: string;
  tip?: string;
  fuels?: FuelMetric[];
  valueSuffix?: string;
  formatValue?: (value: number) => string;
  /** Форматтер подписей оси Y (по умолчанию = formatValue). Для цен — целые числа. */
  formatAxis?: (value: number) => string;
  /** Форматтер подписей на точках (по умолчанию = formatValue). Для цен — целые, чтобы не наезжали. */
  formatLabel?: (value: number) => string;
  /** Кегль подписей на точках (по умолчанию 15px — как подписи осей). */
  labelFontSize?: string;
  yStep?: number;
  yPadBelow?: number;
  yPadAbove?: number;
  defaultGran?: Gran;
  selectableFuels?: boolean;
  defaultVisibleFuelKeys?: string[];
  hoverFuelKey?: string | null;
  onFuelHover?: (key: string | null) => void;
  showGranSwitch?: boolean;
  /** Показать только календарь (без пилюли «Часы/Дни») — для окон без часов (попап ограничений). */
  showDayPicker?: boolean;
  tipClassName?: string;
  /** Кегль заголовка панели: по умолч. 23px (как графики), 20px — под панель «Ограничения» в попапе. */
  titleClassName?: string;
}) {
  const [gran, setGran] = useState<Gran>(defaultGran);
  // «Дни»: окно последних 7 дней, заканчивающихся на выбранной дате (по умолч. последний день данных).
  const dayMin = day.length ? day[0].key : "";
  const dayMax = day.length ? day[day.length - 1].key : "";
  const [dayEnd, setDayEnd] = useState(dayMax);
  useEffect(() => { setDayEnd(dayMax); }, [dayMax]);
  const dayWindow = useMemo(() => windowByEnd(day, dayEnd), [day, dayEnd]);
  // Колесо/тачпад над графиком двигает окно дат с шагом 1 день (только в режиме «Дни»).
  const wheelRef = useDayScroll({ enabled: gran === "day", dayEnd: dayEnd || dayMax, dayMin, dayMax, onChange: setDayEnd });
  const [visibleFuelKeys, setVisibleFuelKeys] = useState<Set<string>>(
    () => new Set(defaultVisibleFuelKeys ?? fuels.map((f) => f.key)),
  );
  // На узком экране постоянные подписи (7 точек × 4 линии) сливаются — прячем их.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const calc = () => setNarrow(window.innerWidth < 1024);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  const points: FuelSeriesPoint[] = gran === "day" ? dayWindow : hour;
  const activeFuels = selectableFuels ? fuels.filter((f) => visibleFuelKeys.has(f.key)) : fuels;
  const hasHoveredActiveFuel = hoverFuelKey != null && activeFuels.some((f) => f.key === hoverFuelKey);

  // Двухстрочные подписи оси, чтобы высота графика не менялась между «Часы»/«Дни».
  const categories = points.map((p) =>
    gran === "day" ? fmtDay(p.key).split(" ") : p.sub ? [p.key, p.sub] : p.key,
  );
  // Реальные значения (с null) по каждому виду — для маркеров/подписей.
  const colors = activeFuels.map((f) => (hasHoveredActiveFuel && f.key !== hoverFuelKey ? "rgba(255,255,255,0.26)" : f.color));
  const realByIdx = activeFuels.map((f) => points.map((p) => {
    const value = p[f.key];
    return typeof value === "number" ? value : null;
  }));
  const series = activeFuels.map((f, i) => ({ name: f.name, data: fillGaps(realByIdx[i]) }));

  // Маркеры только на реальных точках (на интерполированных отрезках — нет).
  const discreteMarkers = realByIdx.flatMap((arr, si) =>
    arr.flatMap((v, di) =>
      v == null ? [] : [{
        seriesIndex: si,
        dataPointIndex: di,
        size: hasHoveredActiveFuel ? (activeFuels[si]?.key === hoverFuelKey ? 4.8 : 2.5) : 3.5,
        fillColor: colors[si],
        strokeColor: colors[si],
      }],
    ),
  );

  // Ось ВПЛОТНУЮ к данным (верх ≈ максимуму линий), но с НЕбольшим числом делений (~6):
  // шаг «круглый» и динамический (1/2/2.5/4/5 × 10ⁿ), не грубее yStep. Так нет ни густой
  // сетки, ни «пустых» линий сетки над данными (500 над 457), и подписи бьются со шкалой.
  const vals = realByIdx.flat().filter((v): v is number => v != null);
  const dataMin = vals.length ? Math.min(...vals) : 0;
  const dataMax = vals.length ? Math.max(...vals) : 100;
  const niceStep = (range: number): number => {
    const raw = Math.max(1, range) / 6; // цель ~6 делений
    const mag = 10 ** Math.floor(Math.log10(raw));
    for (const m of [1, 2, 2.5, 4, 5, 10]) if (m * mag >= raw) return m * mag;
    return 10 * mag;
  };
  const headroom = Math.max(1, Math.min(yPadAbove, yPadBelow)); // хинт под верхнюю подпись
  const yStepEff = Math.max(1, Math.min(yStep, niceStep(dataMax - dataMin)));
  let yMax = Math.ceil(dataMax / yStepEff) * yStepEff;
  if (yMax - dataMax < Math.min(headroom, yStepEff * 0.25)) yMax += yStepEff; // место под подпись макс.
  const yMin = Math.max(0, Math.floor(dataMin / yStepEff) * yStepEff);
  const yTicks = Math.max(2, Math.round((yMax - yMin) / yStepEff));

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "line", toolbar: { show: false }, zoom: { enabled: false }, background: "transparent", fontFamily: "inherit",
        parentHeightOffset: 0,
        animations: { enabled: true, easing: "easeinout", speed: 700, animateGradually: { enabled: true, delay: 100 }, dynamicAnimation: { enabled: true, speed: 350 } },
        // Белые боксы подписей на 4 линиях часто налезают — лишние прячем (подписи не
        // двигаем с их значений) на каждый рендер (ApexCharts пересоздаёт группы подписей).
        events: {
          mounted: (c: { el?: Element } | undefined) => deOverlapLabels(c?.el),
          updated: (c: { el?: Element } | undefined) => deOverlapLabels(c?.el),
          animationEnd: (c: { el?: Element } | undefined) => deOverlapLabels(c?.el),
        },
      },
      theme: { mode: "dark" },
      colors,
      dataLabels: {
        // Число АЗС на каждой реальной точке — в белом блоке (как раньше);
        // на интерполированных отрезках (raw=null) — ничего.
        enabled: !narrow,
        formatter: (_val, opts) => {
          const si = opts?.seriesIndex ?? 0, di = opts?.dataPointIndex ?? 0;
          const raw = realByIdx[si]?.[di];
          return raw == null ? "" : formatLabel(raw);
        },
        // Плашку поднимаем чуть НАД точкой (минимальный зазор, точка видна под ней).
        offsetY: -6,
        // Заливка блока = style.colors (цвет кривой), текст = background.foreColor (белый):
        // цветные блоки в тон линии с белыми цифрами. Компактнее — подпись сидит ближе к точке.
        style: { fontSize: labelFontSize, fontWeight: 700, colors: colors as unknown as string[] },
        background: { enabled: true, foreColor: "#ffffff", borderWidth: 0, borderRadius: 4, padding: 2, opacity: 1 },
      },
      stroke: { curve: "smooth", width: hasHoveredActiveFuel ? activeFuels.map((f) => f.key === hoverFuelKey ? 4 : 1.6) : 2.5 },
      markers: { size: 0, strokeWidth: 0, hover: { size: 5 }, discrete: discreteMarkers },
      legend: { show: false },
      fill: { type: "solid", opacity: 1 },
      grid: { borderColor: "rgba(255,255,255,0.06)", padding: { left: 24, right: 44, top: -8, bottom: -24 } },
      xaxis: {
        categories: categories as unknown as string[],
        tickAmount: gran === "hour" ? categories.length : undefined,
        labels: { offsetY: -2, style: { colors: "#e5e7eb", fontSize: "15px" }, rotate: 0, rotateAlways: false, hideOverlappingLabels: false },
        axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false },
      },
      yaxis: {
        min: yMin, max: yMax, tickAmount: yTicks,
        labels: { offsetX: -8, formatter: (v: number) => formatAxis(v), style: { colors: "#e5e7eb", fontSize: "15px" } },
      },
      tooltip: {
        theme: "dark", shared: true, intersect: false,
        y: {
          formatter: (v: number, opts?: { seriesIndex?: number; dataPointIndex?: number }) => {
            if (v == null) return "—";
            const base = `${formatValue(v)} ${valueSuffix}`;
            const si = opts?.seriesIndex ?? -1;
            const di = opts?.dataPointIndex ?? -1;
            const fkey = activeFuels[si]?.key;
            if (!fkey || di < 0) return base;
            const shareKey = fkey === "tank" ? "tankShare" : fkey === "canister" ? "canisterShare" : null;
            if (!shareKey) return base;
            const sh = points[di]?.[shareKey];
            if (typeof sh !== "number" || !Number.isFinite(sh)) return base;
            return `${base} (${sh.toFixed(1).replace(".", ",")}%)`;
          },
        },
      },
      // Моб.: диагональные подписи X без наслоения (десктоп >1024 не затронут).
      responsive: [{ breakpoint: 1024, options: { xaxis: { labels: { rotate: -45, rotateAlways: true, hideOverlappingLabels: true, style: { fontSize: "11px" } } } } }],
    }),
    [categories, gran, discreteMarkers, realByIdx, narrow, yMin, yMax, yTicks, colors, valueSuffix, formatValue, formatAxis, formatLabel, labelFontSize, hasHoveredActiveFuel, activeFuels, hoverFuelKey, points],
  );

  const hasData = points.some((p) => activeFuels.some((f) => typeof p[f.key] === "number"));
  const toggleFuel = (key: string) => {
    setVisibleFuelKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  const fuelToggle = (f: FuelMetric, compact = false) => {
    const active = !selectableFuels || visibleFuelKeys.has(f.key);
    if (compact) {
      return (
        <button
          key={`top-${f.key}`}
          type="button"
          aria-pressed={active}
          onClick={() => toggleFuel(f.key)}
          onMouseEnter={() => onFuelHover?.(f.key)}
          onMouseLeave={() => onFuelHover?.(null)}
          onMouseOver={() => onFuelHover?.(f.key)}
          onMouseOut={() => onFuelHover?.(null)}
          onFocus={() => onFuelHover?.(f.key)}
          onBlur={() => onFuelHover?.(null)}
          className={`flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[16px] font-medium transition-colors ${
            active
              ? "border-white/20 bg-white/[0.07] text-foreground hover:bg-white/[0.1]"
              : "border-white/10 bg-white/[0.025] text-foreground/45 hover:border-white/18 hover:bg-white/[0.05] hover:text-foreground/70"
          }`}
        >
          <span
            className="size-3 rounded-[3px] border"
            style={{
              background: active ? f.color : "rgba(255,255,255,0.12)",
              borderColor: active ? f.color : "rgba(255,255,255,0.22)",
            }}
          />
          {f.name}
        </button>
      );
    }
    return (
      <button
        key={`bottom-${f.key}`}
        type="button"
        aria-pressed={active}
        onClick={() => toggleFuel(f.key)}
        onMouseEnter={() => onFuelHover?.(f.key)}
        onMouseLeave={() => onFuelHover?.(null)}
        onMouseOver={() => onFuelHover?.(f.key)}
        onMouseOut={() => onFuelHover?.(null)}
        onFocus={() => onFuelHover?.(f.key)}
        onBlur={() => onFuelHover?.(null)}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 transition-colors ${
          active
            ? "border-white/20 bg-white/[0.07] text-foreground hover:bg-white/[0.1]"
            : "border-white/10 bg-white/[0.03] text-foreground/45 hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground/70"
        }`}
      >
        {/* Индикатор — кружок (залит цветом вида при выборе, приглушён иначе); вся плашка
            обведена рамкой-чипом → видно, что кликабельно. */}
        <span className="size-3.5 rounded-full" style={{ background: active ? f.color : "rgba(255,255,255,0.28)" }} /> {f.name}
      </button>
    );
  };

  return (
    <Panel
      title={
        <span className={`flex min-w-0 items-center gap-1.5 ${titleClassName}`}>
          <span className="truncate">{title ?? "Доступность топлива"} <span className="text-[17px] font-normal text-foreground/70">({subtitle ?? "количество АЗС, шт."})</span></span>
          <InfoTip label={title ?? "Доступность топлива"} text={tip ?? TIP} popupClassName={tipClassName} />
        </span>
      }
      right={showGranSwitch ? (
        /* Выбор вида топлива вынесен в кликабельную легенду под графиком (не дублируем в шапке). */
        <GranControl gran={gran} onGran={setGran} dayEnd={dayEnd} onDayEnd={setDayEnd} dayMin={dayMin} dayMax={dayMax} />
      ) : showDayPicker ? (
        <GranControl pickerOnly gran={gran} onGran={setGran} dayEnd={dayEnd} onDayEnd={setDayEnd} dayMin={dayMin} dayMax={dayMax} />
      ) : null}
      className={`h-full transition-shadow duration-300 ${glow ?? ""}`}
      bodyClassName="flex flex-1 flex-col pt-0 pb-2.5"
    >
      {/* Метка среза — под заголовком, читаемо и с трекингом (цифры даты не слипаются). */}
      {updated && <div className="mb-1 mt-0.5 shrink-0 text-[17px] font-normal tracking-wide text-foreground/85">обновлено {updated}</div>}
      {hasData ? (
        <>
          {/* Единицы измерения — в заголовке; вертикальную шкалу не подписываем. */}
          <div ref={wheelRef} className="relative min-h-0 flex-1">
            <ChartBox type="line" options={options} series={series as ApexAxisChartSeries} className="h-full min-h-[280px] lg:min-h-0" />
          </div>
          {/* Легенда по центру. При выборе видов топлива — кликабельные тумблеры с подсказкой. */}
          <div className="mt-0 flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[17px] text-foreground">
            {selectableFuels && <span className="font-medium text-foreground/70">Выберите тип топлива:</span>}
            {fuels.map((f) => selectableFuels ? fuelToggle(f) : (
              <span key={f.key} className="flex items-center gap-1.5 whitespace-nowrap">
                <Dot className="size-3.5" style={{ background: f.color }} /> {f.name}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-center text-foreground text-sm">
          {available == null ? "Загрузка истории…" : emptyText}
        </div>
      )}
    </Panel>
  );
}
