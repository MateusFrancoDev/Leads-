/**
 * Converte o retorno cru de um provider no formato que o banco espera:
 * normaliza contatos, separa site de rede social e calcula o Lead Score.
 * Usado pela busca e, futuramente, pelo enriquecimento.
 */

import {
  buildDedupeKey,
  cleanupText,
  isBrazilianMobile,
  normalizeCity,
  normalizeEmail,
  normalizePhone,
  normalizeState,
} from "@/lib/normalize";
import type { LeadUpsertInput } from "@/server/repositories/lead-repository";
import { calculateLeadScore } from "@/server/services/lead-scoring";
import { classifyWebsite } from "@/server/services/website-classifier";
import type { ProviderBusiness, ProviderBusinessDetails } from "@/types/provider";

function hasSocialLinks(business: ProviderBusiness | ProviderBusinessDetails): string[] {
  return "socialLinks" in business ? business.socialLinks : [];
}

function isDetails(
  business: ProviderBusiness | ProviderBusinessDetails,
): business is ProviderBusinessDetails {
  return "email" in business;
}

export function toLeadUpsertInput(
  provider: string,
  business: ProviderBusiness | ProviderBusinessDetails,
): LeadUpsertInput {
  const name = cleanupText(business.name) ?? business.name;
  const phone = normalizePhone(business.phone);
  const whatsapp = isBrazilianMobile(phone) ? phone : null;
  const email = isDetails(business) ? normalizeEmail(business.email) : null;
  const site = classifyWebsite(business.website, hasSocialLinks(business));

  const city = normalizeCity(business.city);
  const state = normalizeState(business.state);
  const address = cleanupText(business.address);

  const score = calculateLeadScore({
    websiteStatus: site.websiteStatus,
    phone,
    whatsapp,
    instagram: site.instagram,
    email,
    rating: business.rating,
    reviewsCount: business.reviewsCount,
  });

  return {
    provider,
    externalId: cleanupText(business.externalId),
    dedupeKey: buildDedupeKey({ name, phone, city, address }),
    name,
    category: cleanupText(business.category),
    phone,
    whatsapp,
    email,
    website: site.website,
    websiteDomain: site.websiteDomain,
    websiteStatus: site.websiteStatus,
    instagram: site.instagram,
    facebook: site.facebook,
    linkedin: site.linkedin,
    address,
    neighborhood: normalizeCity(business.neighborhood),
    city,
    state,
    country: cleanupText(business.country) ?? "BR",
    postalCode: cleanupText(business.postalCode),
    latitude: business.latitude,
    longitude: business.longitude,
    rating: business.rating,
    reviewsCount: business.reviewsCount,
    score: score.score,
    scoreLevel: score.level,
    scoreReasons: score.reasons,
  };
}

/** Remove repetidos do mesmo lote antes de tocar no banco. */
export function dedupeLeadInputs(inputs: readonly LeadUpsertInput[]): LeadUpsertInput[] {
  const byKey = new Map<string, LeadUpsertInput>();
  for (const input of inputs) {
    const key = input.externalId ? `${input.provider}:${input.externalId}` : input.dedupeKey;
    if (!byKey.has(key) && !byKey.has(input.dedupeKey)) {
      byKey.set(key, input);
      if (key !== input.dedupeKey) byKey.set(input.dedupeKey, input);
    }
  }
  return [...new Set(byKey.values())];
}
