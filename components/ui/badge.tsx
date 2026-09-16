import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "positive" | "negative" | "warning" | "accent";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-muted border-line",
  positive: "bg-positive-soft text-positive border-positive/20",
  negative: "bg-negative-soft text-negative border-negative/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  accent: "bg-accent-soft text-accent border-accent/20",
};

/**
 * Etiqueta de estado. O texto sempre carrega a informação - a cor e reforço,
 * nunca o único sinal.
 */
export function Badge({
  tone = "neutral",
  children,
  className,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  /** Explicação curta exibida ao passar o mouse. */
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
