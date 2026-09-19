import { cn } from "@/lib/cn";

/**
 * Barra de progresso do projeto. O número sempre aparece ao lado: a barra é
 * reforço visual, nunca a única forma de ler o valor.
 */
export function ProgressBar({
  value,
  label,
  className,
  tone = "accent",
}: {
  /** 0 a 100. */
  value: number;
  /** Texto à esquerda da porcentagem. */
  label?: string;
  className?: string;
  tone?: "accent" | "warning" | "negative" | "positive";
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const fill = {
    accent: "bg-accent",
    warning: "bg-warning",
    negative: "bg-negative",
    positive: "bg-positive",
  }[tone];

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label || clamped >= 0 ? (
        <div className="flex items-baseline justify-between gap-2 text-xs">
          {label ? <span className="text-ink-muted">{label}</span> : <span />}
          <span className="font-medium text-ink tabular-nums">{clamped}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progresso"}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        <div className={cn("h-full rounded-full transition-[width]", fill)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
