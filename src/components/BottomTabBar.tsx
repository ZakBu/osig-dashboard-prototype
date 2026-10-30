"use client";

import { LayoutDashboard, Fuel, RussianRuble, Cctv, type LucideIcon } from "lucide-react";

// Нижняя навигация в стиле iOS — ТОЛЬКО на мобильном (lg:hidden). Десктоп использует
// верхний ViewTabs (он на моб. скрыт). «Доклады» тут нет — на телефоне вкладка убрана.
const TABS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "dashboard", label: "Свод", Icon: LayoutDashboard },
  { value: "fuel", label: "Топливо", Icon: Fuel },
  { value: "prices", label: "Цены", Icon: RussianRuble },
  { value: "cameras", label: "Камеры", Icon: Cctv },
];

export function BottomTabBar({ view, onView }: { view: string; onView: (v: string) => void }) {
  return (
    <nav
      aria-label="Разделы"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map(({ value, label, Icon }) => {
          const active = view === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onView(value)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 select-none flex-col items-center justify-center gap-1 pt-2 pb-1.5 transition-colors ${
                active ? "text-sky-500" : "text-muted-foreground active:text-foreground"
              }`}
            >
              <Icon className="size-[26px]" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[11px] font-medium leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
