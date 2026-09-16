/**
 * Enriquecimento sob demanda de um lead.
 *
 * Regras de custo:
 * - so roda quando o usuario pede (nunca em massa, nunca na busca);
 * - respeita ENRICHMENT_TTL_HOURS: um lead enriquecido ha pouco nao volta a API;
 * - so preenche campos vazios - dado ja obtido nao e buscado de novo;
 * - a leitura do proprio site (gratuita) tem prioridade sobre a chamada paga.
 */

import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import {
  detectSocialPlatform,
  isBrazilianMobile,
  normalizeEmail,
  normalizePhone,
  normalizeUrl,
} from "@/lib/normalize";
import { serverConfig } from "@/server/config";
import { getActiveProvider } from "@/server/providers";
import {
  applyLeadEnrichment,
  findLeadById,
  type LeadEnrichmentUpdate,
} from "@/server/repositories/lead-repository";
import { recordApiUsage } from "@/server/repositories/search-repository";
import { refreshLeadScore } from "@/server/services/lead-score-refresh";
import { analyzeWebsite } from "@/server/services/website-analyzer";
import type { LeadDetail } from "@/types/lead";

const logger = createLogger("lead-enrichment");

export type EnrichmentOutcome =
  | { status: "enriched"; fields: string[]; providerRequests: number; score: number }
  | { status: "skipped"; reason: "recent" | "nothing-new"; providerRequests: number };

/** Rotulos usados na mensagem de atividade e no retorno para a interface. */
const FIELD_LABELS: Record<keyof LeadEnrichmentUpdate, string> = {
  phone: "telefone",
  whatsapp: "WhatsApp",
  email: "e-mail",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  website: "site",
  websiteDomain: "dominio",
  websiteStatus: "situacao do site",
};

function isRecent(enrichedAt: Date | null): boolean {
  if (!enrichedAt) return false;
  return Date.now() - enrichedAt.getTime() < serverConfig.enrichmentTtlMs;
}

/** Guarda a rede social encontrada, sem sobrescrever o que o lead ja tem. */
function collectSocials(lead: LeadDetail, links: readonly string[], update: LeadEnrichmentUpdate) {
  for (const link of links) {
    const url = normalizeUrl(link);
    if (!url) continue;
    const platform = detectSocialPlatform(url);
    if (platform === "instagram" && !lead.instagram && !update.instagram) update.instagram = url;
    if (platform === "facebook" && !lead.facebook && !update.facebook) update.facebook = url;
    if (platform === "linkedin" && !lead.linkedin && !update.linkedin) update.linkedin = url;
  }
}

export async function enrichLead(leadId: string): Promise<EnrichmentOutcome> {
  const lead = await findLeadById(leadId);
  if (!lead) throw new AppError("NOT_FOUND");
  if (isRecent(lead.enrichedAt)) {
    return { status: "skipped", reason: "recent", providerRequests: 0 };
  }

  const update: LeadEnrichmentUpdate = {};
  let providerRequests = 0;

  // 1) Fonte gratuita: o proprio site da empresa costuma expor e-mail e redes.
  if (lead.website) {
    const analysis = await analyzeWebsite(lead.website);
    const email = normalizeEmail(analysis.email);
    if (email && !lead.email) update.email = email;
    collectSocials(lead, analysis.socialLinks, update);
  }

  // 2) Fonte paga: so quando ainda falta e-mail ou telefone e existe id no
  // provider. Lead com os dois contatos completos nao gasta requisicao.
  const missingEmail = !lead.email && !update.email;
  const missingPhone = !lead.phone && !update.phone;
  if (lead.externalId && (missingEmail || missingPhone)) {
    const provider = getActiveProvider();
    try {
      const response = await provider.getBusinessDetails(lead.externalId);
      providerRequests = response.requests;

      const details = response.data;
      if (details) {
        const phone = normalizePhone(details.phone);
        if (phone && !lead.phone) {
          update.phone = phone;
          if (isBrazilianMobile(phone) && !lead.whatsapp) update.whatsapp = phone;
        }
        const email = normalizeEmail(details.email);
        if (email && !lead.email && !update.email) update.email = email;
        collectSocials(lead, details.socialLinks, update);
      }

      await recordApiUsage({
        provider: provider.name,
        operation: "getBusinessDetails",
        requests: providerRequests,
        items: details ? 1 : 0,
        success: true,
      });
    } catch (error) {
      await recordApiUsage({
        provider: provider.name,
        operation: "getBusinessDetails",
        requests: providerRequests,
        items: 0,
        success: false,
      });
      throw error;
    }
  }

  const fields = (Object.keys(update) as Array<keyof LeadEnrichmentUpdate>).map(
    (key) => FIELD_LABELS[key],
  );

  if (fields.length === 0) {
    // Ainda assim marcamos a tentativa: evita repetir a busca em seguida.
    await applyLeadEnrichment(leadId, {}, "Enriquecimento sem novos dados");
    return { status: "skipped", reason: "nothing-new", providerRequests };
  }

  await applyLeadEnrichment(leadId, update, `Enriquecido: ${fields.join(", ")}`);
  const score = await refreshLeadScore(leadId);

  logger.info("lead enriquecido", { leadId, campos: fields.length, providerRequests });
  return { status: "enriched", fields, providerRequests, score: score.score };
}
