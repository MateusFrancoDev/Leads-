/**
 * Registro dos provedores de IA, no mesmo formato dos providers de leads.
 *
 * Trocar Gemini por Anthropic (ou por um provider futuro) é mudar AI_PROVIDER
 * no .env e acrescentar uma classe aqui: services, actions, rotas e interface
 * falam apenas com a interface AiProvider.
 */

import { AppError } from "@/lib/errors";
import { isAiConfigured, serverConfig, type AiProviderName } from "@/server/config";
import { AnthropicAiProvider } from "@/server/ai/anthropic-provider";
import { GeminiAiProvider } from "@/server/ai/gemini-provider";
import { MockAiProvider } from "@/server/ai/mock-provider";
import type { AiProvider } from "@/types/ai";

const FACTORIES: Record<Exclude<AiProviderName, "none">, () => AiProvider> = {
  gemini: () => new GeminiAiProvider(),
  anthropic: () => new AnthropicAiProvider(),
  mock: () => new MockAiProvider(),
};

let instance: AiProvider | null = null;

/** null quando AI_PROVIDER="none": a funcionalidade fica simplesmente desligada. */
export function getAiProvider(): AiProvider | null {
  const name = serverConfig.ai.provider;
  if (name === "none") return null;
  instance ??= FACTORIES[name]();
  return instance;
}

export function isAiEnabled(): boolean {
  return isAiConfigured();
}

export function getActiveAiProvider(): AiProvider {
  const provider = getAiProvider();
  if (!provider || !provider.isConfigured()) {
    throw new AppError(
      "PROVIDER_NOT_CONFIGURED",
      "A análise por IA está desligada. Configure AI_PROVIDER e a chave correspondente no .env.",
    );
  }
  return provider;
}
