"use client";

import { useEffect, useState } from "react";

// Референс-размеры канваса для БОЛЬШИХ экранов. Канвас масштабируется под вьюпорт
// через `zoom` и ЗАПОЛНЯЕТ контейнер целиком (без полей по бокам — важно для
// встраивания в широкий iframe). Одна из сторон канваса фиксирована (эталон размеров
// элементов), другая тянется под пропорцию контейнера:
//  • контейнер ШИРЕ эталона (обычный кейс, iframe) → фиксируем ВЫСОТУ 1080, ширину тянем
//    (дашборд адаптивен по ширине → раскладывается на всю ширину, контент не обрезается);
//  • контейнер УЖЕ/выше эталона → фиксируем ШИРИНУ 1920, высоту тянем.
// Новый эталон совпадает с канвасом waste-макета; сам механизм адаптива не меняется.
const W = 1920;
const H = 1080;
const CANVAS_ASPECT = W / H;
// Ниже этой ширины — обычная мобильная раскладка (стопкой, читаемо), без канваса
// и без zoom (на iOS Safari zoom на фикс-канвасе ломает вёрстку).
const MIN_SCALE_WIDTH = 1024;

type State = { mode: "flow" | "scale"; zoom: number; canvasW: number; canvasH: number };

export function FitCanvas({ children }: { children: React.ReactNode }) {
  const [{ mode, zoom, canvasW, canvasH }, setState] = useState<State>({ mode: "flow", zoom: 1, canvasW: W, canvasH: H });

  useEffect(() => {
    const de = document.documentElement;
    const calc = () => {
      // clientWidth/Height — БЕЗ полосы прокрутки и корректно отражают зум браузера
      // (в отличие от innerWidth, где скроллбар давал канвас чуть шире → правый край
      // графика обрезался на некоторых зумах, напр. 125%).
      const w = de.clientWidth;
      const h = de.clientHeight;
      if (w < MIN_SCALE_WIDTH) {
        setState({ mode: "flow", zoom: 1, canvasW: W, canvasH: H });
        return;
      }
      if (w / h >= CANVAS_ASPECT) {
        // Контейнер шире эталона: фиксируем высоту, тянем ширину.
        const zoom = h / H;
        setState({ mode: "scale", zoom, canvasW: w / zoom, canvasH: H });
      } else {
        // Контейнер уже эталона: фиксируем ширину, тянем высоту.
        const zoom = w / W;
        setState({ mode: "scale", zoom, canvasW: W, canvasH: h / zoom });
      }
    };
    calc();
    window.addEventListener("resize", calc);
    window.visualViewport?.addEventListener("resize", calc);
    return () => {
      window.removeEventListener("resize", calc);
      window.visualViewport?.removeEventListener("resize", calc);
    };
  }, []);

  // Мобильная/узкая — отдаём как есть, дашборд сам адаптивен (стопка + скролл).
  if (mode === "flow") return <>{children}</>;

  // Большой экран/iframe — канвас масштабируется от верх-лев угла и заполняет контейнер:
  // scaled = (canvasW×zoom) × (canvasH×zoom) = w × h → без полей.
  // transform: scale (а не CSS `zoom`) устойчив к зуму браузера (Ctrl±).
  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <div
        className="fit-canvas-stage"
        data-fit-mode="scale"
        style={{ width: canvasW, height: canvasH, transform: `scale(${zoom})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}
