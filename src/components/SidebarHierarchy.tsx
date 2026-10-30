"use client";

import type { NetSummary, NozGroups } from "@/lib/types";
import type { StationType } from "@/lib/netType";
import { fmtInt } from "@/lib/format";
import { KpiBadgeTotal } from "./KpiBadge";
import { NetBadge } from "./NetBadge";
import { NET_LOGOS } from "./netLogos";
import { ArrowUpRight } from "lucide-react";
import { DOT, CARD, Block, Branch, Link } from "./HierarchyKit";

/**
 * Блочная панель «АЗС Москвы» — каждый узел = карточка с рамкой, между ними — пунктирные
 * связи (рельс слева + точка к блоку). Формулировки 1:1 с презентацией мэрии.
 *
 * ЕДИНАЯ ТИПО-СИСТЕМА (крупно, читаемо, всё влезает в высоту сайдбара):
 *  • карточка: CARD + паддинг px-4 py-2.5 (вложенная — px-2.5 py-2.5);
 *  • подпись блока: 15px semibold; вложенная: 13px semibold (в одну строку);
 *  • крупное число: 28px bold (заголовок «Всего» — 30px; вложенное — 24px);
 *  • доля %: 18px semibold, по правому краю (числа блоков в столбик);
 *  • подпись-описание: 12px, foreground/70; точка-маркер size-2.5; радиусы rounded-xl/rounded-lg.
 */

/** Единый порядок и цвета чипов: ДТ → АИ-92 → АИ-95 → АИ-100. */
const FUEL_CHIPS: { key: keyof NozGroups; label: string; color: string }[] = [
  { key: "gdt", label: "ДТ", color: "#a855f7" },
  { key: "g92", label: "АИ-92", color: "#14b8a6" },
  { key: "g95", label: "АИ-95", color: "#ef4444" },
  { key: "g100", label: "АИ-100", color: "#f59e0b" },
];

/** Вложенная карточка «Полностью | Частично» — число прямо из матвью 27166
 *  (count_full_fuel / count_partly_fuel); нет данных → «Н/Д».
 *  Пояснение к показателю вынесено в ⓘ (справка по клику) → карточки компактные,
 *  весь «Свод» помещается на один экран без скролла.
 *  onClick → открывает попап-дриллдаун по комбинациям видов топлива. */
function MiniBlock({ dot, label, value, pct, onClick }: { dot: string; label: string; value: number | null; pct?: string; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-start gap-1.5 pr-5 text-[16px] font-semibold leading-tight text-foreground">
        <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: dot }} />
        <span>{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2 tabular-nums">
        <span className="text-[27px] font-bold leading-none text-foreground">{value == null ? "Н/Д" : fmtInt(value)}</span>
        {pct && <span className="text-[20px] font-semibold leading-none text-foreground/90">{pct}</span>}
      </div>
    </>
  );
  // Контент по центру карточки + увеличенный зазор подпись→число (mt-3), чтобы значения
  // не прилипали к подписи и сидели чуть ниже; высоту карточки задаёт флекс (h-full).
  const base = `flex h-full w-full flex-col justify-center ${CARD} px-2.5 py-2 text-left`;
  return (
    <div className="group relative w-full">
      {onClick ? (
        <button type="button" onClick={onClick} className={`${base} cursor-pointer transition-colors hover:border-white/25 hover:bg-muted/40`}>{body}</button>
      ) : (
        <div className={base}>{body}</div>
      )}
      {/* Значок «перейти/открыть» (↗) — карточка кликабельна, открывает попап-дриллдаун.
          pointer-events-none → клик проходит на кнопку под ним (открывает попап). */}
      {onClick && (
        <span aria-hidden className="pointer-events-none absolute right-2 top-2.5 z-10 inline-flex size-6 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-foreground/55 transition-colors group-hover:border-white/25 group-hover:text-foreground">
          <ArrowUpRight className="size-3.5" />
        </span>
      )}
    </div>
  );
}

/** Разбивка «Закрывались за сутки» по длительности — кумулятивные счётчики «минимум N ч»
 *  прямо из матвью 27166 (count_closed_azs_3h/6h/9h/12h); null = «Н/Д». */
function DurationBreakdown({ b3, b6, b9, b12 }: { b3: number | null; b6: number | null; b9: number | null; b12: number | null }) {
  const buckets: { label: string; value: number | null }[] = [
    { label: "от 3 ч", value: b3 }, { label: "от 6 ч", value: b6 },
    { label: "от 9 ч", value: b9 }, { label: "от 12 ч", value: b12 },
  ];
  return (
    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
      {buckets.map(({ label, value }) => (
        <div key={label} className="rounded-lg border border-border/60 bg-background/40 px-1 py-1.5 text-center text-foreground">
          <div className="text-[14px] font-medium leading-none text-foreground/70">{label}</div>
          <div className="mt-1 text-[16px] font-bold leading-none tabular-nums">{value == null ? "Н/Д" : fmtInt(value)}</div>
        </div>
      ))}
    </div>
  );
}

/** Чипы «количество заправочных пистолетов (шт.)» — ДТ → 92 → 95 → 100; две строки при нехватке ширины. */
function PistolTotals({ guns }: { guns: NozGroups | null }) {
  return (
    <div>
      <div className="text-[15px] leading-snug text-foreground/70">количество заправочных пистолетов (шт.)</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {FUEL_CHIPS.map(({ key, label, color }) => (
          <span key={label} className="inline-flex items-baseline gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-white" style={{ background: color }}>
            <b className="text-[15px] font-bold tabular-nums leading-none">{guns ? fmtInt(guns[key]) : "Н/Д"}</b>
            <span className="text-[10px] font-medium leading-none opacity-90">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SidebarHierarchy({
  s, net, type, onDrill,
}: {
  s: NetSummary;
  net?: string | null;
  type?: StationType;
  /** клик по «Полностью/Частично доступны» → открыть попап-дриллдаун по комбинациям видов. */
  onDrill?: (mode: "full" | "partial") => void;
}) {
  // Всё — прямо из матвью 27166, доли тоже из матвью (не считаем):
  const rabotaet = s.open;                 // count_open_azs
  const profil = s.closed_other;           // count_closed_azs
  const dostupny = s.availAllday;          // count_available_allday_azs — доступны для заправки ВЕСЬ день
  const zakryvalis = s.nonAvailAllday;     // count_non_available_allday_azs — НЕ доступны весь день (закрывались)
  // Доли — только из витрины 27166 (share_*), сами не делим:
  const shareWithFuel = s.shareAvailAllday;    // share_available_allday_azs
  const shareNonAvail = s.shareNonAvailAllday; // share_non_available_allday_azs
  // share_full / share_partly в витрине нет → «—», не считаем open_full/open
  const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1).replace(".", ",")}%`);
  const hasFuelDetail = s.total > 0;

  return (
    <div className="flex flex-1 flex-col gap-1.5">
      {/* Всего — заголовок: число + логотип, ниже чипы пистолетов. Единый паддинг/типографика. */}
      <div className={`flex flex-[0.7] flex-col justify-center gap-1.5 ${CARD} px-4 py-2`}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[18px] font-semibold text-foreground">Всего заправок</span>
          <span className="flex shrink-0 items-center gap-2.5">
            <span className="text-[34px] font-bold leading-none tracking-tight text-foreground tabular-nums">{fmtInt(s.total)}</span>
            {net && NET_LOGOS[net] ? <NetBadge name={net} className="size-[38px]" colored /> : <KpiBadgeTotal size={38} />}
          </span>
        </div>
        <PistolTotals guns={s.guns} />
      </div>

      {/* Работает + дети — одна ветка (как камеры): у каждого узла точка и тик через центр блока. */}
      {hasFuelDetail ? (
        <Branch grow="flex-[3.8]">
          <Link color={DOT.green} railDown className="relative z-10 shrink-0">
            <Block label="Работает" value={rabotaet} pct={pct(s.shareOpen)} />
          </Link>
          {/* Доступны для заправки ВЕСЬ день (count_available_allday_azs), доля от всех АЗС */}
          <Link color={DOT.green} railDown className="flex flex-1 flex-col">
            <Block label={"Доступны для заправки в течении всего дня"} labelClassName="text-[17px]" value={dostupny} pct={pct(shareWithFuel)} />
            {/* дети «Доступны» — раскладки по видам в матвью нет → Н/Д */}
            <div className="mt-1.5 grid flex-1 grid-cols-2 gap-2">
              <MiniBlock dot={DOT.green} label="Полностью доступны" value={s.open_full} onClick={onDrill ? () => onDrill("full") : undefined} />
              <MiniBlock dot={DOT.amber} label="Частично доступны" value={s.open_partial} onClick={onDrill ? () => onDrill("partial") : undefined} />
            </div>
          </Link>
          {/* Закрывались в течение дня (count_non_available_allday_azs), доля от всех АЗС; разбивка Н/Д */}
          <Link color={DOT.slate} className="flex shrink-0 flex-col">
            <Block label="Закрывались в течение дня" value={zakryvalis} pct={pct(shareNonAvail)}>
              <DurationBreakdown b3={s.closed3h} b6={s.closed6h} b9={s.closed9h} b12={s.closed12h} />
            </Block>
          </Link>
        </Branch>
      ) : (
        <Block className="relative z-10 flex-[0.5]" dot={DOT.green}
          label="Работает" value={rabotaet} pct={pct(s.shareOpen)} />
      )}

      {/* Закрыто (count_closed_azs), доля = share_closed_azs. */}
      <Block className="flex-[0.7]" dot={DOT.red}
        label="Закрыто"
        caption="на профилактические работы и технологическое переоснащение"
        value={profil} pct={pct(s.shareClosed)} />
    </div>
  );
}
