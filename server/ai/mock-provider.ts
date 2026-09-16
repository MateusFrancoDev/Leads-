/**
 * Analise ficticia para desenvolver a interface sem gastar token.
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
      problems.push("A empresa nao tem um site proprio funcionando.");
    }
    if (!input.temEmail) problems.push("Nenhum e-mail publico de contato.");
    if (!input.temWhatsapp) problems.push("Sem WhatsApp divulgado.");
    for (const issue of input.site?.problemas.slice(0, 2) ?? []) {
      problems.push(issue);
    }

    return {
      model: "mock",
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 },
      analysis: {
        summary: `${input.nome} tem reputacao boa e presenca digital fraca.`,
        problems: problems.slice(0, 5),
        opportunities: [
          "Transformar as avaliacoes positivas em prova social em uma pagina propria.",
          "Captar contatos por WhatsApp direto do Google.",
        ],
        services: ["Site institucional com captacao", "Otimizacao do perfil no Google"],
        approach: `Comentar a nota ${input.nota ?? "-"} com ${input.avaliacoes ?? 0} avaliacoes e perguntar como acompanham hoje quem procura a empresa pelo Google.`,
      },
    };
  }
}
