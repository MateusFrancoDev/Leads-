"use client";

/**
 * Busca global do topo. É só um formulário GET para /busca: sem estado, sem
 * debounce e sem requisição a cada tecla - a página de resultados faz o
 * trabalho no servidor, que é onde os dados estão.
 */

import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function GlobalSearch() {
  // Ao voltar para /busca o campo já vem preenchido com o que foi pesquisado.
  const current = useSearchParams().get("q") ?? "";

  return (
    <form action="/busca" method="get" className="min-w-0 flex-1" role="search">
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-subtle"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          defaultValue={current}
          maxLength={120}
          placeholder="Buscar cliente, projeto, telefone..."
          aria-label="Buscar em todo o sistema"
          className="h-8 w-full rounded-md border border-line bg-canvas pr-2.5 pl-8 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
        />
      </div>
    </form>
  );
}
