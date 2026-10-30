/** Тип доклада + клиентские вызовы /api/reports (S3 через azs-api). */
import { asset } from "./bp";
import { withK } from "./auth";

export type ReportMeta = {
  id: string;
  title: string;
  /** Дата доклада (YYYY-MM-DD). */
  date: string;
  uploadedAt: string;
  size?: number;
};

export async function fetchReports(): Promise<ReportMeta[]> {
  const r = await fetch(withK(asset("/api/reports")), { cache: "no-store" });
  if (r.status === 401) throw new Error("Доклады доступны по защищённой ссылке с токеном");
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Не удалось получить список");
  return (await r.json()).reports as ReportMeta[];
}

export async function uploadReport(fd: FormData): Promise<ReportMeta> {
  const r = await fetch(withK(asset("/api/reports")), { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Ошибка загрузки");
  return j.report as ReportMeta;
}

export async function deleteReport(id: string): Promise<void> {
  const r = await fetch(withK(asset(`/api/reports/${encodeURIComponent(id)}`)), { method: "DELETE" });
  if (!r.ok) throw new Error("Не удалось удалить");
}

// ?k подставляется и в URL для <img>/pdf — там нельзя выставить заголовок.
export const reportFileUrl = (id: string) => withK(asset(`/api/reports/${encodeURIComponent(id)}/file`));
export const reportThumbUrl = (id: string) => withK(asset(`/api/reports/${encodeURIComponent(id)}/thumb`));
