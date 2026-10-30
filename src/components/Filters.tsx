"use client";

import { CalendarDays, MapPin, RefreshCw, Loader2 } from "lucide-react";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@coss/ui/components/select";
import { Button } from "@coss/ui/components/button";
import type { Meta } from "@/lib/types";

export type FilterState = {
  region: string;
  net: string;
  operatorOnly: boolean;
};

export function Filters({
  meta, state, onChange, onRefresh, loading, dateLabel,
}: {
  meta: Meta | null;
  state: FilterState;
  onChange: (next: Partial<FilterState>) => void;
  onRefresh: () => void;
  loading: boolean;
  dateLabel: string;
}) {
  const regionItems = [
    { label: "Все регионы", value: "all" },
    ...(meta?.regions ?? []).map((r) => ({ label: r, value: r })),
  ];

  return (
    <div className="flex flex-nowrap items-center gap-2">
      <div className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-input bg-background px-3 text-foreground text-sm sm:h-8">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <span>{dateLabel}</span>
      </div>

      <div className="w-40">
        <Select
          items={regionItems}
          value={state.region}
          onValueChange={(v) => onChange({ region: (v as string) ?? "all" })}
        >
          <SelectTrigger>
            <MapPin className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {regionItems.map((it) => (
              <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant={state.operatorOnly ? "secondary" : "outline"}
        onClick={() => onChange({ operatorOnly: !state.operatorOnly })}
      >
        С оператором
      </Button>

      <Button variant="outline" size="icon" onClick={onRefresh} aria-label="Обновить">
        {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      </Button>
    </div>
  );
}
