/**
 * Classifica o "site" informado pelo provider.
 *
 * Regra central do produto: perfil de rede social NAO e site proprio.
 * Encontrar empresas sem site depende inteiramente desta separacao.
 */

import { WebsiteStatus } from "@/types/lead";
import {
  detectSocialPlatform,
  extractDomain,
  normalizeUrl,
  type SocialPlatform,
} from "@/lib/normalize";

export interface WebsiteClassification {
  /** Site proprio (null quando so ha rede social ou nada). */
  website: string | null;
  websiteDomain: string | null;
  websiteStatus: WebsiteStatus;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
}

const EMPTY: WebsiteClassification = {
  website: null,
  websiteDomain: null,
  websiteStatus: WebsiteStatus.NO_WEBSITE,
  instagram: null,
  facebook: null,
  linkedin: null,
};

/** Guarda o link na rede social correspondente, se for uma que acompanhamos. */
function assignSocial(
  target: WebsiteClassification,
  platform: SocialPlatform,
  url: string,
): void {
  if (platform === "instagram" && !target.instagram) target.instagram = url;
  if (platform === "facebook" && !target.facebook) target.facebook = url;
  if (platform === "linkedin" && !target.linkedin) target.linkedin = url;
}

/**
 * @param rawWebsite campo "site" do provider
 * @param extraLinks outros links conhecidos (vindos do enriquecimento)
 */
export function classifyWebsite(
  rawWebsite: string | null | undefined,
  extraLinks: readonly string[] = [],
): WebsiteClassification {
  const result: WebsiteClassification = { ...EMPTY };

  for (const link of extraLinks) {
    const url = normalizeUrl(link);
    if (!url) continue;
    const platform = detectSocialPlatform(url);
    if (platform) assignSocial(result, platform, url);
  }

  const hasRawWebsite = Boolean(rawWebsite && rawWebsite.trim() !== "");
  const website = normalizeUrl(rawWebsite);

  if (!hasRawWebsite) {
    // Sem site declarado: ainda pode ser "so rede social" via links extras.
    result.websiteStatus = result.instagram || result.facebook ? WebsiteStatus.SOCIAL_ONLY : WebsiteStatus.NO_WEBSITE;
    return result;
  }

  if (!website) {
    result.websiteStatus = WebsiteStatus.INVALID_WEBSITE;
    return result;
  }

  const platform = detectSocialPlatform(website);
  if (platform) {
    assignSocial(result, platform, website);
    result.websiteStatus = WebsiteStatus.SOCIAL_ONLY;
    return result;
  }

  result.website = website;
  result.websiteDomain = extractDomain(website);
  result.websiteStatus = WebsiteStatus.HAS_WEBSITE;
  return result;
}

/** true quando a empresa nao tem um site proprio funcionando. */
export function lacksOwnWebsite(status: WebsiteStatus): boolean {
  return status !== WebsiteStatus.HAS_WEBSITE && status !== WebsiteStatus.UNKNOWN;
}
