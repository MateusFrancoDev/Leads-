/**
 * Tipos de domínio do lead.
 *
 * Os enums vem do schema Prisma (generated/prisma/enums e um arquivo de
 * constantes puras, seguro de importar também em Client Components).
 * Aqui adicionamos ordem de exibição e rótulos em português.
 */

import {
  EnrichmentStatus,
  LeadStatus,
  ScoreLevel,
  WebsiteStatus,
  WhatsappStatus,
} from "@/generated/prisma/enums";

export { EnrichmentStatus, LeadStatus, ScoreLevel, WebsiteStatus, WhatsappStatus };

export type Tone = "positive" | "negative" | "warning" | "neutral";

export const LEAD_STATUS_ORDER: readonly LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.QUALIFIED,
  LeadStatus.CONTACTED,
  LeadStatus.RESPONDED,
  LeadStatus.INTERESTED,
  LeadStatus.PROPOSAL_SENT,
  LeadStatus.CLIENT,
  LeadStatus.DISCARDED,
  LeadStatus.INVALID,
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Novo",
  QUALIFIED: "Qualificado",
  CONTACTED: "Contatado",
  RESPONDED: "Respondeu",
  INTERESTED: "Interessado",
  PROPOSAL_SENT: "Proposta enviada",
  CLIENT: "Cliente",
  DISCARDED: "Descartado",
  INVALID: "Inválido",
};

/**
 * Rótulos do site. "Site não informado" e "Não verificado" nunca dizem que a
 * empresa não tem site: só "Sem site (confirmado)" afirma isso.
 */
export const WEBSITE_STATUS_LABELS: Record<WebsiteStatus, string> = {
  HAS_WEBSITE: "Site encontrado",
  NO_WEBSITE: "Sem site (confirmado)",
  NOT_PROVIDED: "Site não informado",
  SOCIAL_ONLY: "Site não informado",
  INVALID_WEBSITE: "Site inválido na fonte",
  UNREACHABLE_WEBSITE: "Site fora do ar",
  UNKNOWN: "Não verificado",
};

/** Explicação exibida ao passar o mouse sobre a situação do site. */
export const WEBSITE_STATUS_HINTS: Record<WebsiteStatus, string> = {
  HAS_WEBSITE: "A fonte ou o próprio site informou este endereço.",
  NO_WEBSITE: "Ausência de site comprovada.",
  NOT_PROVIDED:
    "A fonte não informa site para esta empresa. Isso não prova que ela não tenha um - confira antes do contato.",
  SOCIAL_ONLY: "A fonte só informou rede social. Isso não prova que a empresa não tenha site.",
  INVALID_WEBSITE: "O endereço de site cadastrado na fonte não é uma URL válida.",
  UNREACHABLE_WEBSITE: "O site cadastrado não respondeu na última análise.",
  UNKNOWN: "Nenhuma fonte foi consultada sobre o site desta empresa.",
};

/** Como cada situação de site deve ser lida pelo usuário (nunca só por cor). */
export const WEBSITE_STATUS_TONE: Record<WebsiteStatus, Tone> = {
  HAS_WEBSITE: "positive",
  NO_WEBSITE: "negative",
  NOT_PROVIDED: "warning",
  SOCIAL_ONLY: "warning",
  INVALID_WEBSITE: "warning",
  UNREACHABLE_WEBSITE: "warning",
  UNKNOWN: "neutral",
};

export const WHATSAPP_STATUS_LABELS: Record<WhatsappStatus, string> = {
  CONFIRMED: "Confirmado",
  POSSIBLE: "Possível",
  UNKNOWN: "Não encontrado",
};

export const WHATSAPP_STATUS_HINTS: Record<WhatsappStatus, string> = {
  CONFIRMED: "Link do WhatsApp no site oficial ou contato de WhatsApp informado na fonte.",
  POSSIBLE: "Há um número de celular, mas nada confirma que ele usa WhatsApp.",
  UNKNOWN: "Nenhum sinal de WhatsApp nas fontes consultadas.",
};

export const WHATSAPP_STATUS_TONE: Record<WhatsappStatus, Tone> = {
  CONFIRMED: "positive",
  POSSIBLE: "warning",
  UNKNOWN: "neutral",
};

export const ENRICHMENT_STATUS_LABELS: Record<EnrichmentStatus, string> = {
  PENDING: "Pendente",
  COMPLETED: "Concluído",
  PARTIAL: "Parcial",
  FAILED: "Site não respondeu",
};

/** Nome legível da fonte que descobriu o lead. */
export function leadSourceLabel(provider: string): string {
  if (provider === "openstreetmap") return "OpenStreetMap";
  if (provider === "receita_federal") return "Receita Federal (CNPJ)";
  if (provider === "google_places") return "Google Places (legado)";
  return provider;
}

/** Origem de um contato: fonte de empresas ou site oficial. */
export function contactSourceLabel(source: string | null): string | null {
  if (!source) return null;
  if (source === "website") return "site oficial";
  return leadSourceLabel(source);
}

export const SCORE_LEVEL_LABELS: Record<ScoreLevel, string> = {
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
};

/** Situações em que nenhum site próprio é conhecido (sem afirmar que não existe). */
export const WEBSITE_STATUSES_WITHOUT_KNOWN_SITE: readonly WebsiteStatus[] = [
  WebsiteStatus.NOT_PROVIDED,
  WebsiteStatus.NO_WEBSITE,
  WebsiteStatus.SOCIAL_ONLY,
];

/** Colunas carregadas na tabela de leads. Mantém o select do Prisma enxuto. */
export interface LeadListItem {
  id: string;
  provider: string;
  name: string;
  category: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  whatsapp: string | null;
  whatsappStatus: WhatsappStatus;
  email: string | null;
  website: string | null;
  websiteStatus: WebsiteStatus;
  instagram: string | null;
  score: number;
  scoreLevel: ScoreLevel;
  status: LeadStatus;
  isFavorite: boolean;
}

/** Tudo que a página de detalhes mostra. */
export interface LeadDetail extends LeadListItem {
  externalId: string | null;
  facebook: string | null;
  linkedin: string | null;
  address: string | null;
  street: string | null;
  number: string | null;
  country: string | null;
  postalCode: string | null;
  phoneSource: string | null;
  whatsappSource: string | null;
  emailSource: string | null;
  websiteSource: string | null;
  instagramSource: string | null;
  enrichmentStatus: EnrichmentStatus;
  scoreReasons: string[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt: Date | null;
  enrichedAt: Date | null;
}

/** Ponto no mapa. Só o mínimo para desenhar e identificar o marcador. */
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
  withoutKnownWebsite: number;
  highScore: number;
  new: number;
  contacted: number;
  interested: number;
  clients: number;
  enriched: number;
}
