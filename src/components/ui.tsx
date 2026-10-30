import { Card } from "@coss/ui/components/card";
import { cn } from "@coss/ui/lib/utils";

/** Панель = coss Card с компактной шапкой (заголовок слева, контролы справа). */
export function Panel({
  title,
  right,
  children,
  className,
  headerClassName,
  bodyClassName,
}: {
  title?: React.ReactNode;
  /** @deprecated значок-ⓘ убран; проп оставлен для совместимости вызовов */
  info?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      {title != null && (
        // Фиксированная высота шапки + фиксированная высота блока заголовка:
        // заголовки всех панелей центрируются на одной линии независимо от того,
        // есть ли справа переключатель (он выше текста и иначе смещал бы заголовок вниз).
        <div className={cn("flex shrink-0 flex-col items-start gap-1.5 px-4 pt-2 pb-1 lg:h-[40px] lg:flex-row lg:items-center lg:justify-between lg:gap-2 lg:pt-1 lg:pb-0", headerClassName)}>
          <div className="flex w-full min-w-0 items-center gap-1.5 font-medium text-[17px] text-foreground lg:h-8 lg:w-auto lg:flex-1 lg:text-[20px]">
            {title}
          </div>
          {right && <div className="w-full shrink-0 lg:w-auto">{right}</div>}
        </div>
      )}
      {/* Тело тянется на всю высоту карточки (min-h-0 разрешает сжатие для графиков). */}
      <div className={cn("min-h-0 flex-1 p-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

/** Маленькая цветная точка-легенда. */
export function Dot({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={cn("inline-block size-2.5 rounded-full", className)} style={style} />;
}

/** Минималистичное кольцо прогресса (в coss нет — небольшая SVG-вьюха). */
export function Ring({
  value,
  className,
  track = "text-muted/60",
  children,
  size = 76,
  stroke = 8,
}: {
  value: number;
  className?: string;
  track?: string;
  children?: React.ReactNode;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={track}
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className={cn("transition-[stroke-dashoffset] duration-700", className)}
          stroke="currentColor"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}
