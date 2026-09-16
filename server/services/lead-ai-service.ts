/**
 * Análise de oportunidade por IA, sob demanda.
 *
 * O padrão de economia e o mesmo do resto do sistema, aplicado a tokens:
 *
 *   monta entrada compacta -> calcula hash -> compara com a análise gravada
 *   -> só chama o modelo se algo mudou -> grava resultado e consumo
 *
 * Nunca roda em massa e nunca envia HTML: o que vai ao modelo e um resumo
 * estruturado do lead e dos problemas já extraidos do site.
 */

import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { serverConfig } from "@/server/config";
import { getActiveAiProvider } from "@/server/ai";
import {
  findAiAnalysis,
  findLeadById,
  findWebsiteAnalysis,
  saveAiAnalysis,
  type StoredAiAnalysisRow,
} from "@/server/repositories/lead-repository";
import { recordApiUsage } from "@/server/repositories/search-repository";
import type { AiLeadInput, StoredAiAnalysis } from "@/types/ai";
import type { LeadDetail } from "@/types/lead";
import type { StoredWebsiteAnalysis } from "@/server/repositories/lead-repository";

const logger = createLogger("lead-ai");

/** Quantos problemas do site acompanham a análise - o resto e ruído para o modelo. */
const MAX_SITE_ISSUES = 8;

function buildInput(lead: LeadDetail, site: StoredWebsiteAnalysis | null): AiLeadInput {
  const input: AiLeadInput = {
    nome: lead.name,
    ramo: lead.category,
    cidade: lead.city,
    estado: lead.state,
    situacaoDoSite: lead.websiteStatus,
    temTelefone: Boolean(lead.phone),
    situacaoDoWhatsapp: lead.whatsappStatus,
    temEmail: Boolean(lead.email),
    temInstagram: Boolean(lead.instagram),
    leadScore: lead.score,
    motivosDoScore: lead.scoreReasons,
  };

  if (site) {
    input.site = {
      titulo: site.title,
      descricao: site.description,
      problemas: site.issues.slice(0, MAX_SITE_ISSUES),
    };
  }
  return input;
}

/**
 * Hash estável da entrada. Inclui provider e modelo configurados porque uma
 * análise feita com outro modelo não pode ser reaproveitada - e o modelo que
 * respondeu (gravado em `model`) pode diferir do pedido quando entra fallback.
 */
function hashInput(input: AiLeadInput): string {
  const payload = {
    provider: serverConfig.ai.provider,
    model: serverConfig.ai.model,
    input,
  };
  return createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

function toStored(row: StoredAiAnalysisRow, currentHash: string): StoredAiAnalysis {
  return {
    model: row.model,
    summary: row.summary,
    problems: row.problems,
    opportunities: row.opportunities,
    services: row.services,
    approach: row.approach,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    costUsd: row.costUsd,
    createdAt: row.createdAt,
    isCurrent: row.inputHash === currentHash,
  };
}

/** Lê a análise gravada e diz se ela ainda corresponde aos dados atuais. */
export async function getLeadAiAnalysis(leadId: string): Promise<StoredAiAnalysis | null> {
  const [lead, site, stored] = await Promise.all([
    findLeadById(leadId),
    findWebsiteAnalysis(leadId),
    findAiAnalysis(leadId),
  ]);
  if (!lead || !stored) return null;
  return toStored(stored, hashInput(buildInput(lead, site)));
}

export type AiAnalysisOutcome =
  | { status: "analyzed"; analysis: StoredAiAnalysis }
  | { status: "skipped"; reason: "current"; analysis: StoredAiAnalysis };

export async function analyzeLeadOpportunity(leadId: string): Promise<AiAnalysisOutcome> {
  const provider = getActiveAiProvider();

  const [lead, site, stored] = await Promise.all([
    findLeadById(leadId),
    findWebsiteAnalysis(leadId),
    findAiAnalysis(leadId),
  ]);
  if (!lead) throw new AppError("NOT_FOUND");

  const input = buildInput(lead, site);
  const inputHash = hashInput(input);

  // Nada mudou desde a última análise (dados, provider e modelo): não gasta token.
  if (stored && stored.inputHash === inputHash) {
    logger.info("análise reaproveitada", { leadId });
    return { status: "skipped", reason: "current", analysis: toStored(stored, inputHash) };
  }

  try {
    const response = await provider.analyzeOpportunity(input);

    const record = {
      model: response.model,
      inputHash,
      ...response.analysis,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      cachedInputTokens: response.usage.cachedInputTokens,
      costUsd: response.usage.costUsd,
    };

    await saveAiAnalysis(leadId, record, `Oportunidade analisada por IA (${response.model})`);
    await recordApiUsage({
      provider: provider.name,
      operation: "analyzeOpportunity",
      requests: 1,
      items: 1,
      success: true,
      costUsd: response.usage.costUsd,
    });

    logger.info("análise concluida", {
      leadId,
      tokens: response.usage.inputTokens + response.usage.outputTokens,
    });

    return { status: "analyzed", analysis: toStored({ ...record, createdAt: new Date() }, inputHash) };
  } catch (error) {
    await recordApiUsage({
      provider: provider.name,
      operation: "analyzeOpportunity",
      requests: 1,
      items: 0,
      success: false,
    });
    throw error;
  }
}
