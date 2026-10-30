"use client";

import { useCallback, useRef } from "react";

const DAY = 86_400_000;

/** Сдвиг ключа-даты 'YYYY-MM-DD' на N дней (UTC, детерминированно). */
const shiftIso = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};

export type DayScrollOpts = {
  /** Активен ли скролл (для «Дни»-режима; в «Часах» — выкл). */
  enabled: boolean;
  dayEnd: string;
  dayMin: string;
  dayMax: string;
  /** Ширина окна в днях (по умолч. 7). */
  days?: number;
  onChange: (iso: string) => void;
};

/**
 * Горизонтальный «скролл» графика колесиком/тачпадом с шагом в 1 день (магнит): двигает окно
 * дат (dayEnd) по всем данным. Один «щелчок» накопленной дельты = ровно 1 день (дискретно →
 * само по себе «примагничено» к дням). Границы: окно не выходит за пределы данных.
 *
 * Возвращает callback-ref: вешаем его на контейнер графика (`<div ref={onWheelRef}>`). Слушатель
 * ставится нативно с { passive: false }, чтобы можно было preventDefault (иначе страница скроллит).
 */
export function useDayScroll(opts: DayScrollOpts) {
  const state = useRef(opts);
  state.current = opts;
  const acc = useRef(0);
  const detach = useRef<(() => void) | null>(null);

  return useCallback((el: HTMLElement | null) => {
    detach.current?.();
    detach.current = null;
    if (!el) return;

    // Общий шаг «магнита»: накопили порог → сдвинули окно ровно на 1 день.
    const step = (raw: number, threshold: number, canPrevent?: () => boolean, prevent?: () => void) => {
      const { enabled, dayEnd, dayMin, dayMax, days = 7, onChange } = state.current;
      if (!enabled || !dayMin || !dayMax || dayMin === dayMax || !raw) return;
      const cur = dayEnd || dayMax;
      const lowEnd = shiftIso(dayMin, days - 1);
      const minEnd = lowEnd > dayMax ? dayMax : lowEnd;
      // На КРАЮ окна в направлении жеста НЕ перехватываем — отдаём странице/модалке (без scroll-trap).
      if ((raw > 0 && cur >= dayMax) || (raw < 0 && cur <= minEnd)) { acc.current = 0; return; }
      if (canPrevent?.() ?? true) prevent?.();
      acc.current += raw;
      if (Math.abs(acc.current) < threshold) return;
      const dir = acc.current > 0 ? 1 : -1;
      acc.current = 0;
      let next = shiftIso(cur, dir);
      if (next < minEnd) next = minEnd;
      if (next > dayMax) next = dayMax;
      if (next !== cur) onChange(next);
    };

    // ── Колесо/тачпад (десктоп) ──
    const onWheel = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const raw = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
      step(raw, 90, undefined, () => e.preventDefault());
    };

    // ── Тач-свайп (мобильный): горизонталь двигает дни, вертикаль — скроллит страницу.
    //   touch-action: pan-y отдаёт вертикаль браузеру, горизонталь обрабатываем сами. ──
    let lastX = 0, startX = 0, startY = 0, axis: "h" | "v" | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { axis = null; return; }
      lastX = startX = e.touches[0].clientX; startY = e.touches[0].clientY; axis = null; acc.current = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const x = e.touches[0].clientX, y = e.touches[0].clientY;
      if (axis === null) {
        const dx = Math.abs(x - startX), dy = Math.abs(y - startY);
        if (dx < 8 && dy < 8) return;           // ещё не определились с осью
        axis = dx > dy ? "h" : "v";
      }
      if (axis !== "h") return;                  // вертикаль → пусть страница скроллит (pan-y)
      const raw = lastX - x;                     // палец влево (raw>0) = вперёд к свежим датам
      lastX = x;
      // pan-y уже блокирует горизонтальный скролл браузера → preventDefault не нужен.
      step(raw, 36);
    };

    el.style.touchAction = "pan-y";
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    detach.current = () => {
      el.style.touchAction = "";
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);
}
