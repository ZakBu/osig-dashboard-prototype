"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import type { StatusRow } from "@/lib/types";
import { Panel, Dot } from "./ui";
import { NetBadge } from "./NetBadge";
import { InfoTip } from "./InfoTip";
import { fmtInt, fmtPct1 } from "@/lib/format";

const COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };
// На мобильном — максимум 2 кольца в ряд (иначе % наезжают на кольцо); десктоп = как было (lg:).
const LG_COLS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };

// Длинные названия — в сокращение (одна строка), как в верхнем фильтре сетей:
// Газпромнефть → «Газпром», Нефтьмагистраль → «Нефтемаг.».
const SHORT_NAME: Record<string, string> = {
  "Газпромнефть": "Газпром",
  "Нефтьмагистраль": "Нефтемаг.",
  "Нефтемагистраль": "Нефтемаг.",
};
const niceName = (n: string) => SHORT_NAME[n] ?? n;

/** Кольцо-донат сети: 3-way доли (доступны/не реализует/закрыто), логотип в центре,
 *  под ним доля доступных, open/total и ПОЛНОЕ название сети (крупно). */
type NetColumnsLabels = {
  active: string;
  red: string;
  violet: string;
  title: string;
  tip: string;
};

const DEFAULT_LABELS: NetColumnsLabels = {
  active: "Доступны на момент мониторинга",
  red: "Топливо не реализуется на момент мониторинга",
  violet: "Закрыто",
  title: "АЗС по сетевым компаниям",
  tip: "Распределение АЗС Москвы по сетевым компаниям: доступных на момент мониторинга, не реализующих топливо на момент мониторинга, закрытых.",
};

function NetRing({ r, active, size = 56, percentOnly = false, side = false }: { r: StatusRow; active: boolean; size?: number; percentOnly?: boolean; side?: boolean }) {
  // Всё масштабируется от размера кольца (базовый 56px): радиус, толщина, бейдж, шрифты.
  const s = size / 56;
  const R = 22 * s, C = 2 * Math.PI * R, sw = 6 * s, c = size / 2;
  const total = percentOnly ? 100 : (r.total || 1);
  const seg = (n: number) => (Math.max(0, n) / total) * C;
  // Бублик = 3 доли total, БАЛАНС всегда сходится (дебит=кредит):
  //   зелёный «топливо есть» = Всего − «не реализуется» − «закрыто»;
  //   красный = count_azs_no_fuel; фиолет = count_closed_azs.
  // Когда витрина согласована, зелёный == count_azs_with_fuel (Роснефть 113/38/6 = 157, как у ФШ);
  // если срез кривой (wf+nf+cl≠total) — балансируем, чтобы 3 сектора = 100% круга.
  const percent = Math.max(0, Math.min(100, r.index));
  const withFuel = percentOnly ? percent : Math.max(0, r.total - r.noFuel - r.closed);
  const noFuelValue = percentOnly ? 100 - percent : r.noFuel;
  const closedValue = percentOnly ? 0 : r.closed;
  const open = seg(withFuel), noFuel = seg(noFuelValue), closed = seg(closedValue);
  const badgeCls = size >= 100 ? "size-12" : size >= 68 ? "size-8" : "size-6";
  const pctText = fmtPct1(percentOnly ? percent : (100 * withFuel) / total);
  const ring = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={c} cy={c} r={R} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={sw} />
        <circle cx={c} cy={c} r={R} fill="none" stroke="#10b981" strokeWidth={sw} strokeDasharray={`${open} ${C - open}`} strokeDashoffset="0" />
        <circle cx={c} cy={c} r={R} fill="none" stroke="#f43f5e" strokeWidth={sw} strokeDasharray={`${noFuel} ${C - noFuel}`} strokeDashoffset={`${-open}`} />
        <circle cx={c} cy={c} r={R} fill="none" stroke="#8b5cf6" strokeWidth={sw} strokeDasharray={`${closed} ${C - closed}`} strokeDashoffset={`${-(open + noFuel)}`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <NetBadge name={r.name} className={badgeCls} colored={active} />
      </div>
    </div>
  );
  // side: значения СЛЕВА крупно (для мэра — сразу видно куда смотреть), кольцо справа.
  if (side) {
    return (
      <div className="flex w-full min-w-0 items-center justify-center gap-3">
        <div className="flex min-w-0 flex-col">
          <span className={`font-bold leading-none tabular-nums ${active ? "text-white" : "text-foreground"}`} style={{ fontSize: 28 }}>{pctText}</span>
          {!percentOnly && <span className="mt-1 font-semibold leading-none text-foreground/90 tabular-nums" style={{ fontSize: 17 }}>{fmtInt(withFuel)}/{fmtInt(r.total)}</span>}
          <span className="mt-1 truncate font-medium leading-tight text-foreground/80" style={{ fontSize: 15 }}>{niceName(r.name)}</span>
        </div>
        {ring}
      </div>
    );
  }
  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-0.5">
      {ring}
      {/* Большой % и строка = доля «с топливом» (зелёный сектор), а НЕ «работает». Иначе выходило
          «100% при 12 без топлива» — число и кольцо про разное. Теперь совпадают: 23/35 = 65,7%. */}
      <span className={`font-bold leading-tight tabular-nums ${active ? "text-white" : "text-foreground"}`} style={{ fontSize: 16 * s }}>{pctText}</span>
      {!percentOnly && <span className="font-medium leading-none text-foreground/90 tabular-nums" style={{ fontSize: 12 * s }}>{fmtInt(withFuel)}/{fmtInt(r.total)}</span>}
      <span className="w-full truncate whitespace-nowrap text-center font-medium leading-tight text-foreground/90" style={{ fontSize: 11.5 * s }}>{niceName(r.name)}</span>
    </div>
  );
}

/**
 * 3-way доступность по сетям (офиц. реестр) — КОЛЬЦА-донаты (компактно, наглядно).
 * Раскладка: верхний ряд 4 сети, нижний ряд — остальные (шире, свои ячейки). Клики
 * отключены (фильтрация — общим фильтром сверху), при наведении — тултип с числами.
 * Набор сетей решает registryNets по фильтру (ВИНК → 4, Прочие → один агрегат).
 */
export function NetColumns({
  rows, emptyText, selectedNet, glow, labels = DEFAULT_LABELS, percentOnly = false, titleClassName = "text-[18px]", ringSize: ringSizeProp, sideValues = false,
}: {
  rows: StatusRow[];
  emptyText: string;
  selectedNet: string | null;
  glow?: string;
  labels?: Partial<NetColumnsLabels>;
  percentOnly?: boolean;
  /** Размер заголовка панели: свод — 18px (по умолч.), камеры — 23px (как др. заголовки вкладки). */
  titleClassName?: string;
  /** Диаметр кольца-гауджа (не-single). По умолч. 74 (камеры, панель выше); свод — меньше,
   *  иначе 2 ряда + 2-строчная легенда не влезают в невысокую панель и легенда обрезается. */
  ringSize?: number;
  /** Значения (%, N/M, название) — СЛЕВА крупно, кольцо справа (камеры: чтобы сразу читалось). */
  sideValues?: boolean;
}) {
  const shown = rows;
  const l = { ...DEFAULT_LABELS, ...labels };
  // Раскладка/размер колец: 1 (Прочие) → крупное кольцо ×2 по центру; иначе — как по умолчанию
  // (верхний ряд до 4, нижний ряд остальные, базовый размер).
  const single = shown.length === 1;
  const ringSize = single ? 148 : (ringSizeProp ?? 74);
  const top = shown.slice(0, 4);
  const bottom = shown.slice(4);

  const renderRing = (r: StatusRow) => {
    const active = selectedNet === r.name;
    return (
      <Tooltip.Root key={r.name}>
        <Tooltip.Trigger
          render={<div className={`flex w-full min-w-0 cursor-default justify-center rounded-xl px-0.5 py-0.5 ${active ? "bg-white/10 ring-1 ring-white/60" : ""}`} />}
        >
          <NetRing r={r} active={active} size={ringSize} percentOnly={percentOnly} side={sideValues} />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side="top" sideOffset={8} className="z-[60]">
            <Tooltip.Popup className="w-[210px] rounded-xl border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-xl">
              <div className="mb-1.5 font-semibold text-[17px] text-foreground">{r.name}</div>
              <div className="space-y-1 text-[12.5px]">
                <Row color="bg-emerald-500" label={l.active} value={percentOnly ? fmtPct1(Math.max(0, Math.min(100, r.index))) : Math.max(0, r.total - r.noFuel - r.closed)} />
                <Row color="bg-rose-500" label={l.red} value={percentOnly ? fmtPct1(100 - Math.max(0, Math.min(100, r.index))) : r.noFuel} />
                {l.violet && <Row color="bg-violet-500" label={l.violet} value={r.closed} />}
                <div className="mt-1 flex items-center justify-between border-border/60 border-t pt-1 text-muted-foreground">
                  <span>{percentOnly ? "Покрытие" : "Всего"}</span>
                  <span className="font-semibold text-foreground tabular-nums">{percentOnly ? fmtPct1(Math.max(0, Math.min(100, r.index))) : fmtInt(r.total)}</span>
                </div>
              </div>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  };

  return (
    <Panel
      title={
        <span className={`flex min-w-0 items-center gap-1.5 ${titleClassName}`}>
          <span className="truncate">{l.title}</span>
          <InfoTip
            label={l.title}
            text={l.tip}
          />
        </span>
      }
      className={`h-full transition-shadow duration-300 ${glow ?? ""}`}
      bodyClassName="flex flex-1 flex-col pt-1"
    >
      {shown.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center text-muted-foreground text-sm">{emptyText}</div>
      ) : (
        <Tooltip.Provider delay={100}>
          <div className="flex flex-1 flex-col">
            {/* Кольца: верхний ряд (до 4), нижний ряд — шире (меньше сетей → крупнее ячейки). */}
            {single ? (
              /* Один агрегат (Прочие) — крупное кольцо ×2 по центру. */
              <div className="flex flex-1 items-center justify-center py-0.5">
                <div className="w-40 min-w-0">{renderRing(shown[0])}</div>
              </div>
            ) : (
              /* Все сети / ВИНК — верхний ряд до 4, нижний ряд остальные (базовый размер). */
              <div className="flex flex-1 flex-col justify-center gap-3 py-0.5 lg:gap-1.5">
                <div className={`grid grid-cols-2 ${LG_COLS[top.length] ?? "lg:grid-cols-4"} items-start gap-x-1 gap-y-3 lg:gap-y-0`}>
                  {top.map(renderRing)}
                </div>
                {bottom.length > 0 && (
                  <div className={`grid grid-cols-2 ${LG_COLS[bottom.length] ?? "lg:grid-cols-3"} items-start gap-x-1 gap-y-3 lg:gap-y-0`}>
                    {bottom.map(renderRing)}
                  </div>
                )}
              </div>
            )}
            {/* Легенда СНИЗУ. Есть violet (топливо) — «Работает»+«Закрыто» в строку, «не реализуется» под ними
                (длинная). Нет violet (камеры) — «Покрыты» + «Не покрыты» в ОДНУ строку. */}
            <div className="mt-1.5 flex shrink-0 flex-col items-center gap-0.5 text-[13px] text-foreground">
              {l.violet ? (
                <>
                  <div className="flex items-center gap-6">
                    <span className="flex items-center gap-1.5"><Dot className="size-2.5 bg-emerald-500" />{l.active}</span>
                    <span className="flex items-center gap-1.5"><Dot className="size-2.5 bg-violet-500" />{l.violet}</span>
                  </div>
                  <span className="flex items-center gap-1.5 text-center"><Dot className="size-2.5 shrink-0 bg-rose-500" />{l.red}</span>
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-0.5 text-[17px]">
                  <span className="flex items-center gap-1.5"><Dot className="size-3.5 bg-emerald-500" />{l.active}</span>
                  <span className="flex items-center gap-1.5"><Dot className="size-3.5 shrink-0 bg-rose-500" />{l.red}</span>
                </div>
              )}
            </div>
          </div>
        </Tooltip.Provider>
      )}
    </Panel>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-2">
      <Dot className={`size-2.5 ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-semibold text-foreground tabular-nums">{typeof value === "number" ? fmtInt(value) : value}</span>
    </div>
  );
}
