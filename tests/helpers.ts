import type { LeadResult } from "@/lib/leads/types";

/** Lead mínimo para testes: todos os dados opcionais ausentes (null). */
export function makeLead(overrides: Partial<LeadResult> = {}): LeadResult {
  return {
    externalId: "node/1",
    source: "openstreetmap",
    name: "Empresa Teste",
    category: null,
    address: null,
    street: null,
    number: null,
    neighborhood: null,
    city: "Osasco",
    state: "SP",
    postalCode: null,
    latitude: -23.532,
    longitude: -46.7917,
    phone: null,
    whatsapp: null,
    email: null,
    website: null,
    instagram: null,
    facebook: null,
    linkedin: null,
    osmUrl: null,
    websiteStatus: "not_checked",
    whatsappStatus: "unknown",
    enrichmentStatus: "completed",
    phoneSource: null,
    emailSource: null,
    websiteSource: null,
    instagramSource: null,
    whatsappSource: null,
    rawData: {},
    ...overrides,
  };
}
