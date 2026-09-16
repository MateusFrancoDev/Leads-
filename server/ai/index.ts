/** Registro dos provedores de IA, no mesmo formato dos providers de leads. */

import { AppError } from "@/lib/errors";
import { serverConfig } from "@/server/config";
import { AnthropicAiProvider } from "@/server/ai/anthropic-provider";
import { MockAiProvider } from "@/server/ai/mock-provider";
import type { AiProvider } from "@/types/ai";

let instance: AiProvider | null = null;

/** null quando AI_PROVIDER="none": a funcionalidade fica simplesmente desligada. */
export function getAiProvider(): AiProvider | null {
  if (serverConfig.ai.provider === "none") return null;
  if (instance) return instance;

  instance =
    serverConfig.ai.provider === "anthropic" ? new AnthropicAiProvider() : new MockAiProvider();
  return instance;
}

export function isAiEnabled(): boolean {
  const provider = getAiProvider();
  return provider !== null && provider.isConfigured();
}

export function getActiveAiProvider(): AiProvider {
  const provider = getAiProvider();
  if (!provider || !provider.isConfigured()) throw new AppError("PROVIDER_NOT_CONFIGURED");
  return provider;
}
