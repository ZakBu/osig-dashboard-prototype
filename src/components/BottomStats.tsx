"use client";

import { Fuel, Building2, Database, MapPin, Download, type LucideIcon } from "lucide-react";
import { Card } from "@coss/ui/components/card";
import { buttonVariants } from "@coss/ui/components/button";
import { cn } from "@coss/ui/lib/utils";
import { fmtInt, fmtPct1 } from "@/lib/format";

function Stat({ Icon, label, value }: { Icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <div>
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="font-semibold text-base tabular-nums text-foreground">{value}</div>
      </div>
    </div>
  );
}

export function BottomStats({
  total, companies, snapshotCount, coveragePct, exportUrl,
}: {
  total: number;
  companies: number;
  snapshotCount: number;
  coveragePct: number;
  exportUrl: string;
}) {
  return (
    <Card className="flex flex-row flex-wrap items-center gap-x-10 gap-y-4 p-5">
      <Stat Icon={Fuel} label="Всего АЗС в выборке" value={fmtInt(total)} />
      <Stat Icon={Building2} label="Данных получено от" value={`${fmtInt(companies)} компаний`} />
      <Stat Icon={Database} label="Снимков в базе" value={fmtInt(snapshotCount)} />
      <Stat Icon={MapPin} label="Покрытие координатами" value={fmtPct1(coveragePct)} />
      <a href={exportUrl} className={cn(buttonVariants({ size: "lg" }), "ml-auto gap-2")}>
        <Download className="size-4" />
        Экспорт отчёта
      </a>
    </Card>
  );
}
