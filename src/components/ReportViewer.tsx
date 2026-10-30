"use client";

import { FileText } from "lucide-react";
import { Panel } from "./ui";
import { PdfViewer } from "./PdfViewer";
import type { ReportMeta } from "@/lib/reports";

/**
 * Блок просмотра доклада в режиме «Доклады». Замещает три аналитических блока.
 * Сам просмотрщик (PdfViewer) с единым тёмным тулбаром — в цветах дизайн-системы.
 */
export function ReportViewer({
  report, onBack, page, onPage,
}: {
  report: ReportMeta | null;
  onBack: () => void;
  page: number;
  onPage: (p: number) => void;
}) {
  return (
    <Panel className="h-full" bodyClassName="flex min-h-0 flex-1 flex-col p-0">
      {report ? (
        <PdfViewer report={report} onBack={onBack} page={page} onPage={onPage} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <FileText className="size-12 opacity-30" />
          <p className="text-sm">Выберите доклад в списке слева</p>
        </div>
      )}
    </Panel>
  );
}
