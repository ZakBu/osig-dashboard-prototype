"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { InfoTip } from "./InfoTip";
export const PANEL = "rounded-[8px] border-[#182235] bg-[#03060c] before:hidden";
export const PANEL_HEADER = "waste-panel-header";
export function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[#69758a]">—</span>;
  const positive = value > 0;
  const neutral = value === 0;
  return <span className={neutral ? "text-[#8994a7]" : positive ? "text-[#43be6b]" : "text-[#df1741]"}>{positive ? "+" : ""}{value.toFixed(1).replace(".", ",")}%</span>;
}

export function PanelHeading({ title, subtitle, updated, tip }: { title: string; subtitle?: string; updated: string; tip: string }) {
  const longTitle = title.length > 24;
  return (
    <div className="waste-panel-heading min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`waste-panel-heading__title truncate ${longTitle ? "waste-panel-heading__title--long" : ""}`}>{title}</span>
        {subtitle && <span className="waste-panel-heading__subtitle hidden shrink-0 3xl:inline">({subtitle})</span>}
        <InfoTip label={title} text={tip} />
      </div>
      {updated && <div className="waste-panel-heading__updated"><span aria-hidden="true" />Обновлено {updated}</div>}
    </div>
  );
}

type RingHover = { index: number; x: number; y: number; cursorX: number; cursorY: number };
export function useRingTooltip() {
  const frameRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<RingHover | null>(null);

  const placeTooltip = useCallback((index: number, clientX: number, clientY: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    const scaleX = bounds.width / Math.max(frame.offsetWidth, 1);
    const scaleY = bounds.height / Math.max(frame.offsetHeight, 1);
    const cursorX = (clientX - bounds.left) / scaleX;
    const cursorY = (clientY - bounds.top) / scaleY;
    const width = tooltipRef.current?.offsetWidth ?? Math.min(300, frame.offsetWidth - 24);
    const height = tooltipRef.current?.offsetHeight ?? 136;
    const inset = 12;
    const gap = 14;
    let x = cursorX + gap;
    let y = cursorY - height - gap;

    if (x + width > frame.offsetWidth - inset) x = cursorX - width - gap;
    if (y < inset) y = cursorY + gap;
    if (y + height > frame.offsetHeight - inset) y = cursorY - height - gap;

    setHovered({
      index,
      cursorX,
      cursorY,
      x: Math.max(inset, Math.min(x, Math.max(inset, frame.offsetWidth - width - inset))),
      y: Math.max(inset, Math.min(y, Math.max(inset, frame.offsetHeight - height - inset))),
    });
  }, []);

  useLayoutEffect(() => {
    if (!hovered || !tooltipRef.current || !frameRef.current) return;
    const frame = frameRef.current;
    const tooltip = tooltipRef.current;
    const inset = 12;
    const gap = 14;
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    let x = hovered.cursorX + gap;
    let y = hovered.cursorY - height - gap;

    if (x + width > frame.offsetWidth - inset) x = hovered.cursorX - width - gap;
    if (y < inset) y = hovered.cursorY + gap;
    if (y + height > frame.offsetHeight - inset) y = hovered.cursorY - height - gap;

    const next = {
      ...hovered,
      x: Math.max(inset, Math.min(x, Math.max(inset, frame.offsetWidth - width - inset))),
      y: Math.max(inset, Math.min(y, Math.max(inset, frame.offsetHeight - height - inset))),
    };
    if (Math.abs(next.x - hovered.x) > 0.5 || Math.abs(next.y - hovered.y) > 0.5) setHovered(next);
  }, [hovered]);

  return {
    frameRef,
    tooltipRef,
    hovered,
    moveTooltip: placeTooltip,
    clearTooltip: () => setHovered(null),
  };
}

