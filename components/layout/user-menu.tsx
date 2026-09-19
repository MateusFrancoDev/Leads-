"use client";

/**
 * Identificação de quem está logado, no canto superior direito.
 * Abre com clique e fecha ao clicar fora ou apertar Esc - sem biblioteca de
 * menu: são vinte linhas de listener e o comportamento fica exatamente o
 * esperado por um <details>/menu nativo.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { USER_ROLE, type UserRoleValue } from "@/lib/domain/enums";
import { logoutAction } from "@/server/actions/auth-actions";

export interface UserMenuProps {
  name: string;
  role: UserRoleValue;
  avatarUrl: string | null;
}

/** Iniciais do nome, usadas quando não há avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function UserMenu({ name, role, avatarUrl }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-muted"
      >
        <Avatar name={name} avatarUrl={avatarUrl} />
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-medium text-ink">{name}</span>
          <span className="block truncate text-xs text-ink-subtle">{USER_ROLE[role].label}</span>
        </span>
        <ChevronDown
          className={cn("size-3.5 text-ink-subtle transition-transform", isOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-52 overflow-hidden rounded-lg border border-line bg-surface shadow-sm"
        >
          <div className="border-b border-line px-3 py-2 sm:hidden">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-xs text-ink-subtle">{USER_ROLE[role].label}</p>
          </div>

          <Link href="/perfil" role="menuitem" className={ITEM_CLASSES}>
            <UserRound className="size-4" aria-hidden />
            Meu perfil
          </Link>
          <Link href="/configuracoes" role="menuitem" className={ITEM_CLASSES}>
            <Settings className="size-4" aria-hidden />
            Configurações
          </Link>

          <form action={logoutAction} className="border-t border-line">
            <button type="submit" role="menuitem" className={cn(ITEM_CLASSES, "w-full")}>
              <LogOut className="size-4" aria-hidden />
              Sair
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

const ITEM_CLASSES =
  "flex items-center gap-2.5 px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink";

export function Avatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    // Avatares vêm do próprio servidor (rota /api/arquivos); <img> basta e
    // evita a configuração de domínios do next/image para um caso só.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn("size-7 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
