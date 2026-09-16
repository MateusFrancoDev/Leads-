/**
 * Análise fictícia para desenvolver a interface sem gastar token.
 * Ativada com AI_PROVIDER="mock".
 */

import type { AiAnalysisResponse, AiLeadInput, AiProvider } from "@/types/ai";

export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  isConfigured(): boolean {
    return true;
  }

  async analyzeOpportunity(input: AiLeadInput): Promise<AiAnalysisResponse> {
    const problems: string[] = [];
    if (input.situacaoDoSite !== "HAS_WEBSITE") {
      problems.push("Nenhum site próprio informado nas fontes consultadas.");
    }
    if (!input.temEmail) problems.push("Nenhum e-mail público de contato.");
    if (input.situacaoDoWhatsapp !== "CONFIRMED") problems.push("WhatsApp não confirmado.");
    for (const issue of input.site?.problemas.slice(0, 2) ?? []) {
      problems.push(issue);
    }

    return {
      model: "mock",
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 },
      analysis: {
        summary: `${input.nome} tem presença física e presença digital fraca.`,
        problems: problems.slice(0, 5),
        opportunities: [
          "Criar uma página própria com endereço, horário e contato.",
          "Captar contatos por WhatsApp a partir do site.",
        ],
        services: ["Site institucional com captação", "Landing page com botão de WhatsApp"],
        approach: `Perguntar como ${input.nome} recebe hoje os contatos de quem procura a empresa na internet.`,
      },
    };
  }
}
