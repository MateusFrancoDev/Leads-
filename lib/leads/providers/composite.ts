/**
 * Consulta várias fontes de empresas ao mesmo tempo e junta os resultados.
 *
 * Uma fonte fora do ar não derruba a busca: o que as outras trouxeram é
 * devolvido com um aviso. Só quando todas falham o erro chega ao usuário.
 * A deduplicação entre fontes acontece depois, no pipeline.
 */

import { userMessage } from "@/lib/errors";
import type { LeadProvider, LeadProviderResponse, LeadSearchParams, LeadSource } from "@/lib/leads/types";

const SOURCE_LABELS: Record<string, string> = {
  openstreetmap: "OpenStreetMap",
  receita_federal: "Receita Federal",
};

export class CompositeLeadProvider implements LeadProvider {
  private readonly providers: readonly LeadProvider[];

  constructor(providers: readonly LeadProvider[]) {
    this.providers = providers;
  }

  private enabled(): LeadProvider[] {
    return this.providers.filter((provider) => provider.isEnabled());
  }

  /** Muda quando o conjunto de fontes muda: o cache não mistura configurações. */
  get name(): string {
    return this.enabled()
      .map((provider) => provider.name)
      .sort()
      .join("+");
  }

  isEnabled(): boolean {
    return this.enabled().length > 0;
  }

  async search(params: LeadSearchParams): Promise<LeadProviderResponse> {
    const providers = this.enabled();
    const settled = await Promise.allSettled(providers.map((provider) => provider.search(params)));

    const merged: LeadProviderResponse = { leads: [], rawCount: 0, requests: 0, sourceCounts: {}, warnings: [] };
    let firstError: unknown = null;

    settled.forEach((result, index) => {
      const provider = providers[index];
      if (result.status === "rejected") {
        firstError ??= result.reason;
        merged.warnings.push(`${SOURCE_LABELS[provider.name] ?? provider.name}: ${userMessage(result.reason)}`);
        return;
      }
      merged.leads.push(...result.value.leads);
      merged.rawCount += result.value.rawCount;
      merged.requests += result.value.requests;
      merged.warnings.push(...result.value.warnings);
      for (const [source, count] of Object.entries(result.value.sourceCounts)) {
        const key = source as LeadSource;
        merged.sourceCounts[key] = (merged.sourceCounts[key] ?? 0) + (count ?? 0);
      }
    });

    if (firstError !== null && settled.every((result) => result.status === "rejected")) throw firstError;
    return merged;
  }
}
