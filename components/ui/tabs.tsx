"use client";

/**
 * Abas de navegação por link. A aba escolhida vira um parâmetro na URL, então
 * recarregar a página ou mandar o endereço para o sócio abre na mesma aba -
 * coisa que um estado em memória não faria.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

export interface TabItem {
  value: string;
  label: string;
  /** Contador opcional ao lado do nome (ex.: quantidade de tarefas). */
  count?: number;
}

export function Tabs({
  items,
  param = "aba",
  defaultValue,
}: {
  items: ReadonlyArray<TabItem>;
  param?: string;
  defaultValue: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? defaultValue;

  function hrefFor(value: string): string {
    const params = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) params.delete(param);
    else params.set(param, value);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <nav
      aria-label="Seções"
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0"
    >
      {items.map((item) => {
        const active = current === item.value;
        return (
          <Link
            key={item.value}
            href={hrefFor(item.value)}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-accent font-medium text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 ? (
              <span className="rounded bg-surface-muted px-1 text-xs text-ink-subtle tabular-nums">
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
