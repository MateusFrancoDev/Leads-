"use client";

/**
 * Navegação principal. Client Component apenas pelo que exige o navegador:
 * rota ativa (usePathname) e o menu recolhível no mobile.
 *
 * No celular vira uma barra superior com menu deslizante; no desktop, uma
 * coluna fixa. Não é a mesma lista encolhida: a barra do celular também
 * carrega a busca global e o menu do usuário, que no desktop ficam no topo.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { APP_CONFIG } from "@/lib/config/app-config";
import { NAV_ITEMS, isNavItemActive } from "@/lib/config/navigation";

export function Sidebar({
  leadsEnabled,
  companyName,
}: {
  /** Com o módulo desligado, "Leads" aparece apagado e não navega. */
  leadsEnabled: boolean;
  companyName: string;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Navegação principal">
      {NAV_ITEMS.map((item) => {
        const disabled = item.comingSoon && !leadsEnabled;
        const active = !disabled && isNavItemActive(pathname, item.href);

        if (disabled) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title="Captação automática de leads: disponível quando a API for contratada."
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-subtle"
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              <span className="rounded border border-line px-1 py-px text-[10px] font-medium tracking-wide text-ink-subtle uppercase">
                Em breve
              </span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            // Escolher um item fecha o menu do celular.
            onClick={() => setIsOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-accent-soft font-medium text-accent"
                : "text-ink-muted hover:bg-surface-muted hover:text-ink",
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
          {companyName}
        </Link>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
          className="rounded-md p-1.5 text-ink-muted hover:bg-surface-muted"
        >
          {isOpen ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
        </button>
      </div>

      {isOpen ? (
        <div className="border-b border-line bg-surface px-3 py-2 md:hidden">{nav}</div>
      ) : null}

      <aside className="hidden w-56 shrink-0 flex-col gap-5 border-r border-line bg-surface px-3 py-4 md:flex">
        <Link href="/dashboard" className="px-2.5">
          <span className="text-sm font-semibold tracking-tight">{companyName}</span>
          <p className="mt-0.5 text-xs text-ink-subtle">{APP_CONFIG.description}</p>
        </Link>
        {nav}
      </aside>
    </>
  );
}
