/**
 * Registro das fontes de empresas. A busca recebe um único LeadProvider que
 * consulta todas as fontes habilitadas no .env e junta os resultados.
 *
 * Só fontes reais entram aqui. Para adicionar outra fonte gratuita: crie a
 * implementação em lib/leads/providers, inclua o nome em LEAD_SOURCES e
 * acrescente-a na lista abaixo.
 */

import { AppError } from "@/lib/errors";
import { NominatimGeocoder } from "@/lib/leads/geocoding/nominatim";
import { CompositeLeadProvider } from "@/lib/leads/providers/composite";
import { OpenStreetMapProvider } from "@/lib/leads/providers/openstreetmap";
import { OverpassClient } from "@/lib/leads/providers/overpass-client";
import { ReceitaFederalProvider } from "@/lib/leads/providers/receita-federal";
import type { LeadProvider } from "@/lib/leads/types";
import { OSM_USER_AGENT, serverConfig } from "@/server/config";
import { cnpjStore } from "@/server/repositories/cnpj-repository";
import { locationCacheStore } from "@/server/repositories/location-cache-repository";

function createOpenStreetMapProvider(): OpenStreetMapProvider {
  const osm = serverConfig.openStreetMap;
  return new OpenStreetMapProvider({
    enabled: osm.enabled,
    overpassTimeoutMs: osm.overpassTimeoutMs,
    geocoder: new NominatimGeocoder({
      baseUrl: osm.nominatimUrl,
      userAgent: OSM_USER_AGENT,
      minIntervalMs: osm.nominatimMinIntervalMs,
      timeoutMs: serverConfig.external.timeoutMs,
      store: locationCacheStore,
    }),
    overpass: new OverpassClient({
      endpoints: osm.overpassEndpoints,
      timeoutMs: osm.overpassTimeoutMs,
      maxAttempts: osm.overpassMaxAttempts,
      userAgent: OSM_USER_AGENT,
    }),
  });
}

// Uma instância por processo: o controle de ritmo e o cache em memória só
// funcionam se todas as buscas passarem pelo mesmo objeto.
let instance: LeadProvider | null = null;

export function getLeadProvider(): LeadProvider {
  instance ??= new CompositeLeadProvider([
    createOpenStreetMapProvider(),
    new ReceitaFederalProvider({ enabled: serverConfig.cnpj.enabled, store: cnpjStore }),
  ]);
  return instance;
}

/** Fontes ativas, já validadas. Lança erro tipado quando todas estão desligadas no .env. */
export function getActiveProvider(): LeadProvider {
  const provider = getLeadProvider();
  if (!provider.isEnabled()) throw new AppError("PROVIDER_NOT_CONFIGURED");
  return provider;
}
