/**
 * Tradução entre os status públicos (API, LeadResult) e os enums do banco.
 *
 * O banco é mais detalhado que a API: distingue "site não informado na fonte"
 * (NOT_PROVIDED) de "nunca verificado" (UNKNOWN) e guarda estados legados.
 * Para quem consome a API, os dois continuam sendo "not_checked" - nenhum
 * deles prova que a empresa não tem site.
 */

import {
  EnrichmentStatus,
  WebsiteStatus,
  WhatsappStatus,
} from "@/generated/prisma/enums";
import type {
  LeadEnrichmentStatus,
  LeadWebsiteStatus,
  LeadWhatsappStatus,
} from "@/lib/leads/types";

/** Estados do banco que cada status público representa (usado nos filtros). */
export const WEBSITE_STATUS_GROUPS: Readonly<Record<LeadWebsiteStatus, readonly WebsiteStatus[]>> = {
  found: [WebsiteStatus.HAS_WEBSITE, WebsiteStatus.UNREACHABLE_WEBSITE],
  not_found: [WebsiteStatus.NO_WEBSITE],
  not_checked: [
    WebsiteStatus.NOT_PROVIDED,
    WebsiteStatus.UNKNOWN,
    WebsiteStatus.SOCIAL_ONLY,
    WebsiteStatus.INVALID_WEBSITE,
  ],
};

export function toPublicWebsiteStatus(status: WebsiteStatus): LeadWebsiteStatus {
  if (WEBSITE_STATUS_GROUPS.found.includes(status)) return "found";
  if (WEBSITE_STATUS_GROUPS.not_found.includes(status)) return "not_found";
  return "not_checked";
}

/**
 * Status do banco para um resultado vindo de uma fonte. "not_checked" de uma
 * fonte consultada vira NOT_PROVIDED: a fonte foi lida e não informou site.
 */
export function toDbWebsiteStatus(status: LeadWebsiteStatus): WebsiteStatus {
  if (status === "found") return WebsiteStatus.HAS_WEBSITE;
  if (status === "not_found") return WebsiteStatus.NO_WEBSITE;
  return WebsiteStatus.NOT_PROVIDED;
}

const WHATSAPP_TO_DB: Readonly<Record<LeadWhatsappStatus, WhatsappStatus>> = {
  confirmed: WhatsappStatus.CONFIRMED,
  possible: WhatsappStatus.POSSIBLE,
  unknown: WhatsappStatus.UNKNOWN,
};

export function toDbWhatsappStatus(status: LeadWhatsappStatus): WhatsappStatus {
  return WHATSAPP_TO_DB[status];
}

export function toPublicWhatsappStatus(status: WhatsappStatus): LeadWhatsappStatus {
  return status.toLowerCase() as LeadWhatsappStatus;
}

const ENRICHMENT_TO_DB: Readonly<Record<LeadEnrichmentStatus, EnrichmentStatus>> = {
  pending: EnrichmentStatus.PENDING,
  completed: EnrichmentStatus.COMPLETED,
  partial: EnrichmentStatus.PARTIAL,
  failed: EnrichmentStatus.FAILED,
};

export function toDbEnrichmentStatus(status: LeadEnrichmentStatus): EnrichmentStatus {
  return ENRICHMENT_TO_DB[status];
}

export function toPublicEnrichmentStatus(status: EnrichmentStatus): LeadEnrichmentStatus {
  return status.toLowerCase() as LeadEnrichmentStatus;
}
