"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Panel } from "./ui";
import { ChartBox } from "./ChartBox";
import { InfoTip } from "./InfoTip";
import { useDayScroll } from "./useDayScroll";
import type { SupplyData, SupplyRow } from "@/lib/types";

/** Раздел «Топливная обеспеченность» — отпуск топлива на АЗС по данным ФНС с ККТ (витрина 27200).
 *  Верхний блок: сравнение объёма отпуска по СОПОСТАВИМЫМ дням недели (вс↔вс, вт↔вт) с прошлой неделей.
 *  Нижний блок: динамика отпуска за период с разметкой ключевых зон (праздники, атака на МНПЗ,
 *  «кризисная» неделя) и уровнем «нормы мая». Δ и объёмы — из витрины, мы визуализируем. */

const DOWS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
const FUEL_COLOR: Record<string, string> = {
  "АИ-92": "#14b8a6", "АИ-95, АИ-100": "#ef4444", "ДТ": "#a855f7", "Все виды": "#10b981",
};
/** Порядок строк в таблице (по просьбе): ДТ, АИ-92, АИ-95/100, Все виды. */
const FUEL_ORDER = ["ДТ", "АИ-92", "АИ-95, АИ-100", "Все виды"];
/** Агрегаты, которых нет в витрине — считаем суммой сетей. */
const VINK_NETS = ["Роснефть", "Лукойл", "Газпромнефть", "Татнефть"];
const OTHER_NETS = ["Нефтьмагистраль", "Тебойл"];

/** Разметка нижнего графика — ключевые зоны/события (даты из презентации мэра, данные реальные). */
const ZONES: { from: string; to: string; text: string; fill: string }[] = [
  { from: "2026-05-25", to: "2026-05-31", text: "Обычная неделя (май)", fill: "#64748b" },
  { from: "2026-06-11", to: "2026-06-15", text: "День России", fill: "#f59e0b" },
  { from: "2026-06-22", to: "2026-06-28", text: "«Кризисная» неделя", fill: "#ef4444" },
];
const EVENTS: { iso: string; text: string }[] = [{ iso: "2026-06-18", text: "Атака на МНПЗ" }];

const GREEN = "#10b981"; // линия «Все виды» — основной цвет проекта
const GOLD = "#f59e0b"; // сопоставимые дни недели

const fmtDMY = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}.${m}`; };
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTH_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const fmtDayMon = (iso: string) => { const [, m, d] = iso.split("-"); return `${Number(d)} ${MONTHS_GEN[Number(m) - 1]}`; };
const ru = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const fmtVol = (v: number | null | undefined) => (v == null ? "—" : ru(v));
const fmtDAbs = (v: number | null | undefined) => (v == null ? "" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${ru(Math.abs(v))}`);
const fmtDPct = (v: number | null | undefined) => (v == null ? "" : `${Math.abs(v)}%`);
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

/** Контрастный цвет текста на плашке бренда (тёмный на светлом, иначе белый). */
function contrastText(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#111827" : "#ffffff";
}

/** Пилюля-переключатель дня недели — стиль проекта «Часы/Дни». */
function DowSegment({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-full border border-input bg-background p-0.5">
      {DOWS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`min-w-[34px] rounded-full px-2.5 py-0.5 text-[17px] font-medium transition-colors ${
            value === d ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:text-foreground"
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

export function FuelSupplyPanel({ data, company = "Все", glow }: { data: SupplyData | null; company?: string; glow?: string }) {
  const rows = data?.rows ?? [];
  const fuels = data?.fuels ?? [];
  const orderedFuels = useMemo(() => {
    const idx = (f: string) => { const i = FUEL_ORDER.indexOf(f); return i < 0 ? 99 : i; };
    return [...fuels].sort((a, b) => idx(a) - idx(b));
  }, [fuels]);

  // По умолчанию раскрываем день недели ПОСЛЕДНЕЙ даты в данных (свежие сутки), а не жёстко «Вс»:
  // тогда столбец июля = последняя дата, и на графике «Динамика…» эта точка подсвечена золотом.
  const latestDataDate = useMemo(() => rows.reduce((mx, r) => (r.date > mx ? r.date : mx), ""), [rows]);
  const latestDataDow = useMemo(() => rows.find((r) => r.date === latestDataDate)?.dow ?? "Вс", [rows, latestDataDate]);
  const [dow, setDow] = useState("Вс");
  useEffect(() => { if (latestDataDow) setDow(latestDataDow); }, [latestDataDow]);
  const [fuel, setFuel] = useState("Все виды"); // какой вид топлива строим на графике (клик по таблице)
  // Геометрия области построения (для HTML-подписей зон поверх графика — плашки ApexCharts
  // на категориальной оси рассинхронизируют фон и текст, поэтому рисуем div-ами).
  const [geo, setGeo] = useState<{ left: number; width: number; top: number; height: number } | null>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  const forCompany = useMemo(() => {
    // ВИНК/Прочие витрина не хранит — агрегируем суммой сетей по (дата, вид).
    const agg = company === "ВИНК" ? VINK_NETS : company === "Прочие" ? OTHER_NETS : null;
    if (!agg) return rows.filter((r) => r.company === company);
    const set = new Set(agg);
    const map = new Map<string, SupplyRow>();
    for (const r of rows) {
      if (!set.has(r.company)) continue;
      const key = `${r.date}|${r.fuel}`;
      const e = map.get(key);
      if (e) { e.vol = (e.vol ?? 0) + (r.vol ?? 0); e.dAbs = (e.dAbs ?? 0) + (r.dAbs ?? 0); }
      else map.set(key, { ...r, company });
    }
    // Δ% пересчитываем от суммы: dAbs / (vol − dAbs) · 100.
    return [...map.values()].map((r) => {
      const prev = (r.vol ?? 0) - (r.dAbs ?? 0);
      return { ...r, dPct: prev !== 0 && r.dAbs != null ? Math.round((r.dAbs / prev) * 100) : null };
    });
  }, [rows, company]);

  // ── Верхняя таблица: сопоставимые даты выбранного дня недели (последние 3), строки — виды топлива.
  const dowRows = useMemo(() => forCompany.filter((r) => r.dow === dow), [forCompany, dow]);
  // Колонки — сопоставимый день недели в МАЕ, ИЮНЕ и ИЮЛЕ (последний такой день каждого месяца),
  // как в презентации (31.05 / 28.06 / 05.07 для Вс). Если месяца нет в данных — пропускаем.
  const cols = useMemo(() => {
    const dates = [...new Set(dowRows.map((r) => r.date))].sort();
    const lastOf = (mon: string) => { const g = dates.filter((d) => d.slice(5, 7) === mon); return g.length ? g[g.length - 1] : null; };
    return (["05", "06", "07"].map(lastOf).filter(Boolean) as string[]);
  }, [dowRows]);
  const latest = cols.length ? cols[cols.length - 1] : null;
  const cell = (fuel: string, date: string) => dowRows.find((r) => r.fuel === fuel && r.date === date);

  // ── Нижний график: выбранный вид топлива за весь период (с 11 мая, как в данных витрины).
  const lineColor = FUEL_COLOR[fuel] ?? GREEN;
  const lineFull = useMemo(
    () => forCompany.filter((r) => r.fuel === fuel).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [forCompany, fuel],
  );
  // Окно скролла: показываем WINDOW дней, заканчивающихся на dayEnd; колесо/тачпад над графиком
  // двигают окно с шагом 1 день по всему периоду (как на других графиках). Y-шкала — по всему
  // периоду (стабильна при скролле). Зоны/события подрезаются под окно (см. visZones/visEvents).
  const WINDOW = 14;
  const dayMin = lineFull.length ? lineFull[0].date : "";
  const dayMax = lineFull.length ? lineFull[lineFull.length - 1].date : "";
  const [dayEnd, setDayEnd] = useState(dayMax);
  useEffect(() => { setDayEnd(dayMax); }, [dayMax]);
  const line = useMemo(() => {
    if (!lineFull.length) return lineFull;
    const end = dayEnd || dayMax;
    const [y, m, d] = end.split("-").map(Number);
    const s = new Date(Date.UTC(y, m - 1, d) - (WINDOW - 1) * 86_400_000);
    const start = `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, "0")}-${String(s.getUTCDate()).padStart(2, "0")}`;
    return lineFull.filter((r) => r.date >= start && r.date <= end);
  }, [lineFull, dayEnd, dayMax]);
  const wheelRef = useDayScroll({ enabled: lineFull.length > WINDOW, dayEnd: dayEnd || dayMax, dayMin, dayMax, days: WINDOW, onChange: setDayEnd });
  // Один элемент нужен и для ховер-геометрии (chartWrapRef), и для колеса (wheelRef) → мержим рефы.
  const setChartWrap = useCallback((el: HTMLDivElement | null) => { chartWrapRef.current = el; wheelRef(el); }, [wheelRef]);
  const cats = line.map((r) => fmtDMY(r.date));
  const vals = line.map((r) => r.vol ?? 0);
  const winStart = line[0]?.date ?? "";
  const winEnd = line[line.length - 1]?.date ?? "";
  // Зоны/события — только пересекающие окно; границы подрезаны к окну (иначе аннотация уедет).
  const visZones = ZONES.filter((z) => z.to >= winStart && z.from <= winEnd)
    .map((z) => ({ ...z, from: z.from < winStart ? winStart : z.from, to: z.to > winEnd ? winEnd : z.to }));
  const visEvents = EVENTS.filter((e) => e.iso >= winStart && e.iso <= winEnd);
  const labelForIso = (iso: string) => {
    const hit = line.find((r) => r.date === iso) ?? line.find((r) => r.date >= iso);
    return hit ? fmtDMY(hit.date) : fmtDMY(iso);
  };
  // Категория-«центр» диапазона дат — чтобы подпись зоны стояла строго по центру сектора.
  const centerCat = (fromIso: string, toIso: string) => {
    const idx = line.map((_, i) => i).filter((i) => line[i].date >= fromIso && line[i].date <= toIso);
    return idx.length ? cats[idx[Math.floor(idx.length / 2)]] : labelForIso(fromIso);
  };


  // Подписываем ТОЛЬКО сопоставимые дни недели (золотом) — так чисто, без россыпи плашек.
  // Нативные dataLabels всегда точно на точке (аннотации-плашки в этой версии ApexCharts
  // рассинхронизируют фон и текст на категориальной оси).
  const labeled = useMemo(() => {
    const s = new Set<number>();
    line.forEach((r, i) => { if (r.dow === dow) s.add(i); });
    return s;
  }, [line, dow]);

  // Точки на линии: сопоставимые дни недели — крупнее, в цвет топлива, с белой обводкой.
  const discrete = useMemo(
    () => line.flatMap((r, i) => (r.dow === dow ? [{ seriesIndex: 0, dataPointIndex: i, fillColor: lineColor, strokeColor: "#ffffff", size: 7 }] : [])),
    [line, dow, lineColor],
  );

  // Геометрия плота в КАНВАС-координатах (globals ApexCharts) — для HTML-подписей поверх графика.
  // Позиционируем оверлеи этими координатами: они внутри FitCanvas и масштабируются вместе с SVG.
  const syncGeo = useCallback((c?: { w?: { globals?: { translateX?: number; gridWidth?: number; translateY?: number; gridHeight?: number } } }) => {
    const g = c?.w?.globals;
    if (!g) return;
    const left = g.translateX ?? 0, width = g.gridWidth ?? 0, top = g.translateY ?? 0, height = g.gridHeight ?? 0;
    setGeo((prev) => (prev && prev.left === left && prev.width === width && prev.top === top && prev.height === height ? prev : { left, width, top, height }));
  }, []);

  // Свой ховер: тултип ApexCharts ломается под transform: scale (FitCanvas) — хит-детект берёт
  // внутреннюю ширину, а мышь в отмасштабированных координатах → «уезжает» на соседние точки.
  // Считаем индекс сами по РЕАЛЬНОМУ (отображаемому) rect сетки — верно при любом масштабе.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  useEffect(() => {
    const wrap = chartWrapRef.current;
    if (!wrap) return;
    const n = vals.length;
    const onMove = (e: PointerEvent) => {
      const grid = wrap.querySelector(".apexcharts-grid") as SVGGElement | null;
      if (!grid || n < 2) return;
      const gb = grid.getBoundingClientRect();
      // Реагируем только внутри области построения (не над подписями зон и не под осью дат).
      if (e.clientY < gb.top - 30 || e.clientY > gb.bottom + 6) { setHoverIdx(null); return; }
      const frac = (e.clientX - gb.left) / gb.width;
      if (frac < -0.02 || frac > 1.02) { setHoverIdx(null); return; }
      setHoverIdx(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))));
    };
    const onLeave = () => setHoverIdx(null);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    return () => { wrap.removeEventListener("pointermove", onMove); wrap.removeEventListener("pointerleave", onLeave); };
  }, [vals.length]);

  const annotations: ApexOptions["annotations"] = useMemo(
    () => ({
      position: "back",
      xaxis: [
        // Заливка секторов (подписи и пунктир атаки — HTML-оверлеем, см. render).
        ...visZones.map((z) => ({
          x: labelForIso(z.from), x2: labelForIso(z.to),
          fillColor: z.fill, opacity: 0.12, borderColor: "transparent",
        })),
      ],
    }),
    [line, cats],
  );

  // Ось Y — динамически по видимому окну: плотно вокруг min…max (±~20%),
  // минимальный размах 1.5 млн л, чтобы линия не «сплющивалась». Без forceNiceScale —
  // иначе Apex раздувает шкалу до 0…18 и график снова плоский.
  const viewVals = line.map((r) => r.vol).filter((v): v is number => v != null);
  const dataMax = viewVals.length ? Math.max(...viewVals) : 12;
  const dataMin = viewVals.length ? Math.min(...viewVals) : 9;
  const span = Math.max(dataMax - dataMin, 1.5);
  const pad = span * 0.2;
  const yMin = Math.max(0, Math.floor((dataMin - pad) * 10) / 10);
  const yMax = Math.ceil((dataMax + pad) * 10) / 10;
  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "line", toolbar: { show: false }, zoom: { enabled: false }, background: "transparent", fontFamily: "inherit", parentHeightOffset: 0,
        animations: { enabled: true, speed: 500 },
        events: {
          mounted: (c?: { w?: { globals?: { translateX?: number; gridWidth?: number; translateY?: number; gridHeight?: number } } }) => syncGeo(c),
          updated: (c?: { w?: { globals?: { translateX?: number; gridWidth?: number; translateY?: number; gridHeight?: number } } }) => syncGeo(c),
        },
      },
      theme: { mode: "dark" },
      colors: [lineColor],
      stroke: { curve: "smooth", width: 3 },
      markers: { size: 3, colors: [lineColor], strokeColors: "#0b1220", strokeWidth: 1.5, hover: { size: 6 }, discrete },
      dataLabels: {
        enabled: true,
        // Подписываем ТОЛЬКО сопоставимые дни (золотые плашки) — чисто и по делу.
        formatter: (val: number, opts?: { dataPointIndex?: number }) => (labeled.has(opts?.dataPointIndex ?? -1) ? ru(val) : ""),
        offsetY: -9,
        style: { fontSize: "12.5px", fontWeight: 800, colors: [lineColor] },
        background: { enabled: true, foreColor: contrastText(lineColor), borderWidth: 0, borderRadius: 5, padding: 5, opacity: 1 },
      },
      legend: { show: false },
      annotations,
      grid: { borderColor: "rgba(255,255,255,0.06)", padding: { left: 8, right: 16, top: 6, bottom: 0 } },
      xaxis: {
        type: "category",
        categories: cats,
        tickPlacement: "on",
        tickAmount: Math.max(2, Math.min(14, cats.length)),
        labels: { style: { colors: "#ffffff", fontSize: "16px", fontWeight: 600 }, rotate: 0, hideOverlappingLabels: true },
        axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false },
      },
      yaxis: {
        min: yMin,
        max: yMax,
        tickAmount: 4,
        forceNiceScale: false,
        labels: { formatter: (v: number) => ru(v, 0), style: { colors: "#ffffff", fontSize: "16px", fontWeight: 600 } },
      },
      // Родной тултип отключён — он ломается под FitCanvas (transform: scale). Ховер свой (см. ниже).
      tooltip: { enabled: false },
      // Моб.: диагональные подписи X без наслоения (десктоп >1024 не затронут).
      responsive: [{ breakpoint: 1024, options: { xaxis: { labels: { rotate: -45, rotateAlways: true, style: { fontSize: "11px" } } } } }],
    }),
    [annotations, cats, line, yMax, yMin, discrete, labeled, lineColor],
  );

  // HTML-подписи зон/события: белые блоки поверх графика, X — по индексу категории в плоте.
  const overlays = useMemo(() => {
    const none = { labels: [] as { text: string; color: string; x: number; event: boolean }[], attackX: null as number | null };
    if (!geo || geo.width <= 0 || line.length < 2) return none;
    const n = line.length;
    const xOf = (cat: string) => { const i = cats.indexOf(cat); return i < 0 ? geo.left : geo.left + (i / (n - 1)) * geo.width; };
    const labels = [
      ...visZones.map((z) => ({ text: z.text, color: z.fill, x: xOf(centerCat(z.from, z.to)), event: false })),
      ...visEvents.map((e) => ({ text: e.text, color: "#ef4444", x: xOf(labelForIso(e.iso)), event: true })),
    ];
    return { labels, attackX: visEvents.length ? xOf(labelForIso(visEvents[0].iso)) : null };
  }, [geo, line, cats]);

  // Разделители месяцев: вертикальная линия на границе (между посл. днём месяца и первым
  // следующего) + подпись месяца по центру его сегмента (Май | Июнь | Июль) — чтобы при
  // скролле было видно разделение периодов.
  const monthMarks = useMemo(() => {
    const none = { dividers: [] as number[], labels: [] as { x: number; text: string }[] };
    if (!geo || geo.width <= 0 || line.length < 2) return none;
    const n = line.length;
    const xAt = (i: number) => geo.left + (i / (n - 1)) * geo.width;
    const dividers: number[] = [];
    const groups = new Map<string, number[]>();
    line.forEach((r, i) => {
      const mon = r.date.slice(0, 7);
      (groups.get(mon) ?? groups.set(mon, []).get(mon)!).push(i);
      if (i > 0 && r.date.slice(5, 7) !== line[i - 1].date.slice(5, 7)) dividers.push(xAt(i - 0.5));
    });
    const labels = [...groups.entries()].map(([mon, idxs]) => ({ x: xAt(idxs[Math.floor(idxs.length / 2)]), text: MONTH_NOM[Number(mon.slice(5, 7)) - 1] }));
    return { dividers, labels };
  }, [geo, line]);

  const empty = !data || rows.length === 0;
  if (empty) {
    return (
      <Panel className={`h-full ${glow ?? ""}`} bodyClassName="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground text-sm">Нет данных отпуска. Дождитесь синка DTW (витрина 27200) или POST /api/sync.</div>
      </Panel>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* ── ВЕРХНИЙ БЛОК: сравнение по сопоставимым дням недели ─────────────────────── */}
      <Panel className={`shrink-0 ${glow ?? ""}`} bodyClassName="flex flex-col gap-2">
        {/* Заголовок + фильтр дней недели в одну строку */}
        <header className="flex flex-col items-start gap-2 lg:flex-row lg:justify-between lg:gap-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-medium text-[17px] lg:text-[23px] text-foreground leading-tight">
              Отпуск на АЗС за сутки в сравнении со стандартным отпуском топлива
              <InfoTip
                label="Таблица"
                text={"Сравнение суммарного объёма суточного потребления топлива в млн л, по данным с контрольно-кассовой техники (ККТ) в сопоставимые дни недели в мае, июне и июле."}
              />
            </h3>
            <p className="mt-0.5 text-[13.5px] text-foreground">данные ФНС России с контрольно-кассовой техники на АЗС</p>
          </div>
          <div className="w-full shrink-0 overflow-x-auto lg:w-auto"><DowSegment value={dow} onChange={setDow} /></div>
        </header>

        {/* Сравнение по видам топлива (flex-строки, как в проекте). Выбор вида для графика —
            прямо в столбце «Вид топлива» (радио-кружок + подсветка активной строки). */}
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <div className="min-w-[660px]">
            <div className="flex items-center gap-2 border-border/60 border-b px-4 py-1.5 text-[13.5px] text-foreground">
              <span className="flex-1">Вид топлива</span>
              {cols.map((d) => (
                <span key={d} className="w-[21%] text-right tabular-nums">{fmtDayMon(d)} {dow}</span>
              ))}
              <span className="w-[21%] text-right">Δ к пр. неделе</span>
            </div>
            {orderedFuels.map((f) => {
              const last = latest ? cell(f, latest) : undefined;
              const d = last?.dAbs ?? null;
              const up = d != null && d > 0, down = d != null && d < 0;
              const dc = up ? "text-emerald-400" : down ? "text-rose-400" : "text-foreground";
              const total = f === "Все виды"; // итоговая строка — отделяем и делаем жирнее
              return (
                <button
                  type="button"
                  key={f}
                  onClick={() => setFuel(f)}
                  className={`flex w-full cursor-pointer items-center gap-2 px-4 py-1.5 text-left text-[17px] lg:text-[23px] text-foreground transition-colors ${total ? "border-border border-t-2 font-semibold" : "border-border/40 border-t"} ${f === fuel ? "bg-white/[0.08]" : "hover:bg-muted/30"}`}
                  style={f === fuel ? { boxShadow: `inset 3px 0 0 ${FUEL_COLOR[f] ?? "#94a3b8"}` } : undefined}
                >
                  <span className="flex flex-1 items-center gap-2.5 font-medium">
                    {/* радио-кружок в цвет топлива — видно, что строку можно выбрать */}
                    <span className="grid size-4 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: FUEL_COLOR[f] ?? "#94a3b8" }}>
                      {f === fuel && <span className="size-2 rounded-full" style={{ background: FUEL_COLOR[f] ?? "#94a3b8" }} />}
                    </span>
                    {f}
                  </span>
                  {cols.map((c, i) => (
                    <span key={c} className={`w-[21%] text-right tabular-nums ${i === cols.length - 1 ? "font-bold" : ""}`}>
                      {fmtVol(cell(f, c)?.vol)} <span className="text-[20px] font-normal">млн&nbsp;л</span>
                    </span>
                  ))}
                  <span className={`flex w-[21%] items-center justify-end gap-1 font-bold tabular-nums ${dc}`}>
                    {up && <ArrowUp className="size-4" strokeWidth={2.75} />}
                    {down && <ArrowDown className="size-4" strokeWidth={2.75} />}
                    {fmtDAbs(d)} <span className="text-[20px] font-normal">млн&nbsp;л</span>
                    {d != null && d !== 0 && <span className="ml-1 text-[20px]">({fmtDPct(last?.dPct)})</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      {/* ── НИЖНИЙ БЛОК: динамика отпуска за период с разметкой зон ─────────────────── */}
      <Panel
        title={
          <span className="flex min-w-0 items-center gap-1.5 text-[17px] lg:text-[23px]">
            <span className="shrink-0">Динамика отпуска топлива за период <span className="text-[18px] font-normal text-foreground">(млн литров/сутки)</span></span>
            <InfoTip label="График" text={"График суммарного объёма суточного потребления топлива в млн л, по данным с контрольно-кассовой техники (ККТ)."} />
          </span>
        }
        className={`flex-1 ${glow ?? ""}`}
        bodyClassName="flex min-h-0 flex-1 flex-col gap-0.5 pb-2"
      >
        <div ref={setChartWrap} className="relative min-h-0 flex-1">
          {/* Пунктир «Атаки на МНПЗ» — на ЗАДНЕМ плане (за линией) и выше: от подписи до низа графика */}
          {geo && overlays.attackX != null && (
            <div
              className="pointer-events-none absolute z-0 border-red-500 border-l-2 border-dashed"
              style={{ left: overlays.attackX, top: geo.top - 26, height: geo.height + 26, width: 0 }}
            />
          )}
          <ChartBox type="line" options={options} series={[{ name: fuel, data: vals }] as ApexAxisChartSeries} className="relative z-[1] h-full min-h-[300px] lg:min-h-0" />
          {/* Разделители месяцев (граница мес.) + подпись месяца по центру сегмента — мэр видит разделение. */}
          {geo && monthMarks.dividers.map((x, i) => (
            <div key={`md${i}`} className="pointer-events-none absolute z-[2] border-white/25 border-l border-dashed" style={{ left: x, top: geo.top, height: geo.height, width: 0 }} />
          ))}
          {geo && monthMarks.labels.map((m, i) => (
            <div key={`ml${i}`} className="pointer-events-none absolute z-[2] -translate-x-1/2 whitespace-nowrap text-[14px] font-semibold uppercase tracking-wider text-white" style={{ left: m.x, top: geo.top + 3 }}>{m.text}</div>
          ))}
          {/* Подписи зон/событий — белый текст (событие «Атака» выше зон, чтобы не сливалось) */}
          {geo && overlays.labels.map((o, i) => (
            <div
              key={i}
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap font-medium text-[15px] text-white"
              style={{ left: o.x, top: geo.top - (o.event ? 24 : 4) }}
            >
              {o.text}
            </div>
          ))}
          {/* Свой ховер: подсветка точки + тултип (координаты канваса, поверх FitCanvas-масштаба) */}
          {geo && hoverIdx != null && line[hoverIdx] && vals.length > 1 && (() => {
            const r = line[hoverIdx];
            const x = geo.left + (hoverIdx / (vals.length - 1)) * geo.width;
            const y = geo.top + (1 - ((r.vol ?? 0) - yMin) / (yMax - yMin || 1)) * geo.height;
            const below = y < geo.top + geo.height * 0.32;
            // Горизонтальный якорь тултипа — чтобы не вылезал за край плота у левой/правой границы.
            const xClass = x < geo.left + 90 ? "translate-x-0" : x > geo.left + geo.width - 90 ? "-translate-x-full" : "-translate-x-1/2";
            return (
              <>
                <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: x, top: y, width: 14, height: 14, background: lineColor }} />
                <div
                  data-hover-tip
                  className={`pointer-events-none absolute z-20 ${xClass} ${below ? "translate-y-3" : "-translate-y-full"} whitespace-nowrap rounded-lg border border-white/15 bg-[#0b1220] px-3 py-2 text-white shadow-xl`}
                  style={{ left: x, top: below ? y : y - 10 }}
                >
                  <div className="font-semibold text-[13.5px]">{fmtDMY(r.date)} <span className="text-white/60">({r.dow})</span></div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[18px] tabular-nums">
                    <span className="size-2.5 rounded-full" style={{ background: lineColor }} />
                    {fmtVol(r.vol)} <span className="text-white/60">млн л</span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </Panel>
    </div>
  );
}
