"use client";

/**
 * Moldura comum dos gráficos: título, legenda, estado vazio e a tabela de
 * dados que sempre acompanha o desenho.
 *
 * A tabela não é enfeite de acessibilidade: é o caminho para ler os números
 * exatos sem depender de passar o mouse, e serve tanto para leitor de tela
 * quanto para quem quer conferir um valor.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SeriesMeta {
  label: string;
  /** Variável CSS da cor, ex.: "var(--chart-1)". */
  color: string;
}

export function ChartFrame({
  title,
  description,
  series,
  isEmpty,
  emptyMessage = "Ainda não há dados para este período.",
  table,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Com duas ou mais séries a legenda é obrigatória; com uma, o título basta. */
  series?: ReadonlyArray<SeriesMeta>;
  isEmpty: boolean;
  emptyMessage?: string;
  table: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("flex flex-col gap-3 rounded-lg border border-line bg-surface p-4", className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-ink-subtle">{description}</p> : null}
        </div>
        {series && series.length > 1 ? (
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {series.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span
                  aria-hidden
                  className="size-2 rounded-[2px]"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}
      </figcaption>

      {isEmpty ? (
        <p className="py-10 text-center text-sm text-ink-subtle">{emptyMessage}</p>
      ) : (
        <>
          {children}
          <details className="group">
            <summary className="cursor-pointer text-xs text-ink-subtle hover:text-ink-muted">
              Ver dados
            </summary>
            <div className="mt-2 overflow-x-auto">{table}</div>
          </details>
        </>
      )}
    </figure>
  );
}

/** Tabela simples usada por todos os gráficos. Números alinhados à direita. */
export function ChartTable({
  columns,
  rows,
}: {
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<ReadonlyArray<string>>;
}) {
  return (
    <table className="w-full text-xs tabular-nums">
      <thead>
        <tr className="border-b border-line text-left text-ink-subtle">
          {columns.map((column, index) => (
            <th key={column} className={cn("py-1.5 font-medium", index > 0 && "text-right")}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]} className="border-b border-line/60 last:border-0">
            {row.map((cell, index) => (
              <td
                key={index}
                className={cn("py-1.5", index === 0 ? "text-ink-muted" : "text-right text-ink")}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
