/**
 * Converte um elemento do OpenStreetMap em LeadResult.
 *
 * Cada campo vem de uma etiqueta que existe no elemento. O que não existe fica
 * null: sem site não vira "não tem site", celular não vira "tem WhatsApp",
 * nome da empresa não vira e-mail nem Instagram.
 */

import type { LeadRawData, LeadResult } from "@/lib/leads/types";
import { buildOsmElementUrl, isValidCoordinate } from "@/lib/leads/location";
import type { OverpassElement } from "@/lib/leads/providers/overpass-client";
import {
  type BrazilianPhone,
  cleanupText,
  detectSocialPlatform,
  normalizeBrazilianPhone,
  normalizeEmail,
  normalizeForComparison,
  normalizePostalCode,
  normalizeSocialProfileUrl,
  normalizeState,
  normalizeUrl,
} from "@/lib/normalize";
import { extractWhatsappNumber } from "@/lib/leads/enrichment/contact-extractor";

export interface OsmNormalizationContext {
  /** Rótulo do nicho pesquisado (ex.: "Barbearia"). */
  categoryLabel: string | null;
  /** Área consultada. */
  area: {
    city: string;
    state: string;
    /**
     * true quando a consulta usou o limite oficial do município: todo elemento
     * devolvido está, geometricamente, dentro da cidade.
     */
    isMunicipalBoundary: boolean;
  };
}

/** Etiquetas guardadas em rawData. O resto (geometria, notas de mapeamento) é descartado. */
const RAW_TAG_KEYS = new Set([
  "name", "brand", "operator", "opening_hours", "description", "check_date",
  "shop", "amenity", "office", "craft", "healthcare", "leisure", "tourism",
  "cuisine", "hairdresser", "beauty", "sport",
  "phone", "mobile", "email", "website", "url", "whatsapp", "instagram", "facebook",
]);
const RAW_TAG_PREFIXES = ["addr:", "contact:"];
const MAX_RAW_VALUE_LENGTH = 500;

function pickRawTags(tags: Readonly<Record<string, string>>): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (RAW_TAG_KEYS.has(key) || RAW_TAG_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      picked[key] = value.slice(0, MAX_RAW_VALUE_LENGTH);
    }
  }
  return picked;
}

/** Valores das etiquetas, na ordem pedida. O OSM separa múltiplos valores por ";". */
function tagValues(tags: Readonly<Record<string, string>>, keys: readonly string[]): string[] {
  return keys.flatMap((key) =>
    (tags[key] ?? "")
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function firstTag(tags: Readonly<Record<string, string>>, keys: readonly string[]): string | null {
  return tagValues(tags, keys)[0] ?? null;
}

export function normalizeOsmElement(
  element: OverpassElement,
  context: OsmNormalizationContext,
): LeadResult | null {
  const tags = element.tags;
  const type = element.type;
  if (!tags || (type !== "node" && type !== "way" && type !== "relation")) return null;
  if (typeof element.id !== "number" || !Number.isInteger(element.id) || element.id <= 0) return null;

  // Sem nome não há como abordar a empresa nem confirmar que ela existe.
  const name = cleanupText(tags.name);
  if (!name) return null;

  const externalId = `${type}/${element.id}`;
  const rawLat = element.lat ?? element.center?.lat ?? null;
  const rawLon = element.lon ?? element.center?.lon ?? null;
  const hasCoordinates = isValidCoordinate(rawLat, rawLon);

  // ---------------------------------------------------------------- contatos
  const phones = tagValues(tags, ["phone", "contact:phone", "mobile", "contact:mobile", "phone:mobile"])
    .map((value) => normalizeBrazilianPhone(value))
    .filter((item): item is BrazilianPhone => item !== null);
  const phone = phones[0]?.digits ?? null;

  let website: string | null = null;
  let instagram = normalizeSocialProfileUrl("instagram", firstTag(tags, ["contact:instagram", "instagram"]));
  let facebook = normalizeSocialProfileUrl("facebook", firstTag(tags, ["contact:facebook", "facebook"]));
  const linkedin = normalizeSocialProfileUrl("linkedin", firstTag(tags, ["contact:linkedin", "linkedin"]));

  let whatsapp: string | null = null;
  for (const value of tagValues(tags, ["contact:whatsapp", "whatsapp"])) {
    whatsapp = extractWhatsappNumber(value) ?? normalizeBrazilianPhone(value)?.digits ?? null;
    if (whatsapp) break;
  }

  // "website" às vezes aponta para rede social ou link do WhatsApp: nesse caso
  // o dado vai para o campo certo e o lead continua sem site informado.
  for (const value of tagValues(tags, ["website", "contact:website", "url"])) {
    const url = normalizeUrl(value);
    if (!url) continue;
    const platform = detectSocialPlatform(url);
    if (platform === null) {
      website = url;
      break;
    }
    if (platform === "instagram") instagram ??= normalizeSocialProfileUrl("instagram", url);
    if (platform === "facebook") facebook ??= normalizeSocialProfileUrl("facebook", url);
    if (platform === "whatsapp") whatsapp ??= extractWhatsappNumber(url);
  }

  const email = tagValues(tags, ["email", "contact:email"])
    .map((value) => normalizeEmail(value))
    .find((value) => value !== null) ?? null;

  const whatsappStatus = whatsapp ? "confirmed" : phones.some((item) => item.isMobile) ? "possible" : "unknown";

  // ---------------------------------------------------------------- endereço
  const street = cleanupText(tags["addr:street"]);
  const number = cleanupText(tags["addr:housenumber"]);
  const address = street ? (number ? `${street}, ${number}` : street) : null;
  const neighborhood = cleanupText(tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? tags["addr:quarter"]);

  const { area } = context;
  const taggedCity = cleanupText(tags["addr:city"]);
  const inSearchedCity = taggedCity
    ? normalizeForComparison(taggedCity) === normalizeForComparison(area.city)
    : area.isMunicipalBoundary;
  const city = inSearchedCity ? area.city : taggedCity;
  const state = normalizeState(tags["addr:state"]) ?? (inSearchedCity ? area.state : null);

  const rawData: LeadRawData = {
    osmType: type,
    osmId: element.id,
    tags: pickRawTags(tags),
    cityFromMunicipalBoundary: !taggedCity && area.isMunicipalBoundary,
  };

  return {
    externalId,
    source: "openstreetmap",
    name,
    category: context.categoryLabel,
    address,
    street,
    number,
    neighborhood,
    city,
    state,
    postalCode: normalizePostalCode(tags["addr:postcode"]),
    latitude: hasCoordinates ? rawLat : null,
    longitude: hasCoordinates ? rawLon : null,
    phone,
    whatsapp,
    email,
    website,
    instagram,
    facebook,
    linkedin,
    osmUrl: buildOsmElementUrl(externalId),
    websiteStatus: website ? "found" : "not_checked",
    whatsappStatus,
    // Sem site não há o que ler; com site, o crawler decide o resultado.
    enrichmentStatus: website ? "pending" : "completed",
    phoneSource: phone ? "openstreetmap" : null,
    emailSource: email ? "openstreetmap" : null,
    websiteSource: website ? "openstreetmap" : null,
    instagramSource: instagram ? "openstreetmap" : null,
    whatsappSource: whatsappStatus === "unknown" ? null : "openstreetmap",
    rawData,
  };
}
