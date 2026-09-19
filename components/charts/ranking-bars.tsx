/**
 * Barras horizontais para comparar categorias com nome longo (tipo de serviço,
 * cliente que mais faturou). Horizontal porque o rótulo cabe: em colunas
 * verticais "Site institucional" viraria texto inclinado ou cortado.
 *
 * É HTML e CSS, não SVG: cada barra é uma div com largura percentual, o que
 * mantém o texto selecionável e a quebra de linha natural no celular.
 *
 * Server Component - não tem interação, então não precisa ir para o navegador.
 */

import { cn } from "@/lib/cn";

export interface RankingItem {
  label: string;
  value: number;
  /** Texto mostrado à direita. Sem ele, mostra o próprio valor. */
  display?: string;
}

export function RankingBars({
  title,
  description,
  items,
  emptyMessage = "Nada por aqui ainda.",
  className,
}: {
  title: string;
  description?: string;
  items: ReadonlyArray<RankingItem>;
  emptyMessage?: string;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((item) => Math.abs(item.value)));

  return (
    <figure className={cn("flex flex-col gap-3 rounded-lg border border-line bg-surface p-4", className)}>
      <figcaption>
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-ink-subtle">{description}</p> : null}
      </figcaption>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-subtle">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-xs text-ink-muted">{item.label}</span>
                <span className="text-xs font-medium text-ink tabular-nums">
                  {item.display ?? item.value.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (Math.abs(item.value) / max) * 100)}%`,
                    backgroundColor: "var(--chart-1)",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
