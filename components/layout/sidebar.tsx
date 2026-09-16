"use client";

/**
 * Navegacao principal. Client Component apenas pelo que exige o navegador:
 * rota ativa (usePathname) e o menu recolhivel no mobile.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  History,
  LayoutDashboard,
  ListChecks,
  Map,
  Menu,
  Search,
  Settings,
  Star,
  Table2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { APP_CONFIG } from "@/lib/config/app-config";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/buscar", label: "Buscar leads", icon: Search },
  { href: "/leads", label: "Todos os leads", icon: Table2 },
  { href: "/mapa", label: "Mapa", icon: Map },
  { href: "/listas", label: "Listas", icon: ListChecks },
  { href: "/favoritos", label: "Favoritos", icon: Star },
  { href: "/historico", label: "Historico", icon: History },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Navegacao principal">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
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
      {/* Barra superior: so aparece no mobile */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <span className="text-sm font-semibold tracking-tight">{APP_CONFIG.name}</span>
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

      <aside className="hidden w-56 shrink-0 flex-col gap-6 border-r border-line bg-surface px-3 py-5 md:flex">
        <div className="px-2.5">
          <span className="text-sm font-semibold tracking-tight">{APP_CONFIG.name}</span>
          <p className="mt-0.5 text-xs text-ink-subtle">{APP_CONFIG.description}</p>
        </div>
        {nav}
      </aside>
    </>
  );
}
