"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

/**
 * Адаптивная обёртка ApexCharts. Меряет доступное место через ResizeObserver и
 * передаёт высоту в px (ApexCharts надёжно рисует по px, а не по %).
 *
 * Ключевой момент против «график уезжает в бесконечность»: измеряющий слой
 * `absolute inset-0` — он вынут из потока и повторяет размер РОДИТЕЛЯ (flex-слота),
 * а не содержимого. Поэтому график НЕ может растянуть контейнер и не возникает
 * обратной петли (grow → measure bigger → grow) ни при какой раскладке.
 */
export function ChartBox({
  type,
  options,
  series,
  className,
}: {
  type: "line" | "area" | "bar" | "scatter" | "radialBar" | "donut";
  options: ApexOptions;
  // line/area/bar -> ApexAxisChartSeries; radialBar/donut -> number[]
  series: ApexAxisChartSeries | ApexNonAxisChartSeries;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ h: 0, w: 0 });
  const sizedOptions = useMemo(() => ({
    ...options,
    chart: { ...options.chart, height: size.h, width: size.w },
  }), [options, size.h, size.w]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const h = Math.round(el.clientHeight);
      const w = Math.round(el.clientWidth);
      if (h > 0 && w > 0) setSize((s) => (s.h === h && s.w === w ? s : { h, w }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    measure();
    let nestedFrame = 0;
    const frame = requestAnimationFrame(() => { nestedFrame = requestAnimationFrame(measure); });
    const timers = [100, 300, 700, 1400].map((delay) => window.setTimeout(measure, delay));
    const settleInterval = window.setInterval(measure, 250);
    const settleTimer = window.setTimeout(() => window.clearInterval(settleInterval), 5000);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(nestedFrame);
      timers.forEach(window.clearTimeout);
      window.clearInterval(settleInterval);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const positionTooltip = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const canvas = event.target.closest<HTMLElement>(".apexcharts-canvas");
      if (!canvas || !el.contains(canvas)) return;

      const { clientX, clientY } = event;
      requestAnimationFrame(() => {
        const tooltip = canvas.querySelector<HTMLElement>(".apexcharts-tooltip.apexcharts-active");
        if (!tooltip) return;

        const bounds = canvas.getBoundingClientRect();
        const panel = canvas.closest<HTMLElement>(".waste-dashboard-panel");
        const panelBounds = panel?.getBoundingClientRect();
        const scaleX = bounds.width / Math.max(canvas.offsetWidth, 1);
        const scaleY = bounds.height / Math.max(canvas.offsetHeight, 1);
        const leftEdge = panelBounds ? (panelBounds.left - bounds.left) / scaleX + 12 : 12;
        const rightEdge = panelBounds ? (panelBounds.right - bounds.left) / scaleX - 12 : canvas.offsetWidth - 12;
        const topEdge = panelBounds ? (panelBounds.top - bounds.top) / scaleY + 12 : 12;
        const bottomEdge = panelBounds ? (panelBounds.bottom - bounds.top) / scaleY - 12 : canvas.offsetHeight - 12;
        const cursorX = (clientX - bounds.left) / scaleX;
        const cursorY = (clientY - bounds.top) / scaleY;
        const gap = 12;
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        const axisChart = type === "line" || type === "area" || type === "bar" || type === "scatter";

        let x = cursorX + gap;
        let y = axisChart ? cursorY - tooltipHeight - gap : cursorY + gap;
        if (x + tooltipWidth > rightEdge) x = cursorX - tooltipWidth - gap;
        if (axisChart && y < topEdge) y = cursorY + gap;
        if (!axisChart && y + tooltipHeight > bottomEdge) y = cursorY - tooltipHeight - gap;

        const maxX = Math.max(leftEdge, rightEdge - tooltipWidth);
        const maxY = Math.max(topEdge, bottomEdge - tooltipHeight);
        canvas.style.setProperty("--chart-tooltip-x", `${Math.max(leftEdge, Math.min(x, maxX))}px`);
        canvas.style.setProperty("--chart-tooltip-y", `${Math.max(topEdge, Math.min(y, maxY))}px`);
      });
    };

    el.addEventListener("mousemove", positionTooltip, true);
    return () => el.removeEventListener("mousemove", positionTooltip, true);
  }, [size.h, size.w, type]);

  return (
    <div ref={ref} data-chart-type={type} className={`relative w-full flex-1 overflow-visible ${className ?? "min-h-0"}`}>
      <div className="absolute inset-0">
        {size.h > 0 && size.w > 0 && (
          // Явная ширина в px (layout из ResizeObserver, не transformed). Иначе
          // ApexCharts при width="100%" читает getBoundingClientRect и под
          // transform: scale берёт увеличенную ширину → график вылезает вправо.
          <ReactApexChart
            key={`${type}-${size.w}-${size.h}`}
            type={type}
            height={size.h}
            width={size.w}
            options={sizedOptions}
            series={series}
          />
        )}
      </div>
    </div>
  );
}
