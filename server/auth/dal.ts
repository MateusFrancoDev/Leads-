/**
 * Camada de acesso autenticado. TODA leitura e TODA escrita do sistema interno
 * passa por `requireUser()` antes de tocar no banco - o proxy só faz o desvio
 * rápido para /login, ele não é a proteção de verdade.
 *
 * `cache()` do React garante uma consulta por render, e não uma por componente.
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { readSession, type SessionUser } from "@/server/auth/session";

/** Usuário logado, ou null. Use quando "sem sessão" é um estado válido. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  return readSession();
});

/**
 * Usuário logado. Redireciona para /login quando não há sessão válida.
 * É o que páginas e Server Actions devem chamar.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Igual a requireUser(), mas lança em vez de redirecionar. Route Handlers
 * precisam devolver 401, não um HTML de redirecionamento.
 */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHORIZED");
  return user;
}

/**
 * Hoje administrador e sócio veem e editam tudo; funcionário ainda não tem
 * tela própria. A função existe para que as permissões futuras tenham um só
 * lugar para mudar - nenhuma tela decide isso sozinha.
 */
export function canManageEverything(user: SessionUser): boolean {
  return user.role === "ADMIN" || user.role === "PARTNER";
}

/** Só o administrador mexe em usuários e dados da empresa. */
export function canManageUsers(user: SessionUser): boolean {
  return user.role === "ADMIN";
}
