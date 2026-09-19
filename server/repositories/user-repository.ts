/**
 * Acesso à tabela de usuários. O `passwordHash` só sai daqui para a função que
 * confere a senha - nenhuma outra camada recebe esse campo.
 */

import { prisma } from "@/server/db/prisma";
import type { UserRoleValue } from "@/lib/domain/enums";

/** Usuário como a interface o conhece. Sem hash de senha, por construção. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRoleValue;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

const PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

/** Só para o login: devolve o hash junto, e por isso não é exportada em listas. */
export async function findUserForLogin(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, passwordHash: true, isActive: true },
  });
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_FIELDS });
}

/** Todos os usuários ativos, em ordem alfabética. Alimenta o campo "responsável". */
export async function listActiveUsers(): Promise<PublicUser[]> {
  return prisma.user.findMany({
    where: { isActive: true },
    select: PUBLIC_FIELDS,
    orderBy: { name: "asc" },
  });
}

export async function listAllUsers(): Promise<PublicUser[]> {
  return prisma.user.findMany({ select: PUBLIC_FIELDS, orderBy: { name: "asc" } });
}

export async function markLoggedIn(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

export async function updateProfile(
  userId: string,
  data: { name: string; email: string },
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { name: data.name, email: data.email.toLowerCase() },
  });
}

export async function updateAvatar(userId: string, avatarUrl: string | null): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
}

export async function readPasswordHash(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return user?.passwordHash ?? null;
}

export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function emailIsTaken(email: string, exceptUserId?: string): Promise<boolean> {
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  return Boolean(existing && existing.id !== exceptUserId);
}

/** Usado pelo comando `npm run user:create`. Não há cadastro pela interface. */
export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRoleValue;
}): Promise<PublicUser> {
  return prisma.user.create({
    data: { ...data, email: data.email.toLowerCase() },
    select: PUBLIC_FIELDS,
  });
}

export async function countUsers(): Promise<number> {
  return prisma.user.count();
}
