"use client";

/**
 * Barra de filtros. É um <form method="get">: os filtros viram query string,
 * o servidor lê e devolve a página já filtrada.
 *
 * Isso não é preguiça de fazer em JavaScript - é o que faz o filtro sobreviver
 * ao recarregar, ao voltar do navegador e ao mandar o link para outra pessoa.
 * O botão "Limpar" é um link para a rota sem parâmetros.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export function FilterBar({
  action,
  hasActiveFilters,
  searchName = "q",
  searchValue,
  searchPlaceholder = "Buscar...",
  /** Telas que filtram só por seletores (Financeiro) escondem a busca livre. */
  showSearch = true,
  children,
  className,
}: {
  /** Rota para onde o formulário envia (a própria página). */
  action: string;
  hasActiveFilters: boolean;
  searchName?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
  /** Os selects específicos de cada tela. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      className={cn(
        "flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3",
        className,
      )}
    >
      {showSearch ? (
        <div className="relative min-w-0 flex-1 basis-56">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <input
            type="search"
            name={searchName}
            defaultValue={searchValue ?? ""}
            maxLength={120}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 w-full rounded-md border border-line bg-surface pr-2.5 pl-8 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
          />
        </div>
      ) : null}

      {children}

      <Button type="submit" size="md">
        Filtrar
      </Button>

      {hasActiveFilters ? (
        <Link href={action} className={buttonClasses("ghost", "md")}>
          <X className="size-3.5" aria-hidden />
          Limpar
        </Link>
      ) : null}
    </form>
  );
}

/** Select compacto para dentro da barra de filtros. */
export function FilterSelect({
  name,
  label,
  value,
  options,
  allLabel = "Todos",
}: {
  name: string;
  label: string;
  value?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  allLabel?: string;
}) {
  const id = `filtro-${name}`;
  return (
    <div className="flex min-w-36 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      <Select id={id} name={name} defaultValue={value ?? ""}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
