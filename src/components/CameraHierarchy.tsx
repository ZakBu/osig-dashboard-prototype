"use client";

import { Lightbulb } from "lucide-react";
import type { CameraGroupRow } from "@/lib/types";
import { Block, Branch, Link } from "./HierarchyKit";

/**
 * Блок «АЗС, обеспеченные камерами» в стиле панели «АЗС Москвы» — плотная иерархия карточек
 * (примитивы HierarchyKit, паддинги как у свода). Сверху — компактное кольцо-герой «все виды»
 * (Apple-анимация прорисовки дуг), под ним блок-голова «Камеры всех видов» и пунктирная ветка
 * по видам камер, ниже — «Не обеспечены». Показатель (число + доля) справа. Типы ПЕРЕСЕКАЮТСЯ.
 */

// Камерная палитра (как в кольцах/легенде): all-amber / obzor-teal / setup-emerald / grz-purple.
const CAM = { all: "#f59e0b", obzor: "#14b8a6", setup: "#10b981", grz: "#a855f7" } as const;

/** Компактное кольцо-герой: 4 концентрические дуги, широкий центр — % покрытия + «{azsAll} из {total}»
 *  влезают С ЗАПАСОМ (тонкие кольца → большая «дырка»). Дуги «прорисовываются» по кругу от 12ч. */
function CoverageRings({ items, azsAll, totalAzs, noneVal, nonePct }: {
  items: { color: string; pct: number }[]; azsAll: number; totalAzs: number;
  noneVal: number; nonePct: string;
}) {
  const cx = 120, cy = 120;
  const stroke = 16, gap = 2, R0 = 111;
  const fmtN = (n: number) => n.toLocaleString("ru-RU");
  // %/число «обеспечены» — от ЕДИНОГО знаменателя total (как дуги и «не обеспечены»), чтобы сумма
  // с «не обеспечены» = 100% и текст совпадал с заливкой (не полагаемся на coverShare витрины).
  const azsShown = Math.min(azsAll, totalAzs);
  const pctTxt = totalAzs > 0 ? `${Math.min(100, (azsShown / totalAzs) * 100).toFixed(1).replace(".", ",")}%` : "Н/Д";
  // Якорь выноски — середина ТЁМНОГО (незакрытого) участка внешнего кольца «все виды».
  const allPct = Math.max(0, Math.min(100, items[0]?.pct ?? 0));
  const gapMidDeg = ((allPct / 100) * 360 + 360) / 2;
  const rad = (gapMidDeg * Math.PI) / 180;
  const ax = cx + R0 * Math.sin(rad);
  const ay = cy - R0 * Math.cos(rad);
  const showCallout = noneVal > 0 && allPct < 99.5;
  // Якорь второй выноски «все виды» — ЖЁЛТЫЙ (закрытый) участок внешнего кольца, слева-снизу.
  const coverEnd = (allPct / 100) * 360;
  const amberDeg = Math.min(232, coverEnd - 12);
  const bRad = (amberDeg * Math.PI) / 180;
  const bx = cx + R0 * Math.sin(bRad);
  const by = cy - R0 * Math.cos(bRad);
  const showAll = allPct > 0.5;
  return (
    // viewBox расширен влево и вверх — там подпись-выноска «не обеспечены».
    <svg viewBox="-198 -26 438 268" className="w-full max-w-[350px]" preserveAspectRatio="xMidYMid meet">
      <style>{`
        @keyframes coverGrow { from { stroke-dashoffset: var(--dash); } to { stroke-dashoffset: 0; } }
        .cover-arc { animation: coverGrow 1.15s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) { .cover-arc { animation: none; } }
      `}</style>
      {items.map((it, i) => {
        const r = R0 - i * (stroke + gap);
        const circ = 2 * Math.PI * r;
        const p = Math.max(0, Math.min(1, it.pct / 100));
        const len = p * circ;
        return (
          <g key={i} transform={`rotate(-90 ${cx} ${cy})`}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={it.color} strokeOpacity={0.15} strokeWidth={stroke} />
            {p > 0.005 && (
              <circle
                className="cover-arc"
                cx={cx} cy={cy} r={r} fill="none" stroke={it.color} strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={`${len} ${circ}`}
                style={{ ["--dash" as string]: `${len}`, animationDelay: `${i * 0.12}s` }}
              />
            )}
          </g>
        );
      })}
      {/* Только «{azsAll}» над «из {totalAzs}» — двумя строками, белым, крупно (без %). */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#ffffff" fontSize="40" fontWeight="700" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtN(azsShown)}</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="#ffffff" fontSize="21" fontWeight="600" style={{ fontVariantNumeric: "tabular-nums" }}>из {fmtN(totalAzs)}</text>

      {/* Выноска «Не обеспечены камерами» — от тёмного участка внешнего кольца, влево. */}
      {showCallout && (
        <g>
          <polyline points={`${ax},${ay} ${ax - 42},${ay - 10} -18,${ay - 10}`} fill="none" stroke="#ef4444" strokeWidth="1.6" strokeDasharray="3 3" />
          <circle cx={ax} cy={ay} r={4.5} fill="#ef4444" />
          <text x={-22} y={ay - 30} textAnchor="end" fontSize="21" fontWeight="600" fill="#e5e7eb">Не обеспечены</text>
          <text x={-22} y={ay - 7} textAnchor="end" fontSize="21" fontWeight="600" fill="#e5e7eb">камерами</text>
          <text x={-22} y={ay + 28} textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>
            <tspan fontSize="38" fontWeight="700" fill="#ffffff">{fmtN(noneVal)}</tspan>
            <tspan dx="6" fontSize="24" fontWeight="600" fill="#ffffff" fillOpacity="0.85">{nonePct}</tspan>
          </text>
        </g>
      )}

      {/* Выноска «Камеры всех видов» — от ЖЁЛТОГО (закрытого) участка внешнего кольца, влево-вниз. */}
      {showAll && (
        <g>
          <polyline points={`${bx},${by} ${bx - 30},${by - 4} -18,${by - 4}`} fill="none" stroke="#ef4444" strokeWidth="1.6" strokeDasharray="3 3" />
          <circle cx={bx} cy={by} r={4.5} fill="#ef4444" />
          <text x={-22} y={by - 30} textAnchor="end" fontSize="21" fontWeight="600" fill="#e5e7eb">Обеспечены</text>
          <text x={-22} y={by - 7} textAnchor="end" fontSize="21" fontWeight="600" fill="#e5e7eb">камерами</text>
          <text x={-22} y={by + 28} textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>
            <tspan fontSize="38" fontWeight="700" fill="#ffffff">{fmtN(azsShown)}</tspan>
            <tspan dx="6" fontSize="24" fontWeight="600" fill="#ffffff" fillOpacity="0.85">{pctTxt}</tspan>
          </text>
        </g>
      )}
    </svg>
  );
}

export function CameraHierarchy({ c, total: totalProp }: { c: CameraGroupRow; total?: number }) {
  // Знаменатель итогового кол-ва АЗС и долей — count_all_azs из витрины 27166 (реестр АЗС),
  // как на «Своде» (682 всего). Если проп не передан — totalAzs камерной витрины (тоже миррорит 27166).
  const total = totalProp ?? c.totalAzs;
  const share = (v: number) => (total > 0 ? `${Math.min(100, (v / total) * 100).toFixed(1).replace(".", ",")}%` : "—");
  const pctOf = (v: number) => (total > 0 ? Math.min(100, (v / total) * 100) : 0);
  const none = Math.max(0, total - c.azsAll);
  const ringItems = [
    { color: CAM.all, pct: pctOf(c.azsAll) },
    { color: CAM.obzor, pct: pctOf(c.azsObzor) },
    { color: CAM.setup, pct: pctOf(c.azsSetup) },
    { color: CAM.grz, pct: pctOf(c.azsGrz) },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Кольцо-герой «все виды» + 2 выноски (не обеспечены / все виды) — вплотную к заголовку. */}
      <div className="flex shrink-0 items-center justify-center pt-1">
        <CoverageRings key={`${c.azsAll}-${total}`} items={ringItems} azsAll={c.azsAll} totalAzs={total} noneVal={none} nonePct={share(none)} />
      </div>

      {/* Пояснение к «Обеспечены камерами» — нейтральный блок с лампочкой (как было), под кольцом.
          Хвостик-«облачко» вверх → указывает на блок «Обеспечены камерами», видно, к чему подсказка. */}
      <div className="relative mt-0.5 shrink-0">
        <div aria-hidden className="absolute -top-2 left-9 size-0 border-x-[7px] border-b-[8px] border-x-transparent border-b-white/[0.06]" />
        <div className="flex items-start gap-2.5 rounded-lg bg-white/[0.05] px-3.5 py-3 text-[14px] leading-snug text-white">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-foreground/70" />
          <span>Количество АЗС, расположенных в зоне видимости хотя бы одной камеры видеонаблюдения: обзорные камеры, камеры, наведенные на АЗС, камеры распознавания государственных регистрационных знаков (ГРЗ).</span>
        </div>
      </div>

      {/* Разбивка по видам камер (пересекаются). «Обеспечены камерами» и «Не обеспечены» — выносками от кольца. */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <Branch>
          <Link color={CAM.obzor} railDown className="flex flex-col">
            <Block label="Обеспечено обзорными камерами" labelClassName="text-[15px]" value={c.azsObzor} pct={share(c.azsObzor)} />
          </Link>
          <Link color={CAM.setup} railDown className="flex flex-col">
            <Block label="Обеспечено камерами, наведенными на АЗС" labelClassName="text-[15px]" value={c.azsSetup} pct={share(c.azsSetup)} />
          </Link>
          <Link color={CAM.grz} className="flex flex-col">
            <Block label="Обеспечено камерами распознавания ГРЗ" labelClassName="text-[15px]" value={c.azsGrz} pct={share(c.azsGrz)} />
          </Link>
        </Branch>
        {/* «Не обеспечены камерами» вынесены выноской от тёмного участка кольца (см. CoverageRings). */}
      </div>
    </div>
  );
}
