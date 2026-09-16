/**
 * Coordenadas e links de localização. Nenhum link depende de API do Google:
 * tudo aponta para o openstreetmap.org, que não exige chave.
 */

export const OSM_ELEMENT_TYPES = ["node", "way", "relation"] as const;
export type OsmElementType = (typeof OSM_ELEMENT_TYPES)[number];

/** Latitude/longitude numéricas, finitas e dentro dos limites do globo. */
export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    // (0, 0) é o "null island": quase sempre dado quebrado, nunca uma empresa.
    !(latitude === 0 && longitude === 0)
  );
}

/** Link para abrir o ponto no mapa. null quando as coordenadas não são válidas. */
export function buildLocationUrl(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  if (!isValidCoordinate(latitude, longitude)) return null;
  const lat = (latitude as number).toFixed(6);
  const lon = (longitude as number).toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=19/${lat}/${lon}`;
}

/** Separa "node/123" em tipo e id. null se não for um id OSM válido. */
export function parseOsmExternalId(
  externalId: string | null | undefined,
): { type: OsmElementType; id: string } | null {
  const match = /^(node|way|relation)\/(\d{1,19})$/.exec(externalId ?? "");
  if (!match) return null;
  return { type: match[1] as OsmElementType, id: match[2] };
}

/** Página do elemento no openstreetmap.org, onde qualquer um pode conferir os dados. */
export function buildOsmElementUrl(externalId: string | null | undefined): string | null {
  const parsed = parseOsmExternalId(externalId);
  return parsed ? `https://www.openstreetmap.org/${parsed.type}/${parsed.id}` : null;
}

const EARTH_RADIUS_METERS = 6_371_000;

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanceInMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}
