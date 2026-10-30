"use client";

import { SingleDatePicker } from "./SingleDatePicker";

export type Gran = "day" | "hour";

/**
 * Переключатель гранулярности «Часы / Дни» (пилюля, единый стиль на всех графиках) +
 * выезжающая справа иконка-календарь для режима «Дни»: выбор КОНЕЧНОЙ даты, график
 * показывает окно последних 7 дней, заканчивающихся на ней. По умолчанию — последняя
 * неделя данных; иконка подсвечивается, только когда выбрана не последняя неделя.
 * Календарь показывается лишь в режиме «Дни» (в «Часах» — свёрнут, плавно «выезжает»).
 */
export function GranControl({
  gran, onGran, dayEnd, onDayEnd, dayMin, dayMax, pickerOnly,
}: {
  gran: Gran;
  onGran: (g: Gran) => void;
  dayEnd?: string;
  onDayEnd?: (iso: string) => void;
  dayMin?: string;
  dayMax?: string;
  /** Только календарь, всегда видимый, без пилюли «Часы/Дни» — для окон, где часов нет (попап). */
  pickerOnly?: boolean;
}) {
  const options: { label: string; value: Gran }[] = [
    { label: "Часы", value: "hour" },
    { label: "Дни", value: "day" },
  ];
  // Активная иконка — белая и скруглённая (как выбранная пилюля «Дни»), не голубая.
  const picker = onDayEnd ? (
    <SingleDatePicker
      iconOnly
      value={dayEnd || dayMax || ""}
      onChange={onDayEnd}
      min={dayMin}
      max={dayMax}
      clearLabel="Последние 7 дней"
      onClear={() => dayMax && onDayEnd(dayMax)}
      active={!!dayEnd && !!dayMax && dayEnd !== dayMax}
      iconRounded="rounded-full"
      iconHotClassName="border-transparent bg-primary text-primary-foreground"
    />
  ) : null;

  if (pickerOnly) return picker;

  return (
    <div className="flex items-center">
      <div className="waste-gran-control flex">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onGran(o.value)}
            data-active={gran === o.value ? "true" : "false"}
            className="waste-gran-control__option"
          >
            {o.label}
          </button>
        ))}
      </div>
      {picker && (
        // «Выезжает» справа при переходе на «Дни»: ширина/прозрачность анимируются; поповер
        // календаря порталится в body, поэтому overflow-hidden обёртки его не режет.
        <div className={`flex items-center overflow-hidden transition-all duration-300 ease-out ${gran === "day" ? "ml-1.5 w-9 opacity-100" : "w-0 opacity-0"}`}>
          {picker}
        </div>
      )}
    </div>
  );
}
