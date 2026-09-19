import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Indicadores numéricos. São uma grade de células separadas por linhas de 1px,
 * não cartões com sombra: em um painel com doze números, doze caixas flutuando
 * viram ruído. A linha já separa.
 */

export interface StatProps {
  label: string;
  value: string;
  /** Contexto curto abaixo do número ("3 atrasados", "margem 42%"). */
  hint?: string;
  /** Destaca o número quando ele exige atenção. */
  tone?: "default" | "positive" | "negative" | "warning";
  /** Torna a célula clicável, levando à lista filtrada correspondente. */
  href?: string;
  icon?: ReactNode;
}

const TONE_CLASSES = {
  default: "text-ink",
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
} as const;

export function Stat({ label, value, hint, tone = "default", href, icon }: StatProps) {
  const content = (
    <>
      <div className="flex items-center gap-1.5 text-xs text-ink-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("mt-1.5 text-xl font-semibold tracking-tight", TONE_CLASSES[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-xs text-ink-subtle">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="bg-surface px-4 py-3.5 transition-colors hover:bg-surface-muted">
        {content}
      </Link>
    );
  }

  return <div className="bg-surface px-4 py-3.5">{content}</div>;
}

/**
 * Grade de indicadores. O fundo é a cor da linha e cada célula é branca:
 * é assim que as divisórias de 1px aparecem sem desenhar nenhuma borda.
 */
export function StatGrid({
  children,
  columns = 4,
  className,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const columnClasses = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  } as const;

  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-lg border border-line bg-line",
        columnClasses[columns],
        className,
      )}
    >
      {children}
    </div>
  );
}
