/**
 * Deduplicação de estabelecimentos.
 *
 * Critérios, do mais forte para o mais fraco:
 *   1. mesmo id na fonte (externalId);
 *   2. mesmo telefone;
 *   3. mesmo domínio de site;
 *   4. mesmo nome + mesmo endereço (rua e número);
 *   5. mesmo nome + coordenadas próximas.
 *
 * Telefone e domínio sozinhos juntariam unidades diferentes de uma rede
 * (Drogasil Centro e Drogasil Km 18 dividem site e às vezes central). Por isso
 * eles só valem quando os pontos estão perto - ou, sem coordenadas, quando o
 * nome também bate.
 */

import { distanceInMeters, isValidCoordinate } from "@/lib/leads/location";
import type { LeadResult } from "@/lib/leads/types";
import { extractDomain, normalizeForComparison, normalizePhone } from "@/lib/normalize";

export const DEDUPE_RULES = {
  /** Telefone ou domínio iguais só contam dentro deste raio. */
  sharedContactMaxDistanceMeters: 300,
  /** Mesmo nome a esta distância é o mesmo lugar mapeado duas vezes. */
  sameNameMaxDistanceMeters: 100,
} as const;

/** Hospedagens e marketplaces cujo domínio é compartilhado por muitas empresas. */
const SHARED_DOMAINS = new Set([
  "sites.google.com",
  "google.com",
  "goo.gl",
  "bit.ly",
  "ifood.com.br",
  "aiqfome.com",
  "rappi.com.br",
  "wa.me",
  "linktr.ee",
  "wixsite.com",
  "negocio.site",
  "business.site",
  "doctoralia.com.br",
  "booksy.com",
  "facebook.com",
  "instagram.com",
]);

export type DuplicateReason = "externalId" | "phone" | "domain" | "nameAddress" | "nameNearby";

/** O mínimo que a deduplicação precisa saber de um lead (do lote ou do banco). */
export interface DedupeCandidate {
  source: string;
  externalId: string | null;
  name: string;
  phone: string | null;
  website: string | null;
  street: string | null;
  number: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface DedupeKeys {
  externalKey: string | null;
  phone: string | null;
  domain: string | null;
  name: string;
  address: string | null;
  point: { latitude: number; longitude: number } | null;
}

const STREET_ABBREVIATIONS: Readonly<Record<string, string>> = {
  r: "rua",
  av: "avenida",
  avda: "avenida",
  al: "alameda",
  tv: "travessa",
  trav: "travessa",
  estr: "estrada",
  est: "estrada",
  rod: "rodovia",
  pc: "praca",
  pca: "praca",
  lgo: "largo",
  dr: "doutor",
  prof: "professor",
  sta: "santa",
  sto: "santo",
  cel: "coronel",
  gen: "general",
  pres: "presidente",
};

/** Sufixos societários que variam entre fontes sem mudar a empresa. */
const LEGAL_SUFFIXES = new Set(["ltda", "me", "epp", "eireli", "sa", "mei"]);

export function normalizeBusinessName(name: string): string {
  const words = normalizeForComparison(name).split(" ").filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

export function normalizeStreet(street: string | null | undefined): string {
  return normalizeForComparison(street)
    .split(" ")
    .filter(Boolean)
    .map((word) => STREET_ABBREVIATIONS[word] ?? word)
    .join(" ");
}

function domainForDedupe(website: string | null): string | null {
  const domain = extractDomain(website);
  if (!domain) return null;
  const shared = [...SHARED_DOMAINS].some((item) => domain === item || domain.endsWith(`.${item}`));
  return shared ? null : domain;
}

function toKeys(lead: DedupeCandidate): DedupeKeys {
  const street = normalizeStreet(lead.street);
  const number = normalizeForComparison(lead.number).replace(/\s+/g, "");
  return {
    externalKey: lead.externalId ? `${lead.source}:${lead.externalId}` : null,
    phone: normalizePhone(lead.phone),
    domain: domainForDedupe(lead.website),
    name: normalizeBusinessName(lead.name),
    address: street && number ? `${street}|${number}` : null,
    point: isValidCoordinate(lead.latitude, lead.longitude)
      ? { latitude: lead.latitude as number, longitude: lead.longitude as number }
      : null,
  };
}

/** Nomes iguais, ou um contido no outro como palavras inteiras ("Padaria Real" x "Padaria Real Centro"). */
function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 5 && ` ${longer} `.includes(` ${shorter} `);
}

function compareKeys(a: DedupeKeys, b: DedupeKeys): DuplicateReason | null {
  if (a.externalKey && a.externalKey === b.externalKey) return "externalId";

  const distance = a.point && b.point ? distanceInMeters(a.point, b.point) : null;
  const sameName = namesMatch(a.name, b.name);
  const sharedContactIsLocal =
    distance === null ? sameName : distance <= DEDUPE_RULES.sharedContactMaxDistanceMeters;

  if (a.phone && a.phone === b.phone && sharedContactIsLocal) return "phone";
  if (a.domain && a.domain === b.domain && sharedContactIsLocal) return "domain";
  if (sameName && a.address && a.address === b.address) return "nameAddress";
  if (sameName && distance !== null && distance <= DEDUPE_RULES.sameNameMaxDistanceMeters) return "nameNearby";
  return null;
}

/** Procura, entre os candidatos, o mesmo estabelecimento que `lead`. */
export function findDuplicateLead<T extends DedupeCandidate>(
  lead: DedupeCandidate,
  candidates: readonly T[],
): { match: T; reason: DuplicateReason } | null {
  const keys = toKeys(lead);
  for (const candidate of candidates) {
    const reason = compareKeys(keys, toKeys(candidate));
    if (reason) return { match: candidate, reason };
  }
  return null;
}

const WEBSITE_RANK = { found: 2, not_found: 1, not_checked: 0 } as const;
const WHATSAPP_RANK = { confirmed: 2, possible: 1, unknown: 0 } as const;

function completeness(lead: LeadResult): number {
  return [lead.phone, lead.email, lead.website, lead.instagram, lead.street, lead.number, lead.whatsapp].filter(
    Boolean,
  ).length;
}

/**
 * Junta dois registros do mesmo lugar. Cada campo vazio do principal é
 * preenchido pelo outro junto com a sua origem - nenhum valor é criado.
 */
export function mergeLeadResults(primary: LeadResult, duplicate: LeadResult): LeadResult {
  const merged: LeadResult = { ...primary };

  const fill = <K extends keyof LeadResult>(field: K) => {
    if (merged[field] === null || merged[field] === undefined) merged[field] = duplicate[field];
  };
  const fillWithSource = (
    field: "phone" | "email" | "website" | "instagram",
    source: "phoneSource" | "emailSource" | "websiteSource" | "instagramSource",
  ) => {
    if (!merged[field] && duplicate[field]) {
      merged[field] = duplicate[field];
      merged[source] = duplicate[source];
    }
  };

  (["category", "address", "street", "number", "neighborhood", "city", "state", "postalCode", "facebook", "linkedin"] as const).forEach(fill);
  if (merged.latitude === null || merged.longitude === null) {
    merged.latitude = duplicate.latitude;
    merged.longitude = duplicate.longitude;
  }
  fillWithSource("phone", "phoneSource");
  fillWithSource("email", "emailSource");
  fillWithSource("website", "websiteSource");
  fillWithSource("instagram", "instagramSource");

  if (WEBSITE_RANK[duplicate.websiteStatus] > WEBSITE_RANK[merged.websiteStatus]) {
    merged.websiteStatus = duplicate.websiteStatus;
    if (merged.enrichmentStatus === "completed" && duplicate.enrichmentStatus === "pending") {
      merged.enrichmentStatus = "pending";
    }
  }
  if (WHATSAPP_RANK[duplicate.whatsappStatus] > WHATSAPP_RANK[merged.whatsappStatus]) {
    merged.whatsappStatus = duplicate.whatsappStatus;
    merged.whatsapp = duplicate.whatsapp ?? merged.whatsapp;
    merged.whatsappSource = duplicate.whatsappSource;
  }

  const previous = typeof merged.rawData.duplicates === "string" ? merged.rawData.duplicates.split(",") : [];
  merged.rawData = { ...merged.rawData, duplicates: [...previous, duplicate.externalId].join(",") };
  return merged;
}

/**
 * Remove repetidos de um lote. O registro mais completo fica como principal
 * e absorve os dados dos demais.
 */
export function dedupeLeadResults(leads: readonly LeadResult[]): { leads: LeadResult[]; duplicatesRemoved: number } {
  const unique: Array<{ lead: LeadResult; keys: DedupeKeys }> = [];
  let duplicatesRemoved = 0;

  for (const lead of leads) {
    const keys = toKeys(lead);
    const existing = unique.find((entry) => compareKeys(keys, entry.keys) !== null);
    if (!existing) {
      unique.push({ lead, keys });
      continue;
    }
    duplicatesRemoved += 1;
    const [primary, secondary] =
      completeness(lead) > completeness(existing.lead) ? [lead, existing.lead] : [existing.lead, lead];
    existing.lead = mergeLeadResults(primary, secondary);
    existing.keys = toKeys(existing.lead);
  }

  return { leads: unique.map((entry) => entry.lead), duplicatesRemoved };
}
