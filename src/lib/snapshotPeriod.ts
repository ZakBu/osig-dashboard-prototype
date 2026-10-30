/**
 * Официальные выгрузки matview / DTW API.
 * date_timecode — момент публикации; snapshot_at — тот же календарный час (МСК, :00).
 *
 * Примеры (как в фильтре штаба):
 *   02.07 0:01 → 00:00   02.07 9:01 → 09:00   01.07 17:40 → 17:00
 *   03.07 9:18 → 09:00   03.07 15:01 → 15:00
 *
 * Подпись интервала на графике — bandPeriodLabel() в trend.ts.
 */

export const REPORTING_INTERVAL_HOURS = 3;

type MskParts = { year: string; month: string; day: string; hour: number; minute: number };

function mskParts(at: Date): MskParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function mskSnapshotDate(parts: MskParts, hour: number, dayOffset = 0): Date {
  const base = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00+03:00`);
  base.setUTCDate(base.getUTCDate() + dayOffset);
  const y = base.getUTCFullYear();
  const mo = String(base.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(base.getUTCDate()).padStart(2, "0");
  return new Date(`${y}-${mo}-${dd}T${String(hour).padStart(2, "0")}:00:00+03:00`);
}

/** Момент выгрузки → snapshot_at (час выгрузки, минуты = 0, МСК). */
export function exportTimeToSnapshotAt(exportAt: Date): Date {
  const parts = mskParts(exportAt);
  return mskSnapshotDate(parts, parts.hour, 0);
}

export function exportTimeToSnapshotAtMs(exportAt: Date): number {
  return exportTimeToSnapshotAt(exportAt).getTime();
}

/** @deprecated Используйте exportTimeToSnapshotAt; оставлено для совместимости. */
export function periodEndFromMskMinutes(totalMin: number): { endHour: number; dayOffset: number } {
  const h = Math.floor(totalMin / 60) % 24;
  return { endHour: h, dayOffset: 0 };
}

export function formatExportTimeMsk(exportAt: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  })
    .format(exportAt)
    .replace(", ", " ");
}

export function formatSnapshotAtMsk(snapshotAt: Date): string {
  return formatExportTimeMsk(snapshotAt);
}

/**
 * Разбор date_timecode. Matview-CSV — ДД.ММ.ГГГГ Ч:ММ (МСК).
 * DTW API отдаёт ISO с суффиксом Z, но значение — московские «настенные» часы, не UTC.
 */
export function parseExportTimecode(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const p2 = (x: string) => x.padStart(2, "0");

  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mo, yyyy, hh = "00", mi = "00", ss = "00"] = m;
    return new Date(`${yyyy}-${mo}-${dd}T${p2(hh)}:${p2(mi)}:${p2(ss)}+03:00`);
  }

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/);
  if (m) {
    const [, yyyy, mo, dd, hh, mi, ss = "00"] = m;
    return new Date(`${yyyy}-${mo}-${dd}T${p2(hh)}:${p2(mi)}:${p2(ss)}+03:00`);
  }

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
      const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const [, yyyy, mo, dd, hh = "00", mi = "00", ss = "00"] = m;
    return new Date(`${yyyy}-${mo}-${dd}T${p2(hh)}:${p2(mi)}:${p2(ss)}+03:00`);
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
