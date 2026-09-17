/**
 * Análise fictícia para desenvolver a interface sem gastar token.
 * Ativada com AI_PROVIDER="mock".
 *
 * Só monta frases a partir dos sinais que recebeu - não inventa nenhum dado da
 * empresa, pela mesma razão que o prompt proíbe o modelo de inventar.
 */

import { opportunityFromScore } from "@/server/ai/analysis-contract";
import type { AiAnalysisResponse, AiLeadInput, AiProvider } from "@/types/ai";

export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  isConfigured(): boolean {
    return true;
  }

  async analyzeOpportunity(input: AiLeadInput): Promise<AiAnalysisResponse> {
    const semSiteConhecido = input.situacaoDoSite !== "HAS_WEBSITE";

    const problems: string[] = [];
    if (semSiteConhecido) {
      problems.push("Nenhum site próprio informado nas fontes consultadas.");
    }
    if (!input.temEmail) problems.push("Nenhum e-mail público de contato.");
    if (input.situacaoDoWhatsapp !== "CONFIRMED") problems.push("WhatsApp não confirmado.");
    for (const issue of input.site?.problemas.slice(0, 2) ?? []) {
      problems.push(issue);
    }

    // Espelha a lógica do prompt: sem site e com telefone é a melhor combinação.
    const score = Math.min(
      100,
      (semSiteConhecido ? 45 : 20) +
        (input.temTelefone ? 25 : 0) +
        (input.situacaoDoWhatsapp === "CONFIRMED" ? 10 : 0) +
        (input.temEnderecoCompleto ? 10 : 0) +
        (input.site?.problemas.length ?? 0) * 5,
    );

    return {
      model: "mock",
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 },
      analysis: {
        score,
        opportunity: opportunityFromScore(score),
        scoreReason: semSiteConhecido
          ? "Empresa com contato público e nenhum site conhecido nas fontes consultadas."
          : "Empresa com site conhecido e canais de contato públicos.",
        summary: `${input.nome} tem presença física e presença digital fraca.`,
        problems: problems.slice(0, 5),
        opportunities: [
          "Criar uma página própria com endereço, horário e contato.",
          "Captar contatos por WhatsApp a partir do site.",
        ],
        services: ["Site institucional com captação", "Landing page com botão de WhatsApp"],
        approach: `Perguntar como ${input.nome} recebe hoje os contatos de quem procura a empresa na internet.`,
        confidence: 0.5,
      },
    };
  }
}
