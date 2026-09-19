"use client";

/** Abas do módulo de leads. Só aparece quando o módulo está ligado. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { LEADS_NAV_ITEMS } from "@/lib/config/navigation";

export function LeadsSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seções de leads"
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 pb-2 md:-mx-8 md:px-8"
    >
      {LEADS_NAV_ITEMS.map((item) => {
        // "/leads" é a listagem: só acende no caminho exato.
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
              active
                ? "bg-accent-soft font-medium text-accent"
                : "text-ink-muted hover:bg-surface-muted hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
