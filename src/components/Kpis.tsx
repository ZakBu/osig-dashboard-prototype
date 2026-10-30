"use client";

import type { ReactNode } from "react";
import { Fuel } from "lucide-react";
import { Card } from "@coss/ui/components/card";
import type { NetSummary } from "@/lib/types";
import type { StationType } from "@/lib/netType";
import { fmtInt, fmtPct1 } from "@/lib/format";
import { InfoTip } from "./InfoTip";
import { NetBadge } from "./NetBadge";
import { OilBarrel } from "./icons";
import { NET_LOGOS } from "./netLogos";
import {
  KpiBadgeTotal, KpiBadgeAvailable, KpiBadgeNoFuel, KpiBadgeClosed,
} from "./KpiBadge";

/** Единая компактная KPI-карточка: заголовок (в цвет) + число + иконка справа. */
function KpiCard({
  label, value, pct, badge, logo, iconNode, tip,
}: {
  label: string;
  value: string;
  pct?: string;
  /** векторный бейдж-«донат» метрики (по умолчанию). */
  badge: ReactNode;
  /** имя сети → единый лого-бейдж (вместо метрической иконки), при фильтре по компании. */
  logo?: string;
  /** произвольная иконка (Прочие/ВИНК) — приоритетнее logo и метрического бейджа. */
  iconNode?: ReactNode;
  tip: string;
}) {
  return (
    <Card className="flex-1 justify-center py-3 pr-1.5 pl-3.5">
      {/* Подпись — отдельной строкой на всю ширину (в одну строку, не переносится). */}
      <div className="flex items-center gap-1.5">
        <span className="whitespace-nowrap font-medium text-[20px] text-foreground leading-tight">{label}</span>
        <InfoTip label={label} text={tip} />
      </div>
      {/* Ниже — крупное число (+ доля) слева и 3D-иконка справа.
          min-w-0 + shrink на левом блоке, чтобы число никогда не выталкивало иконку —
          все 4 иконки строго выравнены по правому краю (друг под другом). */}
      <div className="mt-2 flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 shrink items-baseline gap-1">
          <span className="font-normal text-[49px] text-foreground leading-none tracking-tight">{value}</span>
          {pct && (
            <>
              <span aria-hidden className="h-5 w-px shrink-0 bg-foreground/25" />
              <span className="font-medium text-[17px] lg:text-[23px] text-foreground leading-none tabular-nums">{pct}</span>
            </>
          )}
        </div>
        {/* Слот фикс. ширины (макс. размер иконки): меньшие иконки центрируются в нём,
            поэтому центры ВСЕХ иконок строго на одной вертикали. */}
        <div className="flex shrink-0 items-center justify-center" style={{ width: 76, height: 76 }}>
          {iconNode ? iconNode : logo ? <NetBadge name={logo} className="size-[66px]" colored /> : badge}
        </div>
      </div>
    </Card>
  );
}

export function KpiIndex({ s, net, type }: { s: NetSummary; net?: string | null; type?: StationType }) {
  // Прочие → канистра/колонка, ВИНК → бочка (обе белые). Приоритетнее лого сети.
  const iconNode =
    !net && type === "other" ? <Fuel className="size-[58px] text-white" strokeWidth={1.5} /> :
    !net && type === "vink" ? <OilBarrel className="size-[66px] text-white" /> :
    undefined;
  return (
    <KpiCard
      label="Всего заправок"
      value={fmtInt(s.total)}
      badge={<KpiBadgeTotal />}
      logo={net && NET_LOGOS[net] ? net : undefined}
      iconNode={iconNode}
      tip="Общее количество автозаправочных станций (АЗС) на территории города Москвы, осуществляющих продажу бензина или дизельного топлива"
    />
  );
}

// Доля от общего числа АЗС (пустая строка, если делить не на что).
const share = (n: number, total: number) => (total > 0 ? fmtPct1((n / total) * 100) : undefined);
// Числовая доля 0..100 для заполнения кольца бейджа (0, если делить не на что).
const shareNum = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);

export function KpiAvailable({ s }: { s: NetSummary }) {
  return (
    <KpiCard
      label="Доступно для заправки"
      value={fmtInt(s.open)}
      pct={share(s.open, s.total)}
      badge={<KpiBadgeAvailable value={shareNum(s.open, s.total)} />}
      tip="Количество АЗС Москвы, открытых и обеспеченных бензином или дизелем для продажи"
    />
  );
}

export function KpiClosed({ s }: { s: NetSummary }) {
  return (
    <>
      <KpiCard
        label="Закрыто, нет топлива"
        value={fmtInt(s.no_fuel)}
        pct={share(s.no_fuel, s.total)}
        badge={<KpiBadgeNoFuel value={shareNum(s.no_fuel, s.total)} />}
        tip="Количество АЗС Москвы, временно закрытых по причине отсутствия топлива: как бензина, так и дизельного топлива"
      />
      <KpiCard
        label="Закрыто постоянно"
        value={fmtInt(s.closed_other)}
        pct={share(s.closed_other, s.total)}
        badge={<KpiBadgeClosed value={shareNum(s.closed_other, s.total)} />}
        tip="Количество АЗС Москвы, закрытых по причинам: закрыта на ремонт, в рамках КРТ или из-за нерентабельности"
      />
    </>
  );
}
