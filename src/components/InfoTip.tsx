"use client";

import { Popover } from "@base-ui/react/popover";
import type { ReactNode } from "react";

/** Разбор текста подсказки: абзацы + список «• …» с ровным выравниванием маркеров. */
function TipBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }
    if (line.trimStart().startsWith("•")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("•")) {
        items.push(lines[i].trim().replace(/^•\s*/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="mt-2.5 space-y-1.5">
          {items.map((item) => (
            <li key={item} className="grid grid-cols-[1rem_1fr] gap-x-2 text-[16px] leading-snug text-foreground">
              <span aria-hidden className="text-right text-foreground/80">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    // Заголовок секции вроде «Виды топлива:» — чуть плотнее, без серого.
    const isSection = /:\s*$/.test(line.trim());
    blocks.push(
      <p
        key={`p-${blocks.length}`}
        className={`${blocks.length ? "mt-2.5" : ""} ${isSection ? "font-semibold text-foreground" : "text-foreground"} text-[16px] leading-relaxed`}
      >
        {line.trim()}
      </p>,
    );
    i += 1;
  }
  return <div>{blocks}</div>;
}

/**
 * Иконка-«!» со справкой по показателю/блоку.
 * Открывается по клику (работает на тач/в iframe), через портал → не обрезается overflow.
 * Текст подсказки — белый/foreground (не muted), списки • выровнены по маркеру.
 */
export function InfoTip({ label, text, popupClassName }: { label?: string; text: string; popupClassName?: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <button
            type="button"
            aria-label={label ? `Справка: ${label}` : "Справка"}
            className="flex size-[15px] shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 font-semibold text-[13px] text-muted-foreground leading-none transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[popup-open]:border-foreground data-[popup-open]:text-foreground"
          >
            !
          </button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner side="top" align="center" sideOffset={8} className="z-[120]">
          <Popover.Popup className={`${popupClassName ?? "max-w-[340px]"} origin-[var(--transform-origin)] rounded-xl border border-border bg-popover px-3.5 py-3 text-[17px] text-foreground leading-snug shadow-xl outline-none`}>
            {label && <Popover.Title className="mb-2 font-semibold text-[14px] text-foreground">{label}</Popover.Title>}
            <TipBody text={text} />
            <Popover.Arrow className="text-border" />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
