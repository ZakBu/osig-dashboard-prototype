/** Единый ключ физической АЗС для ingest и sync. */

export function normalizeAzsCode(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw.trim();
  return digits.padStart(9, "0");
}

function isPaddedAzsCode(v: string): boolean {
  return /^0\d{5,}$/.test(v) || /^\d{6,}$/.test(v);
}

/**
 * Ключ станции в БД (azs_dim.id_unique / azs_snapshot.id_unique).
 * API: code = «000000561». Matview-CSV: code = 1..685 (номер строки в срезе) → «000000001».
 */
export function resolveStationKey(
  pick: (row: Record<string, unknown>, ...keys: string[]) => unknown,
  row: Record<string, unknown>,
): string | null {
  const rawCode = pick(row, "code", "code_azs");
  const rawId = pick(row, "id_unique", "ID", "id");

  const code = rawCode != null && String(rawCode).trim() !== "" ? String(rawCode).trim() : null;
  const idUnique = rawId != null && String(rawId).trim() !== "" ? String(rawId).trim() : null;

  if (code) {
    if (isPaddedAzsCode(code)) return normalizeAzsCode(code);
    if (/^\d+$/.test(code)) return normalizeAzsCode(code);
  }
  if (idUnique && isPaddedAzsCode(idUnique)) return normalizeAzsCode(idUnique);

  return idUnique ?? code;
}
