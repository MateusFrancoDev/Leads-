/**
 * Cache persistente das áreas de cidade resolvidas pelo Nominatim.
 * Uma cidade geocodificada uma vez serve para qualquer busca futura.
 */

import type { CityArea, CityAreaStore } from "@/lib/leads/geocoding/nominatim";
import { parseOsmExternalId } from "@/lib/leads/location";
import { prisma } from "@/server/db/prisma";

/** Limites municipais quase não mudam; depois deste prazo a área é consultada de novo. */
const LOCATION_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const locationCacheStore: CityAreaStore = {
  async get(key) {
    const row = await prisma.locationCache.findUnique({ where: { key } });
    if (!row || Date.now() - row.updatedAt.getTime() > LOCATION_CACHE_TTL_MS) return null;

    const parsed = parseOsmExternalId(`${row.osmType}/${row.osmId}`);
    if (!parsed) return null;

    const area: CityArea = {
      key: row.key,
      city: row.city,
      state: row.state,
      displayName: row.displayName,
      osmType: parsed.type,
      osmId: parsed.id,
      latitude: row.latitude,
      longitude: row.longitude,
      south: row.south,
      north: row.north,
      west: row.west,
      east: row.east,
    };
    return area;
  },

  async set(area) {
    const data = {
      city: area.city,
      state: area.state,
      displayName: area.displayName,
      osmType: area.osmType,
      osmId: area.osmId,
      latitude: area.latitude,
      longitude: area.longitude,
      south: area.south,
      north: area.north,
      west: area.west,
      east: area.east,
    };
    await prisma.locationCache.upsert({
      where: { key: area.key },
      create: { key: area.key, ...data },
      update: data,
    });
  },
};
