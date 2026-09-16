/**
 * Enriquecimento sob demanda de um lead: lê de novo o site oficial.
 *
 * - Só roda quando o usuário pede e só se o lead tem site.
 * - Respeita ENRICHMENT_TTL_HOURS: site lido há pouco não é baixado de novo.
 * - Só preenche campos vazios, sempre com origem "website".
 * - Nenhuma API paga: a fonte de empresas já trouxe tudo o que tinha na busca.
 */

import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { normalizeBrazilianPhone } from "@/lib/normalize";
import { toDbEnrichmentStatus } from "@/lib/leads/status";
import { serverConfig } from "@/server/config";
import {
  applyLeadEnrichment,
  findLeadById,
  type LeadEnrichmentUpdate,
} from "@/server/repositories/lead-repository";
import { recordApiUsage } from "@/server/repositories/search-repository";
import { refreshLeadScore } from "@/server/services/lead-score-refresh";
import { crawlLeadWebsite } from "@/server/services/lead-search-service";
import { WhatsappStatus } from "@/types/lead";

const logger = createLogger("lead-enrichment");

export type EnrichmentOutcome =
  | { status: "enriched"; fields: string[]; score: number }
  | { status: "skipped"; reason: "recent" | "nothing-new" | "no-website" | "unreachable" };

const FIELD_LABELS: Partial<Record<keyof LeadEnrichmentUpdate, string>> = {
  phone: "telefone",
  whatsappStatus: "WhatsApp",
  email: "e-mail",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

function isRecent(enrichedAt: Date | null): boolean {
  if (!enrichedAt) return false;
  return Date.now() - enrichedAt.getTime() < serverConfig.enrichmentTtlMs;
}

export async function enrichLead(leadId: string): Promise<EnrichmentOutcome> {
  const lead = await findLeadById(leadId);
  if (!lead) throw new AppError("NOT_FOUND");
  if (!lead.website) return { status: "skipped", reason: "no-website" };
  if (isRecent(lead.enrichedAt) && lead.enrichmentStatus !== "FAILED") {
    return { status: "skipped", reason: "recent" };
  }
  if (!serverConfig.crawler.enabled) {
    throw new AppError("PROVIDER_NOT_CONFIGURED", "A leitura de sites está desligada (WEBSITE_CRAWLER_ENABLED).");
  }

  const crawl = await crawlLeadWebsite(lead.website);
  await recordApiUsage({
    provider: "website",
    operation: "crawl",
    requests: crawl.pagesVisited.length || 1,
    items: crawl.status === "failed" ? 0 : 1,
    success: crawl.status !== "failed",
  });

  const update: LeadEnrichmentUpdate = { enrichmentStatus: toDbEnrichmentStatus(crawl.status) };
  if (crawl.status === "failed") {
    await applyLeadEnrichment(leadId, update, "O site oficial não respondeu à leitura");
    return { status: "skipped", reason: "unreachable" };
  }

  if (!lead.email && crawl.email) {
    update.email = crawl.email;
    update.emailSource = "website";
  }
  if (!lead.phone && crawl.phone) {
    update.phone = crawl.phone;
    update.phoneSource = "website";
  }
  if (!lead.instagram && crawl.instagram) {
    update.instagram = crawl.instagram;
    update.instagramSource = "website";
  }
  if (!lead.facebook && crawl.facebook) update.facebook = crawl.facebook;
  if (!lead.linkedin && crawl.linkedin) update.linkedin = crawl.linkedin;

  if (crawl.whatsappConfirmed && lead.whatsappStatus !== WhatsappStatus.CONFIRMED) {
    update.whatsappStatus = WhatsappStatus.CONFIRMED;
    update.whatsappSource = "website";
    if (!lead.whatsapp && crawl.whatsapp) update.whatsapp = crawl.whatsapp;
  } else if (
    lead.whatsappStatus === WhatsappStatus.UNKNOWN &&
    normalizeBrazilianPhone(update.phone ?? lead.phone)?.isMobile
  ) {
    update.whatsappStatus = WhatsappStatus.POSSIBLE;
    update.whatsappSource = update.phone ? "website" : (lead.phoneSource ?? undefined);
  }

  const fields = (Object.keys(update) as Array<keyof LeadEnrichmentUpdate>)
    .map((key) => FIELD_LABELS[key])
    .filter((label): label is string => Boolean(label));

  if (fields.length === 0) {
    // Ainda assim marca a leitura: evita repetir o download em seguida.
    await applyLeadEnrichment(leadId, update, "Site oficial lido, sem dados novos");
    return { status: "skipped", reason: "nothing-new" };
  }

  await applyLeadEnrichment(leadId, update, `Encontrado no site oficial: ${fields.join(", ")}`);
  const score = await refreshLeadScore(leadId);

  logger.info("lead enriquecido", { leadId, campos: fields.length });
  return { status: "enriched", fields, score: score.score };
}
