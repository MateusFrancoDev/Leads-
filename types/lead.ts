/**
 * Tipos de dominio do lead.
 *
 * Os enums vem do schema Prisma (generated/prisma/enums e um arquivo de
 * constantes puras, seguro de importar tambem em Client Components).
 * Aqui adicionamos ordem de exibicao e rotulos em portugues.
 */

import { LeadStatus, ScoreLevel, WebsiteStatus } from "@/generated/prisma/enums";

export { LeadStatus, ScoreLevel, WebsiteStatus };

export const LEAD_STATUS_ORDER: readonly LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.QUALIFIED,
  LeadStatus.CONTACTED,
  LeadStatus.RESPONDED,
  LeadStatus.INTERESTED,
  LeadStatus.CUSTOMER,
  LeadStatus.NOT_INTERESTED,
  LeadStatus.INVALID,
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Novo",
  QUALIFIED: "Qualificado",
  CONTACTED: "Contatado",
  RESPONDED: "Respondeu",
  INTERESTED: "Interessado",
  CUSTOMER: "Cliente",
  NOT_INTERESTED: "Sem interesse",
  INVALID: "Invalido",
};

export const WEBSITE_STATUS_LABELS: Record<WebsiteStatus, string> = {
  HAS_WEBSITE: "Possui site",
  NO_WEBSITE: "Sem site",
  SOCIAL_ONLY: "So rede social",
  INVALID_WEBSITE: "Site invalido",
  UNREACHABLE_WEBSITE: "Site fora do ar",
  UNKNOWN: "Nao verificado",
};

/** Como cada situacao de site deve ser lida pelo usuario (nunca so por cor). */
export const WEBSITE_STATUS_TONE: Record<WebsiteStatus, "positive" | "negative" | "warning" | "neutral"> = {
  HAS_WEBSITE: "positive",
  NO_WEBSITE: "negative",
  SOCIAL_ONLY: "warning",
  INVALID_WEBSITE: "warning",
  UNREACHABLE_WEBSITE: "warning",
  UNKNOWN: "neutral",
};

export const SCORE_LEVEL_LABELS: Record<ScoreLevel, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baixa",
};

/** Situacoes em que a empresa nao tem um site proprio funcionando. */
export const WEBSITE_STATUSES_WITHOUT_SITE: readonly WebsiteStatus[] = [
  WebsiteStatus.NO_WEBSITE,
  WebsiteStatus.SOCIAL_ONLY,
  WebsiteStatus.INVALID_WEBSITE,
  WebsiteStatus.UNREACHABLE_WEBSITE,
];

/** Colunas carregadas na tabela de leads. Mantem o select do Prisma enxuto. */
export interface LeadListItem {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  websiteStatus: WebsiteStatus;
  instagram: string | null;
  rating: number | null;
  reviewsCount: number | null;
  score: number;
  scoreLevel: ScoreLevel;
  status: LeadStatus;
  isFavorite: boolean;
}

/** Tudo que a pagina de detalhes mostra. */
export interface LeadDetail extends LeadListItem {
  provider: string;
  externalId: string | null;
  facebook: string | null;
  linkedin: string | null;
  address: string | null;
  neighborhood: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  scoreReasons: string[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt: Date | null;
  enrichedAt: Date | null;
}

/** Ponto no mapa. So o minimo para desenhar e identificar o marcador. */
export interface LeadMapPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  score: number;
  scoreLevel: ScoreLevel;
  websiteStatus: WebsiteStatus;
  phone: string | null;
}

/** Contagens do dashboard. */
export interface LeadStats {
  total: number;
  withoutWebsite: number;
  highScore: number;
  new: number;
  contacted: number;
  interested: number;
  customers: number;
  enriched: number;
}
