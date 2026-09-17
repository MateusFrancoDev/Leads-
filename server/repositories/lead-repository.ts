/**
 * Acesso a dados de Lead. Todo Prisma relacionado a leads vive aqui -
 * services, actions e páginas nunca montam query direto.
 */

import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { mapWithConcurrency } from "@/lib/http";
import { toPublicLead, type PublicLead } from "@/lib/leads/public-lead";
import type { ExistingLead, PreparedLead } from "@/lib/leads/search-pipeline";
import {
  toDbEnrichmentStatus,
  toDbWhatsappStatus,
  toPublicEnrichmentStatus,
  toPublicWebsiteStatus,
  toPublicWhatsappStatus,
  WEBSITE_STATUS_GROUPS,
} from "@/lib/leads/status";
import type { LeadResult, LeadSearchFilters } from "@/lib/leads/types";
import { buildDedupeKey, extractDomain, normalizePhone, normalizeState } from "@/lib/normalize";
import type { LeadFilters } from "@/lib/validation";
import { serverConfig } from "@/server/config";
import { prisma } from "@/server/db/prisma";
import {
  LEAD_STATUS_LABELS,
  LeadStatus,
  leadSourceLabel,
  ScoreLevel,
  WEBSITE_STATUSES_WITHOUT_KNOWN_SITE,
  WhatsappStatus,
  type WebsiteQuality,
  type EnrichmentStatus,
  type LeadDetail,
  type LeadListItem,
  type LeadMapPoint,
  type LeadStats,
  type WebsiteStatus,
} from "@/types/lead";

/**
 * Leads gerados pelo antigo provider fictício ("mock") nunca aparecem: a base
 * só mostra empresas reais, mesmo que registros antigos continuem no banco.
 */
const REAL_LEADS_ONLY: Prisma.LeadWhereInput = { provider: { not: "mock" } };

/** Campos da tabela. Selecionar só o necessário mantém a query leve. */
const LIST_SELECT = {
  id: true,
  provider: true,
  name: true,
  category: true,
  neighborhood: true,
  city: true,
  state: true,
  latitude: true,
  longitude: true,
  phone: true,
  whatsapp: true,
  whatsappStatus: true,
  email: true,
  website: true,
  websiteStatus: true,
  instagram: true,
  score: true,
  scoreLevel: true,
  status: true,
  isFavorite: true,
  /**
   * Resumo da análise por IA na própria consulta da tabela: relação 1-1, sem
   * consulta extra. Vem null quando o lead nunca foi analisado.
   */
  aiAnalysis: { select: { score: true, opportunity: true, createdAt: true } },
} satisfies Prisma.LeadSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  externalId: true,
  rating: true,
  reviewsCount: true,
  facebook: true,
  linkedin: true,
  address: true,
  street: true,
  number: true,
  country: true,
  postalCode: true,
  phoneSource: true,
  whatsappSource: true,
  emailSource: true,
  websiteSource: true,
  instagramSource: true,
  enrichmentStatus: true,
  scoreReasons: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  lastCheckedAt: true,
  enrichedAt: true,
} satisfies Prisma.LeadSelect;

/** Campos do formato público da API. */
const PUBLIC_SELECT = {
  id: true,
  provider: true,
  externalId: true,
  name: true,
  category: true,
  address: true,
  street: true,
  number: true,
  neighborhood: true,
  city: true,
  state: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  phone: true,
  whatsapp: true,
  email: true,
  website: true,
  instagram: true,
  facebook: true,
  linkedin: true,
  websiteStatus: true,
  whatsappStatus: true,
  enrichmentStatus: true,
  phoneSource: true,
  emailSource: true,
  websiteSource: true,
  instagramSource: true,
  whatsappSource: true,
  score: true,
  scoreLevel: true,
  scoreReasons: true,
  status: true,
  rawData: true,
  createdAt: true,
  updatedAt: true,
  lastCheckedAt: true,
} satisfies Prisma.LeadSelect;

function presence(filter: "any" | "yes" | "no"): boolean | null {
  if (filter === "yes") return true;
  if (filter === "no") return false;
  return null;
}

/** Traduz os filtros da interface para a clausula where do Prisma. */
export function buildLeadWhere(filters: LeadFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  const and: Prisma.LeadWhereInput[] = [REAL_LEADS_ONLY];

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

  if (filters.site !== "any") where.websiteStatus = { in: [...WEBSITE_STATUS_GROUPS[filters.site]] };

  const hasPhone = presence(filters.phone);
  if (hasPhone !== null) where.phone = hasPhone ? { not: null } : null;

  if (filters.whatsapp === "confirmed") where.whatsappStatus = WhatsappStatus.CONFIRMED;
  if (filters.whatsapp === "confirmed_or_possible") {
    where.whatsappStatus = { in: [WhatsappStatus.CONFIRMED, WhatsappStatus.POSSIBLE] };
  }
  if (filters.whatsapp === "none") where.whatsappStatus = WhatsappStatus.UNKNOWN;

  const hasInstagram = presence(filters.instagram);
  if (hasInstagram !== null) where.instagram = hasInstagram ? { not: null } : null;

  const hasEmail = presence(filters.email);
  if (hasEmail !== null) where.email = hasEmail ? { not: null } : null;

  if (filters.minScore !== undefined) where.score = { gte: filters.minScore };
  if (filters.status) where.status = filters.status;
  if (filters.favorites) where.isFavorite = true;
  if (filters.searchId) where.searchResults = { some: { searchId: filters.searchId } };
  if (filters.listId) where.lists = { some: { listId: filters.listId } };
  if (filters.ids && filters.ids.length > 0) where.id = { in: filters.ids };

  where.AND = and;
  return where;
}

/** Filtros da API de busca, aplicados aos leads de uma pesquisa. */
function buildSearchFiltersWhere(searchId: string, filters: LeadSearchFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    AND: [REAL_LEADS_ONLY],
    searchResults: { some: { searchId } },
  };
  if (filters.hasPhone !== undefined) where.phone = filters.hasPhone ? { not: null } : null;
  if (filters.hasWhatsapp !== undefined) {
    where.whatsappStatus = filters.hasWhatsapp ? WhatsappStatus.CONFIRMED : WhatsappStatus.UNKNOWN;
  }
  if (filters.hasInstagram !== undefined) where.instagram = filters.hasInstagram ? { not: null } : null;
  if (filters.hasEmail !== undefined) where.email = filters.hasEmail ? { not: null } : null;
  if (filters.websiteStatus) where.websiteStatus = { in: [...WEBSITE_STATUS_GROUPS[filters.websiteStatus]] };
  if (filters.minScore !== undefined) where.score = { gte: filters.minScore };
  return where;
}

function buildOrderBy(sort: LeadFilters["sort"]): Prisma.LeadOrderByWithRelationInput[] {
  switch (sort) {
    case "recent":
      return [{ createdAt: "desc" }];
    case "name":
      return [{ name: "asc" }];
    default:
      return [{ score: "desc" }, { name: "asc" }];
  }
}

export interface LeadPage {
  items: LeadListItem[];
  total: number;
  hasMore: boolean;
}

/** Uma consulta paginada + a contagem total, em paralelo. `max` limita o total exibido. */
export async function findLeads(filters: LeadFilters): Promise<LeadPage> {
  const where = buildLeadWhere(filters);
  const take = filters.max ? Math.min(filters.limit, filters.max) : filters.limit;
  try {
    const [items, count] = await Promise.all([
      prisma.lead.findMany({
        where,
        select: LIST_SELECT,
        orderBy: buildOrderBy(filters.sort),
        take,
      }),
      prisma.lead.count({ where }),
    ]);
    const total = filters.max ? Math.min(count, filters.max) : count;
    return { items, total, hasMore: items.length < total };
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export async function findLeadById(id: string): Promise<LeadDetail | null> {
  try {
    return await prisma.lead.findFirst({ where: { id, ...REAL_LEADS_ONLY }, select: DETAIL_SELECT });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

// ------------------------------------------------------------- busca (OSM)

/** Campos lidos para deduplicar e reaproveitar o que o banco já sabe. */
const EXISTING_SELECT = {
  ...PUBLIC_SELECT,
  enrichedAt: true,
  websiteAnalysis: { select: { hasHttps: true } },
} satisfies Prisma.LeadSelect;

type ExistingRow = Prisma.LeadGetPayload<{ select: typeof EXISTING_SELECT }>;

function asContactSource(value: string | null): LeadResult["phoneSource"] {
  return value === "openstreetmap" || value === "receita_federal" || value === "website" ? value : null;
}

function toExistingLead(row: ExistingRow): ExistingLead {
  return {
    id: row.id,
    source: row.provider,
    externalId: row.externalId,
    name: row.name,
    category: row.category,
    address: row.address,
    street: row.street,
    number: row.number,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    website: row.website,
    instagram: row.instagram,
    facebook: row.facebook,
    linkedin: row.linkedin,
    osmUrl: null,
    websiteStatus: toPublicWebsiteStatus(row.websiteStatus),
    whatsappStatus: toPublicWhatsappStatus(row.whatsappStatus),
    enrichmentStatus: toPublicEnrichmentStatus(row.enrichmentStatus),
    phoneSource: asContactSource(row.phoneSource),
    emailSource: asContactSource(row.emailSource),
    websiteSource: asContactSource(row.websiteSource),
    instagramSource: asContactSource(row.instagramSource),
    whatsappSource: asContactSource(row.whatsappSource),
    rawData: {},
    dbWebsiteStatus: row.websiteStatus,
    enrichedAt: row.enrichedAt,
    websiteHasHttps: row.websiteAnalysis?.hasHttps ?? null,
  };
}

/**
 * Candidatos a duplicado de um lote, numa única consulta: mesmo id na fonte,
 * mesmo telefone, mesmo domínio ou mesmo nome. A decisão final (distância,
 * endereço) é de findDuplicateLead, em memória.
 */
export async function findExistingLeadsForBatch(leads: readonly LeadResult[]): Promise<ExistingLead[]> {
  if (leads.length === 0) return [];

  const externalIds = [...new Set(leads.map((lead) => lead.externalId))];
  const idsBySource = new Map<string, string[]>();
  for (const lead of leads) idsBySource.set(lead.source, [...(idsBySource.get(lead.source) ?? []), lead.externalId]);
  const phones = [...new Set(leads.map((lead) => normalizePhone(lead.phone)).filter((value): value is string => Boolean(value)))];
  const domains = [...new Set(leads.map((lead) => extractDomain(lead.website)).filter((value): value is string => Boolean(value)))];
  const names = [...new Set(leads.map((lead) => lead.name))];

  const or: Prisma.LeadWhereInput[] = [
    ...[...idsBySource].map(([provider, ids]) => ({ provider, externalId: { in: ids } })),
    { name: { in: names, mode: "insensitive" as const } },
  ];
  if (phones.length > 0) or.push({ phone: { in: phones } });
  if (domains.length > 0) or.push({ websiteDomain: { in: domains } });

  try {
    const rows = await prisma.lead.findMany({
      where: { AND: [REAL_LEADS_ONLY, { OR: or }] },
      select: EXISTING_SELECT,
      take: 5_000,
    });
    // O id exato na fonte vem primeiro: é o critério mais forte.
    const exact = new Set(externalIds);
    rows.sort((a, b) => Number(exact.has(b.externalId ?? "")) - Number(exact.has(a.externalId ?? "")));
    return rows.map(toExistingLead);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** undefined = "não mexe": dado ausente nesta coleta não apaga o que já existia. */
function keep<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

function contactFields(lead: LeadResult) {
  return {
    name: lead.name,
    category: keep(lead.category),
    phone: keep(lead.phone),
    phoneSource: lead.phone ? keep(lead.phoneSource) : undefined,
    whatsapp: keep(lead.whatsapp),
    whatsappStatus: toDbWhatsappStatus(lead.whatsappStatus),
    whatsappSource: keep(lead.whatsappSource),
    email: keep(lead.email),
    emailSource: lead.email ? keep(lead.emailSource) : undefined,
    website: keep(lead.website),
    websiteDomain: keep(extractDomain(lead.website)),
    websiteSource: lead.website ? keep(lead.websiteSource) : undefined,
    instagram: keep(lead.instagram),
    instagramSource: lead.instagram ? keep(lead.instagramSource) : undefined,
    facebook: keep(lead.facebook),
    linkedin: keep(lead.linkedin),
    address: keep(lead.address),
    street: keep(lead.street),
    number: keep(lead.number),
    neighborhood: keep(lead.neighborhood),
    city: keep(lead.city),
    state: keep(lead.state),
    postalCode: keep(lead.postalCode),
    latitude: keep(lead.latitude),
    longitude: keep(lead.longitude),
    enrichmentStatus: toDbEnrichmentStatus(lead.enrichmentStatus),
    rawData: lead.rawData as Prisma.InputJsonObject,
  };
}

/**
 * Grava os leads de uma busca, na ordem recebida. Nunca cria duplicado:
 * atualiza o registro encontrado pela deduplicação ou o mesmo id na fonte.
 * Status, favorito e anotações do usuário nunca são tocados.
 */
export async function saveSearchLeads(prepared: readonly PreparedLead[]): Promise<string[]> {
  const now = new Date();

  return mapWithConcurrency(prepared, serverConfig.external.concurrency, async ({ lead, existingId, dbWebsiteStatus, score, enrichedNow }) => {
    const data = {
      ...contactFields(lead),
      websiteStatus: dbWebsiteStatus,
      score: score.score,
      scoreLevel: score.level,
      scoreReasons: score.reasons,
      lastCheckedAt: now,
      ...(enrichedNow ? { enrichedAt: now } : {}),
    };

    try {
      if (existingId) {
        await prisma.lead.update({ where: { id: existingId }, data, select: { id: true } });
        return existingId;
      }

      const saved = await prisma.lead.upsert({
        where: { provider_externalId: { provider: lead.source, externalId: lead.externalId } },
        update: data,
        create: {
          ...data,
          provider: lead.source,
          externalId: lead.externalId,
          dedupeKey: buildDedupeKey({ provider: lead.source, externalId: lead.externalId, name: lead.name }),
          country: "BR",
          activities: {
            create: { type: "DISCOVERED", message: `Encontrado em ${leadSourceLabel(lead.source)} (${lead.externalId})` },
          },
        },
        select: { id: true },
      });
      return saved.id;
    } catch (error) {
      throw new AppError("DATABASE_ERROR", undefined, error);
    }
  });
}

/** Leads de uma pesquisa com os filtros da API, no formato público. */
export async function findSearchLeadsForApi(
  searchId: string,
  filters: LeadSearchFilters,
  limit: number,
): Promise<PublicLead[]> {
  try {
    const rows = await prisma.lead.findMany({
      where: buildSearchFiltersWhere(searchId, filters),
      select: PUBLIC_SELECT,
      orderBy: [{ score: "desc" }, { name: "asc" }],
      take: limit,
    });
    return rows.map(toPublicLead);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

// --------------------------------------------------------------------- CRM

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.lead.update({ where: { id }, data: { status } }),
      prisma.leadActivity.create({
        data: { leadId: id, type: "STATUS_CHANGED", message: `Status alterado para ${LEAD_STATUS_LABELS[status]}` },
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

/** Contagens do dashboard em uma única ida ao banco. */
export async function getLeadStats(): Promise<LeadStats> {
  try {
    const [total, withoutKnownWebsite, highScore, enriched, byStatus] = await Promise.all([
      prisma.lead.count({ where: REAL_LEADS_ONLY }),
      prisma.lead.count({
        where: { ...REAL_LEADS_ONLY, websiteStatus: { in: [...WEBSITE_STATUSES_WITHOUT_KNOWN_SITE] } },
      }),
      prisma.lead.count({ where: { ...REAL_LEADS_ONLY, scoreLevel: ScoreLevel.HIGH } }),
      prisma.lead.count({ where: { ...REAL_LEADS_ONLY, enrichedAt: { not: null } } }),
      prisma.lead.groupBy({ by: ["status"], where: REAL_LEADS_ONLY, _count: { _all: true } }),
    ]);

    const counts = new Map(byStatus.map((row) => [row.status, row._count._all]));
    return {
      total,
      withoutKnownWebsite,
      highScore,
      new: counts.get(LeadStatus.NEW) ?? 0,
      contacted: counts.get(LeadStatus.CONTACTED) ?? 0,
      interested: counts.get(LeadStatus.INTERESTED) ?? 0,
      clients: counts.get(LeadStatus.CLIENT) ?? 0,
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
      where: { ...REAL_LEADS_ONLY, status: { in: [LeadStatus.NEW, LeadStatus.QUALIFIED] } },
      select: LIST_SELECT,
      orderBy: [{ score: "desc" }, { name: "asc" }],
      take,
    });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

// --------------------------------------------------------------- Fase 2

/** Campos que alimentam o Lead Score, incluindo o HTTPS visto na análise. */
export interface LeadScoringSnapshot {
  websiteStatus: WebsiteStatus;
  whatsappStatus: WhatsappStatus;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  street: string | null;
  number: string | null;
  city: string | null;
  websiteHasHttps: boolean | null;
}

export async function findLeadScoringSnapshot(id: string): Promise<LeadScoringSnapshot | null> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        websiteStatus: true,
        whatsappStatus: true,
        phone: true,
        email: true,
        instagram: true,
        facebook: true,
        street: true,
        number: true,
        city: true,
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

/** Campos que o enriquecimento pode preencher. Undefined = não mexe. */
export interface LeadEnrichmentUpdate {
  phone?: string;
  phoneSource?: string;
  whatsapp?: string;
  whatsappStatus?: WhatsappStatus;
  whatsappSource?: string;
  email?: string;
  emailSource?: string;
  instagram?: string;
  instagramSource?: string;
  facebook?: string;
  linkedin?: string;
  enrichmentStatus?: EnrichmentStatus;
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
  // Nulo quando o sinal não pode ser verificado (site fora do ar, por exemplo).
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

/** Grava a análise, atualiza a situação do site e registra a atividade. */
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

/** Linha da exportação CSV. */
export interface LeadExportRow {
  provider: string;
  externalId: string | null;
  name: string;
  category: string | null;
  phone: string | null;
  whatsapp: string | null;
  whatsappStatus: WhatsappStatus;
  email: string | null;
  website: string | null;
  websiteStatus: WebsiteStatus;
  instagram: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  score: number;
  status: LeadStatus;
}

/** Leitura única e limitada para exportar - nunca carrega a base inteira. */
export async function findLeadsForExport(
  filters: LeadFilters,
  maxRows: number,
): Promise<LeadExportRow[]> {
  try {
    return await prisma.lead.findMany({
      where: buildLeadWhere(filters),
      orderBy: buildOrderBy(filters.sort),
      take: filters.max ? Math.min(maxRows, filters.max) : maxRows,
      select: {
        provider: true,
        externalId: true,
        name: true,
        category: true,
        phone: true,
        whatsapp: true,
        whatsappStatus: true,
        email: true,
        website: true,
        websiteStatus: true,
        instagram: true,
        address: true,
        neighborhood: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
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
  provider: string;
  model: string;
  inputHash: string;
  score: number;
  opportunity: ScoreLevel;
  scoreReason: string;
  websiteQuality: WebsiteQuality;
  confidence: number;
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

const AI_ANALYSIS_SELECT = {
  provider: true,
  model: true,
  inputHash: true,
  score: true,
  opportunity: true,
  scoreReason: true,
  websiteQuality: true,
  confidence: true,
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
} satisfies Prisma.LeadAiAnalysisSelect;

export async function findAiAnalysis(leadId: string): Promise<StoredAiAnalysisRow | null> {
  try {
    return await prisma.leadAiAnalysis.findUnique({
      where: { leadId },
      select: AI_ANALYSIS_SELECT,
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

/** Anotações livres do lead (CRM). Guarda também no histórico de atividades. */
export async function updateLeadNotes(leadId: string, notes: string | null): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.lead.update({ where: { id: leadId }, data: { notes } }),
      prisma.leadActivity.create({
        data: {
          leadId,
          type: "NOTE",
          message: notes ? "Anotações atualizadas" : "Anotações removidas",
        },
      }),
    ]);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/**
 * Leads com coordenadas, para o mapa. Select mínimo e teto de pontos: um mapa
 * com milhares de marcadores trava o navegador e não ajuda ninguém.
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

    // O select garante coordenadas, mas o tipo do Prisma ainda as vê como
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

