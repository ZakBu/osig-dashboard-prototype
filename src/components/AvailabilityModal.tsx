"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Car, Fuel, X } from "lucide-react";
import type { GunCell, GunsCombo, GunsComboRow, NetSummary, RegistryData } from "@/lib/types";
import type { FuelSeriesPoint } from "@/lib/trend";
import { fmtInt } from "@/lib/format";
import { withK } from "@/lib/auth";
import { asset } from "@/lib/bp";
import { TrendPanel } from "./TrendPanel";
import { RestrictRow, Jerrycan } from "./RestrictionsPanel";
import { NetBadge } from "./NetBadge";
import { InfoTip } from "./InfoTip";
import { CheckCircleUnread, OilBarrel } from "./icons";
import { DOT, CARD } from "./HierarchyKit";

/** Доля как на своде: «51,0%». */
function pct1(v: number) {
  return `${v.toFixed(1).replace(".", ",")}%`;
}

/**
 * Попап-дриллдаун «Полностью / Частично доступны» — по клику в сайдбаре. Данные ПРЯМО из
 * витрины 27166 (та же, что и сайдбар → цифры всегда совпадают и обновляются с выгрузкой):
 * число АЗС (count_full_fuel / count_partly_fuel) + заправочные пистолеты по видам на этих
 * АЗС (count_guns_*_group_full_fuel / _partly_fuel). Per-filter (текущая группа сетей).
 */

const LIMIT_FUELS = [
  { key: "tank", name: "в бак", color: "#ef4444" },
  { key: "canister", name: "в канистру", color: "#a855f7" },
];

const LIMIT_TIP = "График ввода ограничений на покупку топлива на АЗС в течение дня:\nВ бак — количество АЗС, на которых действует ограничение на покупку топлива в бак, как минимум на 1 вид топлива, из ассортимента АЗС в течение календарных суток.\nВ канистру — количество АЗС, на которых действует ограничение на отпуск топлива в канистры, как минимум на 1 вид топлива, из ассортимента АЗС в течение календарных суток.";

const LIMIT_FILTERS: { key: string; label: string; kind?: "all" | "vink" | "other" }[] = [
  { key: "Все", label: "Все", kind: "all" },
  { key: "Роснефть", label: "Роснефть" },
  { key: "Лукойл", label: "Лукойл" },
  { key: "Газпромнефть", label: "Газпром" },
  { key: "Татнефть", label: "Татнефть" },
  { key: "Нефтьмагистраль", label: "Нефтемаг." },
  { key: "Teboil", label: "Teboil" },
  { key: "ВИНК", label: "ВИНК", kind: "vink" },
  { key: "Прочие", label: "Прочие", kind: "other" },
];

// ═══ Разбивка «Полностью / Частично доступны» по комбинациям видов топлива (витрина 27196) ═══
const FUEL_LABEL: Record<"g92" | "g95" | "gdt", string> = { g92: "АИ-92", g95: "АИ-95 и выше", gdt: "ДТ" };
const FUEL_KINDS_TIP = `Для детализации представления также приведено количество доступных для заправки на АЗС топливораздаточных пистолетов каждого из основных видов топлива:
• АИ-92, включая АИ-92+;
• ДТ, включая ДТ+;
• АИ-95 и выше, включая АИ-95+, АИ-98, АИ-98+, АИ-100, АИ-100+`;
const FULL_TIP = `Количество АЗС, на которых по данным последнего интервала мониторинга были доступны к реализации все представленные в ассортименте виды топлива.

${FUEL_KINDS_TIP}`;
const PARTIAL_TIP = `Количество АЗС, на которых по данным последнего интервала мониторинга отсутствовал хотя бы 1 вид топлива из ассортимента АЗС.

${FUEL_KINDS_TIP}`;

/** Ячейка вида: зелёная (в наличии) / красная (продаёт, но нет) / прозрачный спейсер (не продаёт). */
function FuelCell({ cell, fkey }: { cell: GunCell; fkey: "g92" | "g95" | "gdt" }) {
  if (!cell.offered) return <div className={`h-[50px] shrink-0 ${fkey === "g95" ? "w-[88px]" : "w-[80px]"}`} aria-hidden />;
  const wide = fkey === "g95";
  return (
    <div className={`flex h-[50px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-white ${wide ? "w-[88px]" : "w-[80px]"} ${cell.avail ? "bg-emerald-500" : "bg-rose-500"}`}>
      <span className="flex items-center gap-1 leading-none">
        <Fuel className="size-3.5 opacity-90" />
        <span className="text-[16px] font-bold tabular-nums">{fmtInt(cell.guns)}</span>
      </span>
      <span className={`px-0.5 text-center font-medium leading-tight opacity-95 ${wide ? "text-[10px]" : "text-[11px]"}`}>{FUEL_LABEL[fkey]}</span>
    </div>
  );
}

/** Строка комбинации: счётчик АЗС + доля из витрины (*_share), затем 3 ячейки видов. */
function ComboRow({ row }: { row: GunsComboRow }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[88px] shrink-0 leading-tight">
        <div className="flex items-baseline gap-1 tabular-nums">
          <span className="text-[24px] font-bold leading-none text-foreground">{fmtInt(row.amount)}</span>
          {row.share != null && Number.isFinite(row.share) && <span className="text-[15px] font-semibold leading-none text-foreground/90">{pct1(row.share)}</span>}
        </div>
        <div className="mt-0.5 text-[11px] font-medium text-foreground/70">АЗС</div>
      </div>
      <div className="flex items-center gap-1">
        {(["g92", "g95", "gdt"] as const).map((k) => <FuelCell key={k} cell={row[k]} fkey={k} />)}
      </div>
    </div>
  );
}

/**
 * Колонка «Полностью» / «Частично».
 * Высота природная (без внутреннего клипа): скролл — у всей модалки.
 */
function ComboColumn({ amount, share, title, subtitle, tip, rows, dot }: {
  amount: number; share: number | null; title: string; subtitle: string; tip: string; rows: GunsComboRow[]; dot: string;
}) {
  return (
    <div className={`min-w-0 ${CARD} p-3.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5 text-[15px] font-semibold leading-tight text-foreground">
            <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: dot }} />
            <span>{title}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-[24px] font-bold leading-none text-foreground">{fmtInt(amount)}</span>
            {share != null && Number.isFinite(share) && <span className="text-[17px] font-semibold leading-none text-foreground/90">{pct1(share)}</span>}
          </div>
          <div className="mt-1 text-[13px] leading-snug text-foreground/70">{subtitle}</div>
        </div>
        <InfoTip label={title} text={tip} popupClassName="max-w-[440px]" />
      </div>
      <div className="mt-2.5 space-y-2">
        {rows.length ? rows.map((r) => <ComboRow key={r.key} row={r} />) : <div className="py-2 text-[14px] text-muted-foreground">Нет данных</div>}
      </div>
    </div>
  );
}

/** Двухколоночный вид разбивки. */
function ComboView({ guns, updated }: { guns: GunsCombo | null; updated?: string }) {
  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[18px] font-semibold leading-tight text-foreground">
            Доступность топлива по видам на АЗС
          </div>
          {updated && <div className="mt-0.5 text-[15px] leading-snug text-foreground/70">{updated}</div>}
        </div>
        <Dialog.Close className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
          <X className="size-4" />
        </Dialog.Close>
      </div>
      {!guns ? (
        <div className="py-16 text-center text-[15px] text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <ComboColumn amount={guns.fully} share={guns.fullyShare} title="Полностью доступны" subtitle="весь ассортимент топлива доступен для отпуска" tip={FULL_TIP} rows={guns.full} dot={DOT.green} />
          <ComboColumn amount={guns.partially} share={guns.partiallyShare} title="Частично доступны" subtitle="отсутствует хотя бы 1 вид топлива из ассортимента" tip={PARTIAL_TIP} rows={guns.partial} dot={DOT.amber} />
        </div>
      )}
    </>
  );
}

export function AvailabilityModal({
  summary, mode, onClose, limitDay = [], limitHour = [], limitsAvailable = null, updated, registry, limitDayByGroup, limitHourByGroup, initialLimitGroup = "Все", group = "Все",
}: {
  summary: NetSummary | null;
  mode: "full" | "partial" | "limits" | null;
  onClose: () => void;
  limitDay?: FuelSeriesPoint[];
  limitHour?: FuelSeriesPoint[];
  limitsAvailable?: boolean | null;
  updated?: string;
  registry?: RegistryData | null;
  limitDayByGroup?: Record<string, FuelSeriesPoint[]>;
  limitHourByGroup?: Record<string, FuelSeriesPoint[]>;
  initialLimitGroup?: string;
  group?: string;
}) {
  const open = mode != null && !!summary;
  const isLimits = mode === "limits";
  const [limitGroup, setLimitGroup] = useState(initialLimitGroup);
  useEffect(() => { if (isLimits) setLimitGroup(initialLimitGroup); }, [initialLimitGroup, isLimits]);
  const selectedSummary = useMemo(() => {
    if (!isLimits) return summary;
    if (limitGroup === "Все") return registry?.all ?? summary;
    return registry?.nets?.[limitGroup] ?? summary;
  }, [isLimits, limitGroup, registry, summary]);
  const selectedLimitDay = isLimits ? (limitDayByGroup?.[limitGroup] ?? limitDay) : limitDay;
  const selectedLimitHour = isLimits ? (limitHourByGroup?.[limitGroup] ?? limitHour) : limitHour;
  const cityTotal = selectedSummary?.total ?? 0;
  // доли ограничений — только share_* из витрины, без пересчёта bak/total
  const tankPct = selectedSummary?.shareLimitTank ?? null;
  const canisterPct = selectedSummary?.shareLimitCanister ?? null;

  // Разбивка по комбинациям (витрина 27186) — грузим при открытии НЕ-лимитного попапа.
  const [gunsCombo, setGunsCombo] = useState<GunsCombo | null>(null);
  useEffect(() => {
    if (!open || isLimits) return;
    let alive = true;
    setGunsCombo(null);
    fetch(withK(asset(`/api/guns?group=${encodeURIComponent(group)}`)))
      .then((r) => r.json())
      .then((d) => { if (alive) setGunsCombo(d?.guns ?? null); })
      .catch(() => { if (alive) setGunsCombo(null); });
    return () => { alive = false; };
  }, [open, isLimits, group]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        {/* Скролл на оверлее: попап сверху, длинный список прокручивается. */}
        <div className="pointer-events-none fixed inset-0 z-[101] overflow-y-auto overscroll-contain p-3 sm:p-4">
          <Dialog.Popup
            className={[
              isLimits ? "w-[min(94vw,69rem)]" : "w-[min(94vw,72rem)]",
              "pointer-events-auto mx-auto mt-1 box-border mb-4 sm:mt-2",
              "rounded-2xl border border-border bg-card p-5 shadow-2xl outline-none",
              "transition-[opacity,transform] duration-200 ease-out",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            ].join(" ")}
          >
            {isLimits ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto pr-2">
                    {LIMIT_FILTERS.map((f) => {
                      const active = limitGroup === f.key;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => setLimitGroup(f.key)}
                          className={`flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[15px] font-medium transition-colors ${active ? "border-transparent bg-sky-500 text-white" : "border-input bg-background text-foreground hover:bg-muted/50"}`}
                          title={f.key}
                        >
                          {f.kind === "all" ? <CheckCircleUnread className="size-4 shrink-0" /> : f.kind === "vink" ? <OilBarrel className="size-4 shrink-0" /> : f.kind === "other" ? <Fuel className="size-4 shrink-0" /> : <NetBadge name={f.key} className="size-5" />}
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                  <Dialog.Close className="flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground">
                    <X className="size-4" />
                  </Dialog.Close>
                </div>
                <div className="mb-2 text-[17px] font-medium text-foreground/80">Типы ограничений на этих АЗС</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <RestrictRow icon={<Car className="size-4" />} tag="в бак" value={selectedSummary?.bak ?? 0} total={cityTotal} share={tankPct} caption="не более 20–50 л топлива" />
                  <RestrictRow icon={<Jerrycan className="size-[18px]" />} tag="в канистры" value={selectedSummary?.no_canister ?? 0} total={cityTotal} share={canisterPct} caption="не заправляют в канистры" />
                </div>
                <div className="mt-3 h-[420px]">
                  <TrendPanel
                    available={limitsAvailable}
                    day={selectedLimitDay}
                    hour={selectedLimitHour}
                    emptyText="Нет данных"
                    updated={updated}
                    title="Ограничения на покупку топлива"
                    subtitle="количество АЗС, шт."
                    tip={LIMIT_TIP}
                    tipClassName="max-w-[560px]"
                    titleClassName="text-[20px]"
                    fuels={LIMIT_FUELS}
                    showGranSwitch={false}
                    showDayPicker
                    defaultGran="day"
                    yStep={50}
                    yPadBelow={40}
                    yPadAbove={45}
                  />
                </div>
              </>
            ) : (
              <ComboView guns={gunsCombo} updated={gunsCombo?.updated ?? updated} />
            )}
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
