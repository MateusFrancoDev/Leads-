/**
 * Registro de providers. A aplicacao pede "o provider ativo" e recebe uma
 * implementacao de LeadProvider - nenhuma outra camada conhece Google Places.
 */

import { AppError } from "@/lib/errors";
import { serverConfig, type LeadProviderName } from "@/server/config";
import { GooglePlacesProvider } from "@/server/providers/google-places-provider";
import { MockProvider } from "@/server/providers/mock-provider";
import { OpenStreetMapProvider } from "@/server/providers/openstreetmap-provider";
import type { LeadProvider } from "@/types/provider";

const factories: Record<LeadProviderName, () => LeadProvider> = {
  google_places: () => new GooglePlacesProvider(),
  openstreetmap: () => new OpenStreetMapProvider(),
  mock: () => new MockProvider(),
};

const instances = new Map<LeadProviderName, LeadProvider>();

export function getProvider(name: LeadProviderName = serverConfig.provider.name): LeadProvider {
  const cached = instances.get(name);
  if (cached) return cached;

  const provider = factories[name]();
  instances.set(name, provider);
  return provider;
}

/** Provider ativo, ja validado. Lanca erro tipado quando falta configuracao. */
export function getActiveProvider(): LeadProvider {
  const provider = getProvider();
  if (!provider.isConfigured()) throw new AppError("PROVIDER_NOT_CONFIGURED");
  return provider;
}
