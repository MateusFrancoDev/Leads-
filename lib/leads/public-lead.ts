/**
 * Formato do lead devolvido pela API (POST /api/leads/search).
 * Segue o modelo LeadResult, com os status em minúsculas e sem campos internos.
 */

import type { EnrichmentStatus, LeadStatus, ScoreLevel, WebsiteStatus, WhatsappStatus } from "@/generated/prisma/enums";
import { buildLocationUrl, buildOsmElementUrl } from "@/lib/leads/location";
import { buildSourceRecordUrl } from "@/lib/leads/source-links";
import { toPublicEnrichmentStatus, toPublicWebsiteStatus, toPublicWhatsappStatus } from "@/lib/leads/status";
import type { ContactSource, LeadResult, LeadSource } from "@/lib/leads/types";

export interface PublicLeadRow {
  id: string;
  provider: string;
  externalId: string | null;
  name: string;
  category: string | null;
  address: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  websiteStatus: WebsiteStatus;
  whatsappStatus: WhatsappStatus;
  enrichmentStatus: EnrichmentStatus;
  phoneSource: string | null;
  emailSource: string | null;
  websiteSource: string | null;
  instagramSource: string | null;
  whatsappSource: string | null;
  score: number;
  scoreLevel: ScoreLevel;
  scoreReasons: string[];
  status: LeadStatus;
  rawData: unknown;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt: Date | null;
}

export interface PublicLead extends Omit<LeadResult, "source" | "externalId" | "rawData"> {
  id: string;
  source: LeadSource | string;
  externalId: string | null;
  /** Situação detalhada do banco (ex.: NOT_PROVIDED), além do status público. */
  websiteStatusDetail: WebsiteStatus;
  locationUrl: string | null;
  /** Onde conferir o registro original (OpenStreetMap ou consulta de CNPJ). */
  sourceUrl: string | null;
  score: number;
  scoreLevel: ScoreLevel;
  scoreReasons: string[];
  crmStatus: LeadStatus;
  rawData: unknown;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
}

function asContactSource(value: string | null): ContactSource | null {
  return value === "openstreetmap" || value === "receita_federal" || value === "website" ? value : null;
}

export function toPublicLead(row: PublicLeadRow): PublicLead {
  return {
    id: row.id,
    externalId: row.externalId,
    source: row.provider,
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
    osmUrl: row.provider === "openstreetmap" ? buildOsmElementUrl(row.externalId) : null,
    locationUrl: buildLocationUrl(row.latitude, row.longitude),
    sourceUrl: buildSourceRecordUrl(row.provider, row.externalId),
    websiteStatus: toPublicWebsiteStatus(row.websiteStatus),
    websiteStatusDetail: row.websiteStatus,
    whatsappStatus: toPublicWhatsappStatus(row.whatsappStatus),
    enrichmentStatus: toPublicEnrichmentStatus(row.enrichmentStatus),
    phoneSource: asContactSource(row.phoneSource),
    emailSource: asContactSource(row.emailSource),
    websiteSource: asContactSource(row.websiteSource),
    instagramSource: asContactSource(row.instagramSource),
    whatsappSource: asContactSource(row.whatsappSource),
    score: row.score,
    scoreLevel: row.scoreLevel,
    scoreReasons: row.scoreReasons,
    crmStatus: row.status,
    rawData: row.rawData,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
  };
}
