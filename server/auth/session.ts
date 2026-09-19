/**
 * Sessões de login guardadas no banco.
 *
 * Por que banco e não JWT: sair do sistema precisa realmente encerrar a sessão,
 * e um token assinado continua válido até expirar. Aqui basta apagar a linha.
 * O navegador recebe um token aleatório de 32 bytes; o banco guarda só o
 * SHA-256 dele, então ler a tabela não permite se passar por ninguém.
 *
 * Nada deste arquivo pode ser importado por Client Component.
 */

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/cookie";
import { prisma } from "@/server/db/prisma";
import { serverConfig } from "@/server/config";
import type { UserRoleValue } from "@/lib/domain/enums";

/** Dados do usuário logado que a interface pode ver. Nunca inclui passwordHash. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRoleValue;
  avatarUrl: string | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Cria a sessão e grava o cookie. `secure` fica desligado em desenvolvimento
 * porque o servidor local é http - em produção o cookie exige https.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + serverConfig.auth.sessionMaxAgeMs);

  const headerList = await headers();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: headerList.get("user-agent")?.slice(0, 300) ?? null,
      ipAddress: headerList.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 60) ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Lê a sessão do cookie e devolve o usuário, ou null.
 *
 * Também renova o prazo quando a sessão já passou da metade da validade, para
 * que quem usa o sistema todo dia nunca seja deslogado - sem escrever no banco
 * a cada requisição.
 */
export async function readSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: { id: true, name: true, email: true, role: true, avatarUrl: true, isActive: true },
      },
    },
  });

  if (!session) return null;

  // Expirada ou de usuário desligado: some com a linha e trata como deslogado.
  if (session.expiresAt.getTime() <= Date.now() || !session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const halfLife = serverConfig.auth.sessionMaxAgeMs / 2;
  if (Date.now() - session.lastSeenAt.getTime() > halfLife) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: {
          lastSeenAt: new Date(),
          expiresAt: new Date(Date.now() + serverConfig.auth.sessionMaxAgeMs),
        },
      })
      .catch(() => undefined);
  }

  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

/** Encerra a sessão atual: apaga a linha no banco e o cookie do navegador. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Derruba todas as sessões do usuário. Usado ao trocar a senha. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}
