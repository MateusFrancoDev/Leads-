/**
 * Acesso a dados de Lead. Todo Prisma relacionado a leads vive aqui -
 * services, actions e paginas nunca montam query direto.
 */

import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { normalizeState } from "@/lib/normalize";
import type { LeadFilters } from "@/lib/validation";
import { prisma } from "@/server/db/prisma";
import {
  LeadStatus,
  ScoreLevel,
  WEBSITE_STATUSES_WITHOUT_SITE,
  WebsiteStatus,
  type LeadDetail,
  type LeadListItem,
  type LeadMapPoint,
  type LeadStats,
} from "@/types/lead";

/** Campos da tabela. Selecionar so o necessario mantem a query leve. */
const LIST_SELECT = {
  id: true,
  name: true,
  category: true,
  city: true,
  state: true,
  phone: true,
  whatsapp: true,
  email: true,
  website: true,
  websiteStatus: true,
  instagram: true,
  rating: true,
  reviewsCount: true,
  score: true,
  scoreLevel: true,
  status: true,
  isFavorite: true,
} satisfies Prisma.LeadSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  provider: true,
  externalId: true,
  facebook: true,
  linkedin: true,
  address: true,
  neighborhood: true,
  country: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  scoreReasons: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  lastCheckedAt: true,
  enrichedAt: true,
} satisfies Prisma.LeadSelect;

/** Dados ja normalizados e pontuados, prontos para persistir. */
export interface LeadUpsertInput {
  provider: string;
  externalId: string | null;
  dedupeKey: string;
  name: string;
  category: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  websiteDomain: string | null;
  websiteStatus: WebsiteStatus;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewsCount: number | null;
  score: number;
  scoreLevel: ScoreLevel;
  scoreReasons: string[];
}

export interface UpsertedLead {
  id: string;
  isNew: boolean;
}

function presence(filter: LeadFilters[keyof LeadFilters]): boolean | null {
  if (filter === "yes") return true;
  if (filter === "no") return false;
  return null;
}

/** Traduz os filtros da interface para a clausula where do Prisma. */
export function buildLeadWhere(filters: LeadFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  const and: Prisma.LeadWhereInput[] = [];

  if (filters.q) {
    and.push({
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        { category: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.category) where.category = { contains: filters.category, mode: "insensitive" };
  if (filters.city) where.city = { contains: filters.city, mode: "insensitive" };
  if (filters.state) where.state = normalizeState(filters.state) ?? filters.state.toUpperCase();
  if (filters.neighborhood) {
    where.neighborhood = { contains: filters.neighborhood, mode: "insensitive" };
  }

  const hasWebsite = presence(filters.website);
  if (hasWebsite === true) where.websiteStatus = WebsiteStatus.HAS_WEBSITE;
  if (hasWebsite === false) where.websiteStatus = { in: [...WEBSITE_STATUSES_WITHOUT_SITE] };

  const hasPhone = presence(filters.phone);
  if (hasPhone !== null) where.phone = hasPhone ? { not: null } : null;

  const hasWhatsapp = presence(filters.whatsapp);
  if (hasWhatsapp !== null) where.whatsapp = hasWhatsapp ? { not: null } : null;

  const hasInstagram = presence(filters.instagram);
  if (hasInstagram !== null) where.instagram = hasInstagram ? { not: null } : null;

  const hasEmail = presence(filters.email);
  if (hasEmail !== null) where.email = hasEmail ? { not: null } : null;

  if (filters.minRating !== undefined) where.rating = { gte: filters.minRating };
  if (filters.minReviews !== undefined || filters.maxReviews !== undefined) {
    where.reviewsCount = {
      ...(filters.minReviews !== undefined ? { gte: filters.minReviews } : {}),
      ...(filters.maxReviews !== undefined ? { lte: filters.maxReviews } : {}),
    };
  }
  if (filters.minScore !== undefined) where.score = { gte: filters.minScore };
  if (filters.status) where.status = filters.status;
  if (filters.favorites) where.isFavorite = true;
  if (filters.searchId) where.searchResults = { some: { searchId: filters.searchId } };
  if (filters.listId) where.lists = { some: { listId: filters.listId } };
  if (filters.ids && filters.ids.length > 0) where.id = { in: filters.ids };

  if (and.length > 0) where.AND = and;
  return where;
}

function buildOrderBy(sort: LeadFilters["sort"]): Prisma.LeadOrderByWithRelationInput[] {
  switch (sort) {
    case "recent":
      return [{ createdAt: "desc" }];
    case "reviews":
      return [{ reviewsCount: "desc" }, { score: "desc" }];
    case "rating":
      return [{ rating: "desc" }, { reviewsCount: "desc" }];
    default:
      return [{ score: "desc" }, { reviewsCount: "desc" }];
  }
}

export interface LeadPage {
  items: LeadListItem[];
  total: number;
  hasMore: boolean;
}

/** Uma consulta paginada + a contagem total, em paralelo. */
export async function findLeads(filters: LeadFilters): Promise<LeadPage> {
  const where = buildLeadWhere(filters);
  try {
    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        select: LIST_SELECT,
        orderBy: buildOrderBy(filters.sort),
        take: filters.limit,
      }),
      prisma.lead.count({ where }),
    ]);
    return { items, total, hasMore: items.length < total };
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export async function findLeadById(id: string): Promise<LeadDetail | null> {
  try {
    return await prisma.lead.findUnique({ where: { id }, select: DETAIL_SELECT });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Campos que so sobrescrevemos quando o provider trouxe valor novo. */
function keepExisting<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

/**
 * Localiza o lead por id externo ou pela chave de deduplicacao e atualiza o
 * que mudou. Nunca cria duplicado e nunca sobrescreve dados do usuario
 * (status, favorito, anotacoes) nem enriquecimentos ja obtidos.
 */
export async function upsertLead(input: LeadUpsertInput): Promise<UpsertedLead> {
  const or: Prisma.LeadWhereInput[] = [{ dedupeKey: input.dedupeKey }];
  if (input.externalId) {
    or.push({ provider: input.provider, externalId: input.externalId });
  }

  try {
    const existing = await prisma.lead.findFirst({ where: { OR: or }, select: { id: true } });
    const now = new Date();

    if (!existing) {
      const created = await prisma.lead.create({
        data: { ...input, lastCheckedAt: now },
        select: { id: true },
      });
      return { id: created.id, isNew: true };
    }

    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        category: keepExisting(input.category),
        phone: keepExisting(input.phone),
        whatsapp: keepExisting(input.whatsapp),
        email: keepExisting(input.email),
        website: keepExisting(input.website),
        websiteDomain: keepExisting(input.websiteDomain),
        websiteStatus: input.websiteStatus,
        instagram: keepExisting(input.instagram),
        facebook: keepExisting(input.facebook),
        linkedin: keepExisting(input.linkedin),
        address: keepExisting(input.address),
        neighborhood: keepExisting(input.neighborhood),
        city: keepExisting(input.city),
        state: keepExisting(input.state),
        country: keepExisting(input.country),
        postalCode: keepExisting(input.postalCode),
        latitude: keepExisting(input.latitude),
        longitude: keepExisting(input.longitude),
        rating: keepExisting(input.rating),
        reviewsCount: keepExisting(input.reviewsCount),
        externalId: keepExisting(input.externalId),
        score: input.score,
        scoreLevel: input.scoreLevel,
        scoreReasons: input.scoreReasons,
        lastCheckedAt: now,
      },
    });
    return { id: existing.id, isNew: false };
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.lead.update({ where: { id }, data: { status } }),
      prisma.leadActivity.create({
        data: { leadId: id, type: "STATUS_CHANGED", message: `Status alterado para ${status}` },
      }),
    ]);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export async function toggleLeadFavorite(id: string): Promise<boolean> {
  try {
    const lead = await prisma.lead.findUnique({ where: { id }, select: { isFavorite: true } });
    if (!lead) throw new AppError("NOT_FOUND");
    const isFavorite = !lead.isFavorite;
    await prisma.lead.update({ where: { id }, data: { isFavorite } });
    return isFavorite;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Contagens do dashboard em uma unica ida ao banco. */
export async function getLeadStats(): Promise<LeadStats> {
  try {
    const [total, withoutWebsite, highScore, enriched, byStatus] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { websiteStatus: { in: [...WEBSITE_STATUSES_WITHOUT_SITE] } } }),
      prisma.lead.count({ where: { scoreLevel: ScoreLevel.HIGH } }),
      prisma.lead.count({ where: { enrichedAt: { not: null } } }),
      prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const counts = new Map(byStatus.map((row) => [row.status, row._count._all]));
    return {
      total,
      withoutWebsite,
      highScore,
      new: counts.get(LeadStatus.NEW) ?? 0,
      contacted: counts.get(LeadStatus.CONTACTED) ?? 0,
      interested: counts.get(LeadStatus.INTERESTED) ?? 0,
      customers: counts.get(LeadStatus.CUSTOMER) ?? 0,
      enriched,
    };
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Melhores oportunidades para o dashboard. */
export async function findTopOpportunities(take: number): Promise<LeadListItem[]> {
  try {
    return await prisma.lead.findMany({
      where: { status: { in: [LeadStatus.NEW, LeadStatus.QUALIFIED] } },
      select: LIST_SELECT,
      orderBy: [{ score: "desc" }, { reviewsCount: "desc" }],
      take,
    });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

// --------------------------------------------------------------- Fase 2

/** Campos que alimentam o Lead Score, incluindo o HTTPS visto na analise. */
export interface LeadScoringSnapshot {
  websiteStatus: WebsiteStatus;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
  rating: number | null;
  reviewsCount: number | null;
  websiteHasHttps: boolean | null;
}

export async function findLeadScoringSnapshot(id: string): Promise<LeadScoringSnapshot | null> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        websiteStatus: true,
        phone: true,
        whatsapp: true,
        instagram: true,
        email: true,
        rating: true,
        reviewsCount: true,
        websiteAnalysis: { select: { hasHttps: true } },
      },
    });
    if (!lead) return null;

    const { websiteAnalysis, ...rest } = lead;
    return { ...rest, websiteHasHttps: websiteAnalysis?.hasHttps ?? null };
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export async function updateLeadScore(
  id: string,
  score: { score: number; level: ScoreLevel; reasons: string[] },
): Promise<void> {
  try {
    await prisma.lead.update({
      where: { id },
      data: { score: score.score, scoreLevel: score.level, scoreReasons: score.reasons },
    });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Campos que o enriquecimento pode preencher. Undefined = nao mexe. */
export interface LeadEnrichmentUpdate {
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  website?: string;
  websiteDomain?: string;
  websiteStatus?: WebsiteStatus;
}

export async function applyLeadEnrichment(
  id: string,
  update: LeadEnrichmentUpdate,
  message: string,
): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.lead.update({ where: { id }, data: { ...update, enrichedAt: new Date() } }),
      prisma.leadActivity.create({ data: { leadId: id, type: "ENRICHED", message } }),
    ]);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export interface WebsiteAnalysisRecord {
  finalUrl: string | null;
  httpStatus: number | null;
  responseTimeMs: number | null;
  // Nulo quando o sinal nao pode ser verificado (site fora do ar, por exemplo).
  hasHttps: boolean | null;
  hasViewport: boolean | null;
  hasTitle: boolean | null;
  hasDescription: boolean | null;
  hasFavicon: boolean | null;
  hasContactForm: boolean | null;
  hasPhone: boolean | null;
  hasWhatsapp: boolean | null;
  hasAnalytics: boolean | null;
  hasMetaPixel: boolean | null;
  title: string | null;
  description: string | null;
  contentHash: string | null;
  issues: string[];
}

export interface StoredWebsiteAnalysis extends WebsiteAnalysisRecord {
  checkedAt: Date;
}

export async function findWebsiteAnalysis(leadId: string): Promise<StoredWebsiteAnalysis | null> {
  try {
    return await prisma.leadWebsiteAnalysis.findUnique({
      where: { leadId },
      select: {
        finalUrl: true,
        httpStatus: true,
        responseTimeMs: true,
        hasHttps: true,
        hasViewport: true,
        hasTitle: true,
        hasDescription: true,
        hasFavicon: true,
        hasContactForm: true,
        hasPhone: true,
        hasWhatsapp: true,
        hasAnalytics: true,
        hasMetaPixel: true,
        title: true,
        description: true,
        contentHash: true,
        issues: true,
        checkedAt: true,
      },
    });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Grava a analise, atualiza a situacao do site e registra a atividade. */
export async function saveWebsiteAnalysis(
  leadId: string,
  analysis: WebsiteAnalysisRecord,
  websiteStatus: WebsiteStatus,
  message: string,
): Promise<void> {
  const checkedAt = new Date();
  try {
    await prisma.$transaction([
      prisma.leadWebsiteAnalysis.upsert({
        where: { leadId },
        create: { leadId, ...analysis, checkedAt },
        update: { ...analysis, checkedAt },
      }),
      prisma.lead.update({ where: { id: leadId }, data: { websiteStatus, lastCheckedAt: checkedAt } }),
      prisma.leadActivity.create({ data: { leadId, type: "WEBSITE_ANALYZED", message } }),
    ]);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export interface LeadActivityItem {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
}

export async function listLeadActivities(
  leadId: string,
  take: number,
): Promise<LeadActivityItem[]> {
  try {
    return await prisma.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, type: true, message: true, createdAt: true },
    });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Linha da exportacao CSV. */
export interface LeadExportRow {
  name: string;
  category: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  city: string | null;
  state: string | null;
  rating: number | null;
  reviewsCount: number | null;
  score: number;
  status: LeadStatus;
}

/** Leitura unica e limitada para exportar - nunca carrega a base inteira. */
export async function findLeadsForExport(
  filters: LeadFilters,
  maxRows: number,
): Promise<LeadExportRow[]> {
  try {
    return await prisma.lead.findMany({
      where: buildLeadWhere(filters),
      orderBy: buildOrderBy(filters.sort),
      take: maxRows,
      select: {
        name: true,
        category: true,
        phone: true,
        whatsapp: true,
        email: true,
        website: true,
        instagram: true,
        city: true,
        state: true,
        rating: true,
        reviewsCount: true,
        score: true,
        status: true,
      },
    });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

// ----------------------------------------------------------- Fase 3 (IA/CRM)

export interface AiAnalysisRecord {
  model: string;
  inputHash: string;
  summary: string;
  problems: string[];
  opportunities: string[];
  services: string[];
  approach: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number | null;
}

export interface StoredAiAnalysisRow extends AiAnalysisRecord {
  createdAt: Date;
}

export async function findAiAnalysis(leadId: string): Promise<StoredAiAnalysisRow | null> {
  try {
    return await prisma.leadAiAnalysis.findUnique({
      where: { leadId },
      select: {
        model: true,
        inputHash: true,
        summary: true,
        problems: true,
        opportunities: true,
        services: true,
        approach: true,
        inputTokens: true,
        outputTokens: true,
        cachedInputTokens: true,
        costUsd: true,
        createdAt: true,
      },
    });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export async function saveAiAnalysis(
  leadId: string,
  analysis: AiAnalysisRecord,
  message: string,
): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.leadAiAnalysis.upsert({
        where: { leadId },
        create: { leadId, ...analysis },
        update: analysis,
      }),
      prisma.leadActivity.create({ data: { leadId, type: "AI_ANALYZED", message } }),
    ]);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Anotacoes livres do lead (CRM). Guarda tambem no historico de atividades. */
export async function updateLeadNotes(leadId: string, notes: string | null): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.lead.update({ where: { id: leadId }, data: { notes } }),
      prisma.leadActivity.create({
        data: {
          leadId,
          type: "NOTE",
          message: notes ? "Anotacoes atualizadas" : "Anotacoes removidas",
        },
      }),
    ]);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/**
 * Leads com coordenadas, para o mapa. Select minimo e teto de pontos: um mapa
 * com milhares de marcadores trava o navegador e nao ajuda ninguem.
 */
export async function findLeadsForMap(
  filters: LeadFilters,
  maxPoints: number,
): Promise<{ points: LeadMapPoint[]; total: number; withoutCoordinates: number }> {
  const where = buildLeadWhere(filters);
  const located: Prisma.LeadWhereInput = {
    ...where,
    latitude: { not: null },
    longitude: { not: null },
  };

  try {
    const [rows, total, withCoordinates] = await Promise.all([
      prisma.lead.findMany({
        where: located,
        orderBy: [{ score: "desc" }],
        take: maxPoints,
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          city: true,
          state: true,
          score: true,
          scoreLevel: true,
          websiteStatus: true,
          phone: true,
        },
      }),
      prisma.lead.count({ where }),
      prisma.lead.count({ where: located }),
    ]);

    // O select garante coordenadas, mas o tipo do Prisma ainda as ve como
    // opcionais; o filtro abaixo resolve isso sem cast.
    const points = rows.flatMap<LeadMapPoint>((row) =>
      row.latitude !== null && row.longitude !== null
        ? [{ ...row, latitude: row.latitude, longitude: row.longitude }]
        : [],
    );

    return { points, total, withoutCoordinates: total - withCoordinates };
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}
