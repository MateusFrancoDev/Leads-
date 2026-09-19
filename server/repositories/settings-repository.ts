/**
 * Dados da própria empresa. Linha única com id fixo "app": este sistema é de
 * uma empresa só, e um registro único evita ter que passar tenantId por tudo.
 */

import { prisma } from "@/server/db/prisma";
import { APP_CONFIG } from "@/lib/config/app-config";

export interface AppSettingsData {
  companyName: string;
  logoUrl: string | null;
}

/** Lê (ou cria na primeira vez) a linha de configuração. */
export async function readSettings(): Promise<AppSettingsData> {
  const settings = await prisma.appSettings.upsert({
    where: { id: "app" },
    update: {},
    create: { id: "app", companyName: APP_CONFIG.name },
    select: { companyName: true, logoUrl: true },
  });
  return settings;
}

/**
 * Nome da empresa para o cabeçalho e o login. Nunca derruba a tela: se o banco
 * estiver fora do ar, a tela de login ainda precisa aparecer.
 */
export async function readCompanyName(): Promise<string> {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "app" },
      select: { companyName: true },
    });
    return settings?.companyName ?? APP_CONFIG.name;
  } catch {
    return APP_CONFIG.name;
  }
}

export async function updateSettings(data: Partial<AppSettingsData>): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: "app" },
    update: data,
    create: { id: "app", companyName: data.companyName ?? APP_CONFIG.name, logoUrl: data.logoUrl },
  });
}
