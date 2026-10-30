"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { fmtInt } from "@/lib/format";

/**
 * Примитивы блочно-иерархической панели (как «АЗС Москвы»): карточки-узлы с рамкой,
 * между ними — пунктирные связи (рельс слева + точка к блоку). Переиспользуются в
 * `SidebarHierarchy` (свод по АЗС) и `CameraHierarchy` (покрытие камерами).
 *
 * ЕДИНАЯ ТИПО-СИСТЕМА: карточка CARD + px-4 py-2; подпись 18px semibold (можно переопределить
 * labelClassName); крупное число 32px bold справа; доля % 20px semibold правее; точка-маркер 2.5.
 */
export const DOT = {
  green: "#22c55e", amber: "#f59e0b", slate: "#94a3b8", red: "#ef4444",
  teal: "#14b8a6", emerald: "#10b981", purple: "#a855f7",
} as const;
export const RAIL = "border-white/40";
export const CARD = "rounded-xl border border-border/70 bg-muted/20";

/** Карточка-узел: слева подпись (+ точка), справа крупное число и доля (в единой сетке). */
export function Block({
  dot, label, value, pct, caption, children, className, na, labelClassName,
}: {
  dot?: string; label: string; value: number; pct: string; caption?: string;
  children?: ReactNode; className?: string; na?: boolean; labelClassName?: string;
}) {
  return (
    <div className={`flex flex-col justify-center ${CARD} px-4 py-2 ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`flex min-w-0 items-start gap-2 ${labelClassName ?? "text-[18px]"} font-semibold leading-tight text-foreground`}>
          {dot && <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: dot }} />}
          <span className="min-w-0">{label}</span>
        </span>
        <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
          <span className="min-w-[54px] text-right text-[32px] font-bold leading-none text-foreground">{na ? "Н/Д" : fmtInt(value)}</span>
          <span className="min-w-[50px] text-right text-[20px] font-semibold leading-none text-foreground/90">{na ? "" : pct}</span>
        </span>
      </div>
      {caption && <div className="mt-1 text-[15px] leading-snug text-foreground/70">{caption}</div>}
      {children}
    </div>
  );
}

/** Ветка: непрерывный пунктир от центра первого узла до центра последнего. */
export function Branch({ children, grow }: { children: ReactNode; grow?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rail, setRail] = useState<{ top: number; bottom: number } | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const anchors = root.querySelectorAll<HTMLElement>("[data-hierarchy-anchor]");
      if (anchors.length === 0) { setRail(null); return; }
      const rootBox = root.getBoundingClientRect();
      const first = anchors[0].getBoundingClientRect();
      const last = anchors[anchors.length - 1].getBoundingClientRect();
      const top = first.top + first.height / 2 - rootBox.top;
      const bottom = rootBox.bottom - (last.top + last.height / 2);
      setRail({ top, bottom });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.querySelectorAll<HTMLElement>("[data-hierarchy-anchor]").forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={ref} className={`relative ml-0 flex flex-col gap-2 pl-3 ${grow ?? ""}`}>
      {rail && (
        <span
          aria-hidden
          className={`pointer-events-none absolute left-0 border-l border-dashed ${RAIL}`}
          style={{ top: rail.top, bottom: rail.bottom }}
        />
      )}
      {children}
    </div>
  );
}

/**
 * Узел ветки: тик + цветная точка строго в вертикальном центре первой карточки
 * (data-hierarchy-anchor). railUp/railDown оставлены для API-совместимости — вертикаль
 * рисует Branch.
 */
export function Link({ color, className, children, railUp: _railUp, railDown: _railDown }: {
  color: string; className?: string; children: ReactNode; railUp?: boolean; railDown?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [cy, setCy] = useState<number | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const anchor = root.querySelector<HTMLElement>("[data-hierarchy-anchor]");
      if (!anchor) return;
      setCy(anchor.offsetTop + anchor.offsetHeight / 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    const anchor = root.querySelector<HTMLElement>("[data-hierarchy-anchor]");
    if (anchor) ro.observe(anchor);
    return () => ro.disconnect();
  }, [children]);

  // Первый ребёнок = карточка-якорь (центр точки); остальное (мини-блоки) ниже без якоря.
  const childList = Array.isArray(children) ? children : [children];
  const [head, ...tail] = childList;

  return (
    <div ref={rootRef} data-hierarchy-link className={`relative ${className ?? ""}`}>
      {cy != null && (
        <>
          <span
            aria-hidden
            className={`pointer-events-none absolute left-[-12px] w-[10px] border-t border-dashed ${RAIL}`}
            style={{ top: cy }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-[-12px] z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
            style={{ top: cy, background: color }}
          />
        </>
      )}
      <div data-hierarchy-anchor className="min-w-0">{head}</div>
      {tail}
    </div>
  );
}
