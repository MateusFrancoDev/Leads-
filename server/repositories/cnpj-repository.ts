/**
 * Consulta à cópia local dos Dados Abertos do CNPJ (tabela CnpjEstablishment).
 * A importação é feita pelo script `npm run cnpj:import`, nunca durante a busca.
 */

import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type { CnpjImportedCityInfo, CnpjSearchQuery, CnpjStore } from "@/lib/leads/providers/receita-federal";
import { prisma } from "@/server/db/prisma";

function buildWhere(query: CnpjSearchQuery): Prisma.CnpjEstablishmentWhereInput {
  const base: Prisma.CnpjEstablishmentWhereInput = {
    state: query.state,
    cityName: { in: [...query.cityNames] },
  };

  const nameContains = (term: string): Prisma.CnpjEstablishmentWhereInput => ({
    OR: [
      { tradeName: { contains: term, mode: "insensitive" } },
      { companyName: { contains: term, mode: "insensitive" } },
    ],
  });

  if (query.cnaes) {
    return {
      ...base,
      OR: query.cnaes.map((filter) =>
        filter.nameIncludes && filter.nameIncludes.length > 0
          ? { cnaeMain: filter.code, OR: filter.nameIncludes.flatMap((term) => nameContains(term).OR ?? []) }
          : { cnaeMain: filter.code },
      ),
    };
  }

  return query.nameTerm ? { ...base, ...nameContains(query.nameTerm) } : { ...base, cnpj: { in: [] } };
}

export const cnpjStore: CnpjStore = {
  async findImportedCities(keys): Promise<CnpjImportedCityInfo[]> {
    try {
      return await prisma.cnpjImportedCity.findMany({
        where: { key: { in: [...keys] } },
        select: { key: true, cityName: true, datasetMonth: true },
      });
    } catch (error) {
      throw new AppError("DATABASE_ERROR", undefined, error);
    }
  },

  async search(query) {
    try {
      return await prisma.cnpjEstablishment.findMany({
        where: buildWhere(query),
        // Empresas com contato declarado primeiro: são as que viram lead útil.
        orderBy: [
          { phone1: { sort: "asc", nulls: "last" } },
          { email: { sort: "asc", nulls: "last" } },
          { cnpj: "asc" },
        ],
        take: query.limit,
      });
    } catch (error) {
      throw new AppError("DATABASE_ERROR", undefined, error);
    }
  },
};

export interface CnpjImportSummary {
  cities: Array<{ state: string; cityName: string; datasetMonth: string; rows: number; importedAt: Date }>;
}

/** Cidades importadas, para a tela de Configurações. */
export async function listImportedCnpjCities(): Promise<CnpjImportSummary["cities"]> {
  try {
    return await prisma.cnpjImportedCity.findMany({
      orderBy: [{ state: "asc" }, { cityName: "asc" }],
      select: { state: true, cityName: true, datasetMonth: true, rows: true, importedAt: true },
    });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}
