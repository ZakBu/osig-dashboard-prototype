"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { Panel } from "./ui";
import { InfoTip } from "./InfoTip";
import { ChartBox } from "./ChartBox";
import { GranControl } from "./GranControl";
import { useDayScroll } from "./useDayScroll";
import type { QueueTrendPoint } from "@/lib/trend";
import { windowByEnd } from "@/lib/trend";
import { fmtDay, fmtInt } from "@/lib/format";

type Gran = "day" | "hour";

/** Контрастный цвет текста для плашки бренда: тёмный на светлых (жёлтый Роснефти), иначе белый. */
function labelTextColor(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#111827" : "#ffffff";
}

const TIP = "Работающие АЗС, очередь из автомобилей на которых составляет более 5 машин.";

/** Вторую строку подписи («очередь/доступных») делаем мельче — доля% остаётся крупной. */
function styleQueueLabels(root?: Element | null) {
  if (!root) return;
  for (const t of root.querySelectorAll(".apexcharts-datalabels text")) {
    const sp = t.querySelectorAll("tspan");
    if (sp.length >= 2) {
      const last = sp[sp.length - 1] as SVGElement;
      last.setAttribute("font-size", "13px");
      last.setAttribute("font-weight", "700");
      last.setAttribute("fill-opacity", "0.95");
    }
  }
}

/** График очередей во времени по КОНКРЕТНОЙ сети (заменяет 2 нижних блока при фильтре). */
export function QueueTrendPanel({
  day, hour, color, emptyText, glow,
}: {
  day: QueueTrendPoint[];
  hour: QueueTrendPoint[];
  color: string;
  emptyText: string;
  glow?: string;
}) {
  const [gran, setGran] = useState<Gran>("hour");
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const calc = () => setNarrow(window.innerWidth < 1024);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // «Дни»: окно последних 7 дней, заканчивающихся на выбранной дате (по умолч. последний день данных).
  const dayMin = day.length ? day[0].key : "";
  const dayMax = day.length ? day[day.length - 1].key : "";
  const [dayEnd, setDayEnd] = useState(dayMax);
  useEffect(() => { setDayEnd(dayMax); }, [dayMax]);
  const dayWindow = useMemo(() => windowByEnd(day, dayEnd), [day, dayEnd]);
  // Колесо/тачпад над графиком двигает окно дат с шагом 1 день (только в режиме «Дни»).
  const wheelRef = useDayScroll({ enabled: gran === "day", dayEnd: dayEnd || dayMax, dayMin, dayMax, onChange: setDayEnd });

  const points = gran === "day" ? dayWindow : hour;
  const categories = points.map((p) => (gran === "day" ? fmtDay(p.key).split(" ") : p.sub ? [p.key, p.sub] : p.key));
  const values = points.map((p) => p.value);
  const opens = points.map((p) => p.open);
  const series = [{ name: "Очередь", data: values }];
  const maxVal = Math.max(1, ...values);
  const yMax = Math.ceil((maxVal + Math.max(4, maxVal * 0.15)) / 10) * 10;

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "line", toolbar: { show: false }, zoom: { enabled: false }, background: "transparent", fontFamily: "inherit",
        parentHeightOffset: 0,
        animations: { enabled: true, easing: "easeinout", speed: 700, dynamicAnimation: { enabled: true, speed: 350 } },
        // Вторую строку подписи («N/M») делаем мельче — доля% остаётся крупной.
        events: {
          mounted: (c: { el?: Element } | undefined) => styleQueueLabels(c?.el),
          updated: (c: { el?: Element } | undefined) => styleQueueLabels(c?.el),
          animationEnd: (c: { el?: Element } | undefined) => styleQueueLabels(c?.el),
        },
      },
      theme: { mode: "dark" },
      colors: [color],
      dataLabels: {
        // Крупно — доля АЗС сети с очередью; под ней «с очередью / доступных для заправки».
        enabled: !narrow,
        formatter: (_v, opts) => {
          const di = opts?.dataPointIndex ?? 0;
          const q = values[di], open = opens[di];
          if (q == null) return "";
          const pct = open > 0 ? Math.round((q / open) * 100) : 0;
          return [`${pct}%`, `${fmtInt(q)}/${fmtInt(open)}`] as unknown as string;
        },
        // Поднимаем плашку чуть НАД точкой (минимальный зазор; плашка 2-строчная и выше
        // одностроч­ных, поэтому offset больше — тот же визуальный зазор ~1–2px).
        offsetY: -14,
        // Заливка плашки = цвет кривой; текст — контрастный (тёмный на светлом бренде).
        style: { fontSize: "15px", fontWeight: 800, colors: [color] },
        background: { enabled: true, foreColor: labelTextColor(color), borderWidth: 0, borderRadius: 4, padding: 2, opacity: 1 },
      },
      stroke: { curve: "smooth", width: 3 },
      markers: { size: 4, colors: [color], strokeWidth: 0, hover: { size: 6 } },
      legend: { show: false },
      fill: { type: "solid", opacity: 1 },
      grid: { borderColor: "rgba(255,255,255,0.06)", padding: { left: 24, right: 40, top: 10, bottom: -22 } },
      xaxis: {
        categories: categories as unknown as string[],
        tickAmount: gran === "hour" ? categories.length : undefined,
        labels: { offsetY: -2, style: { colors: "#e5e7eb", fontSize: "15px" }, rotate: 0, hideOverlappingLabels: false },
        axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false },
      },
      yaxis: {
        min: 0, max: yMax, tickAmount: 4,
        labels: { offsetX: -8, formatter: (v: number) => fmtInt(Math.round(v)), style: { colors: "#e5e7eb", fontSize: "15px" } },
      },
      tooltip: {
        theme: "dark",
        y: {
          formatter: (v: number, o?: { dataPointIndex?: number }) => {
            const open = opens[o?.dataPointIndex ?? 0] ?? 0;
            const pct = open > 0 ? Math.round((v / open) * 100) : 0;
            return `${fmtInt(v)} с очередью из ${fmtInt(open)} доступных (${pct}%)`;
          },
        },
      },
      // Моб.: диагональные подписи X без наслоения (десктоп >1024 не затронут).
      responsive: [{ breakpoint: 1024, options: { xaxis: { labels: { rotate: -45, rotateAlways: true, hideOverlappingLabels: true, style: { fontSize: "11px" } } } } }],
    }),
    [categories, gran, values, opens, color, narrow, yMax],
  );

  const hasData = points.length > 0;

  return (
    <Panel
      title={
        <span className="flex min-w-0 items-center gap-1.5 text-[17px] lg:text-[23px]">
          <span className="shrink-0">Очереди <span className="text-[17px] font-normal text-foreground/70">(количество АЗС, шт.)</span></span>
          <InfoTip label="Очереди на АЗС" text={TIP} />
        </span>
      }
      right={<GranControl gran={gran} onGran={setGran} dayEnd={dayEnd} onDayEnd={setDayEnd} dayMin={dayMin} dayMax={dayMax} />}
      className={`h-full transition-shadow duration-300 ${glow ?? ""}`}
      bodyClassName="flex flex-1 flex-col pt-0 pb-2.5"
    >
      {hasData ? (
        <div ref={wheelRef} className="relative min-h-0 flex-1">
          <ChartBox type="line" options={options} series={series as ApexAxisChartSeries} className="h-full min-h-[280px] lg:min-h-0" />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-center text-foreground text-sm">{emptyText}</div>
      )}
    </Panel>
  );
}
