/**
 * Provider de desenvolvimento: gera empresas ficticias de forma deterministica
 * (mesma busca = mesmo resultado) para trabalhar na interface, no cache e na
 * deduplicacao sem gastar nenhuma requisicao paga.
 *
 * Ativado com LEAD_PROVIDER="mock".
 */

import { normalizeCity, normalizeState, slugify } from "@/lib/normalize";
import type {
  LeadProvider,
  ProviderBusiness,
  ProviderBusinessDetails,
  ProviderResponse,
  ProviderSearchParams,
} from "@/types/provider";

const SUFFIXES = [
  "Prime",
  "Center",
  "Express",
  "Studio",
  "Premium",
  "Vip",
  "House",
  "Care",
  "Lab",
  "Hub",
];

const STREETS = ["Av. Brasil", "Rua das Flores", "Av. dos Autonomistas", "Rua Antonio Agu", "Av. Paulista"];
const NEIGHBORHOODS = ["Centro", "Jardim das Flores", "Vila Nova", "Presidente Altino", "Bela Vista"];

/** PRNG simples e estavel (mulberry32) a partir de uma semente textual. */
function createRandom(seed: string): () => number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }
  let state = hash >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export class MockProvider implements LeadProvider {
  readonly name = "mock";

  isConfigured(): boolean {
    return true;
  }

  async searchBusinesses(
    params: ProviderSearchParams,
  ): Promise<ProviderResponse<ProviderBusiness[]>> {
    const seed = slugify([params.term, params.city, params.state].filter(Boolean).join("-"));
    const random = createRandom(seed);
    const city = normalizeCity(params.city) ?? "Osasco";
    const state = normalizeState(params.state) ?? "SP";
    const total = Math.min(params.limit, 12 + Math.floor(random() * 9));

    const businesses: ProviderBusiness[] = Array.from({ length: total }, (_, index) => {
      const name = `${titleCase(params.term.split(" ")[0])} ${pick(random, SUFFIXES)} ${index + 1}`;
      const draw = random();
      const hasWebsite = draw > 0.55;
      const socialOnly = !hasWebsite && draw > 0.3;
      const handle = slugify(name);

      return {
        externalId: `mock_${seed}_${index}`,
        name,
        category: titleCase(params.term),
        phone: draw > 0.15 ? `119${Math.floor(10_000_000 + random() * 89_999_999)}` : null,
        website: hasWebsite
          ? `https://www.${handle}.com.br`
          : socialOnly
            ? `https://www.instagram.com/${handle}`
            : null,
        address: `${pick(random, STREETS)}, ${Math.floor(random() * 2000) + 1}`,
        neighborhood: pick(random, NEIGHBORHOODS),
        city,
        state,
        country: "BR",
        postalCode: null,
        latitude: -23.5 + random(),
        longitude: -46.8 + random(),
        rating: Number((3 + random() * 2).toFixed(1)),
        reviewsCount: Math.floor(random() * 320),
      };
    });

    return { data: businesses, requests: 0 };
  }

  async getBusinessDetails(
    externalId: string,
  ): Promise<ProviderResponse<ProviderBusinessDetails | null>> {
    const random = createRandom(externalId);
    const handle = externalId.replace(/[^a-z0-9]/gi, "");
    return {
      data: {
        externalId,
        name: `Empresa ${handle.slice(-4)}`,
        category: null,
        phone: null,
        website: null,
        address: null,
        neighborhood: null,
        city: null,
        state: null,
        country: "BR",
        postalCode: null,
        latitude: null,
        longitude: null,
        rating: null,
        reviewsCount: null,
        email: random() > 0.5 ? `contato@${handle}.com.br` : null,
        socialLinks: [`https://www.instagram.com/${handle}`],
      },
      requests: 0,
    };
  }
}
