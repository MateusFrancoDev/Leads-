/**
 * Análise de oportunidade por IA, sob demanda.
 *
 * O padrão de economia e o mesmo do resto do sistema, aplicado a tokens:
 *
 *   pré-qualifica de graça -> monta entrada compacta -> calcula hash
 *   -> compara com a análise gravada -> só chama o modelo se algo mudou
 *   -> valida a resposta -> grava resultado e consumo
 *
 * Nunca roda em massa sozinho e nunca envia HTML: o que vai ao modelo e um
 * resumo estruturado do lead e dos problemas já extraidos do site.
 *
 * Fronteira de responsabilidade: aqui a IA só CLASSIFICA. Nenhum campo de
 * contato, endereço ou site do lead é escrito com o que o modelo respondeu -
 * esses dados continuam vindo exclusivamente do lead provider e do crawler.
 */

import { createHash } from "node:crypto";
import { AppError, toAppError, userMessage } from "@/lib/errors";
import { mapWithConcurrency } from "@/lib/http";
import { createLogger } from "@/lib/logger";
import { shouldAnalyzeWithAI } from "@/lib/leads/ai-prequalify";
import { serverConfig } from "@/server/config";
import { getActiveAiProvider } from "@/server/ai";
import { ANALYSIS_CONTRACT_VERSION } from "@/server/ai/analysis-contract";
import {
  findAiAnalysis,
  findLeadById,
  findWebsiteAnalysis,
  saveAiAnalysis,
  type StoredAiAnalysisRow,
  type StoredWebsiteAnalysis,
} from "@/server/repositories/lead-repository";
import { recordApiUsage } from "@/server/repositories/search-repository";
import type { AiLeadInput, StoredAiAnalysis } from "@/types/ai";
import { WebsiteQuality, WebsiteStatus, type LeadDetail } from "@/types/lead";

const logger = createLogger("lead-ai");

/** Quantos problemas do site acompanham a análise - o resto e ruído para o modelo. */
const MAX_SITE_ISSUES = 8;

/** Teto de leads por lote, para o custo de um clique ser sempre previsível. */
export const MAX_BATCH_SIZE = 50;

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
    temEnderecoCompleto: Boolean(lead.street && lead.number && lead.city),
    leadScore: lead.score,
    motivosDoScore: lead.scoreReasons,
  };

  // Avaliações só entram quando a fonte realmente as informou.
  if (lead.rating !== null || lead.reviewsCount !== null) {
    input.avaliacao = { nota: lead.rating, quantidade: lead.reviewsCount };
  }

  // O objeto `site` só existe quando o crawler baixou a página de verdade.
  // É o que autoriza o modelo a comentar o site - sem ele, nada a dizer.
  if (site) {
    input.site = {
      titulo: site.title,
      descricao: site.description,
      temHttps: site.hasHttps,
      temVersaoMobile: site.hasViewport,
      temFormulario: site.hasContactForm,
      temWhatsapp: site.hasWhatsapp,
      problemas: site.issues.slice(0, MAX_SITE_ISSUES),
    };
  }
  return input;
}

/**
 * Hash estável da entrada. Inclui provider, modelo e versão do contrato porque
 * uma análise feita com outro modelo ou em outro formato não pode ser
 * reaproveitada - e o modelo que respondeu (gravado em `model`) pode diferir do
 * pedido quando entra fallback.
 */
function hashInput(input: AiLeadInput): string {
  const payload = {
    contract: ANALYSIS_CONTRACT_VERSION,
    provider: serverConfig.ai.provider,
    model: serverConfig.ai.model,
    input,
  };
  return createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Qualidade do site derivada dos dados, nunca do modelo.
 *
 * Sem uma análise real do site (LeadWebsiteAnalysis), a resposta é UNKNOWN -
 * é a regra do item "não invente resultados dessas verificações". Com análise,
 * a nota sai da contagem de problemas concretos que o crawler encontrou.
 */
function resolveWebsiteQuality(
  lead: LeadDetail,
  site: StoredWebsiteAnalysis | null,
): WebsiteQuality {
  if (!site || lead.websiteStatus !== WebsiteStatus.HAS_WEBSITE) return WebsiteQuality.UNKNOWN;
  // Site que não respondeu não tem qualidade avaliável, só indisponibilidade.
  if (site.httpStatus === null || site.httpStatus >= 400) return WebsiteQuality.UNKNOWN;
  if (site.issues.length === 0) return WebsiteQuality.GOOD;
  if (site.issues.length <= 2) return WebsiteQuality.AVERAGE;
  return WebsiteQuality.POOR;
}

function toStored(
  row: StoredAiAnalysisRow,
  currentHash: string,
  hasWebsite: boolean,
): StoredAiAnalysis {
  return {
    provider: row.provider,
    model: row.model,
    score: row.score,
    opportunity: row.opportunity,
    scoreReason: row.scoreReason,
    websiteQuality: row.websiteQuality,
    confidence: row.confidence,
    hasWebsite,
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

function hasKnownWebsite(lead: LeadDetail): boolean {
  return Boolean(lead.website) && lead.websiteStatus === WebsiteStatus.HAS_WEBSITE;
}

/** Lê a análise gravada e diz se ela ainda corresponde aos dados atuais. */
export async function getLeadAiAnalysis(leadId: string): Promise<StoredAiAnalysis | null> {
  const [lead, site, stored] = await Promise.all([
    findLeadById(leadId),
    findWebsiteAnalysis(leadId),
    findAiAnalysis(leadId),
  ]);
  if (!lead || !stored) return null;
  return toStored(stored, hashInput(buildInput(lead, site)), hasKnownWebsite(lead));
}

export type AiAnalysisOutcome =
  | { status: "analyzed"; analysis: StoredAiAnalysis }
  | { status: "skipped"; reason: "current"; analysis: StoredAiAnalysis }
  | { status: "skipped"; reason: "not-qualified"; analysis: null; message: string };

export interface AnalyzeOptions {
  /**
   * "Reanalisar": ignora o cache e chama o modelo mesmo sem nada ter mudado.
   * Continua respeitando a pré-qualificação - um registro sem dados nunca vale
   * uma chamada, por mais que o usuário insista.
   */
  force?: boolean;
}

export async function analyzeLeadOpportunity(
  leadId: string,
  options: AnalyzeOptions = {},
): Promise<AiAnalysisOutcome> {
  const provider = getActiveAiProvider();

  const [lead, site, stored] = await Promise.all([
    findLeadById(leadId),
    findWebsiteAnalysis(leadId),
    findAiAnalysis(leadId),
  ]);
  if (!lead) throw new AppError("NOT_FOUND");

  // Filtro mais barato primeiro: decide sem tocar na rede.
  const prequalify = shouldAnalyzeWithAI(lead);
  if (!prequalify.analyze) {
    logger.info("lead descartado na pré-qualificação", { leadId, skip: prequalify.skipReason });
    return { status: "skipped", reason: "not-qualified", analysis: null, message: prequalify.reason };
  }

  const input = buildInput(lead, site);
  const inputHash = hashInput(input);
  const hasWebsite = hasKnownWebsite(lead);

  // Nada mudou desde a última análise (dados, provider e modelo) e ela ainda
  // está dentro do prazo: não gasta token.
  const isFresh =
    stored !== null &&
    Date.now() - stored.createdAt.getTime() < serverConfig.ai.analysisTtlMs;
  if (!options.force && stored && stored.inputHash === inputHash && isFresh) {
    logger.info("análise reaproveitada", { leadId });
    return { status: "skipped", reason: "current", analysis: toStored(stored, inputHash, hasWebsite) };
  }

  try {
    const response = await provider.analyzeOpportunity(input);

    const record = {
      provider: provider.name,
      model: response.model,
      inputHash,
      ...response.analysis,
      // Derivado do banco: o modelo não decide o que sabemos sobre o site.
      websiteQuality: resolveWebsiteQuality(lead, site),
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
      score: record.score,
      tokens: response.usage.inputTokens + response.usage.outputTokens,
    });

    return {
      status: "analyzed",
      analysis: toStored({ ...record, createdAt: new Date() }, inputHash, hasWebsite),
    };
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

// --------------------------------------------------------------- lote

export interface BatchItemResult {
  leadId: string;
  status: "analyzed" | "reused" | "skipped" | "failed";
  /** Mensagem pronta para a interface; nunca contém detalhe técnico. */
  message: string;
  score?: number;
}

export interface BatchOutcome {
  results: BatchItemResult[];
  analyzed: number;
  reused: number;
  skipped: number;
  failed: number;
}

export interface BatchOptions extends AnalyzeOptions {
  /** Chamado a cada lead concluído, para a interface mostrar o progresso. */
  onResult?: (result: BatchItemResult, done: number, total: number) => void;
}

/**
 * Analisa vários leads respeitando o teto de chamadas simultâneas
 * (AI_CONCURRENCY): dezenas de requisições ao mesmo tempo derrubariam a cota
 * do provider sem analisar nada mais rápido.
 *
 * Um lead que falha não derruba o lote: o erro vira mensagem daquele item e o
 * processamento continua. Cada lead ainda passa pela pré-qualificação e pelo
 * cache individualmente, então um lote grande costuma custar bem menos do que
 * o número de leads selecionados sugere.
 */
export async function analyzeLeadsInBatch(
  leadIds: readonly string[],
  options: BatchOptions = {},
): Promise<BatchOutcome> {
  const unique = [...new Set(leadIds)].slice(0, MAX_BATCH_SIZE);
  if (unique.length === 0) {
    return { results: [], analyzed: 0, reused: 0, skipped: 0, failed: 0 };
  }

  const total = unique.length;
  let done = 0;

  const results = await mapWithConcurrency(
    unique,
    serverConfig.ai.concurrency,
    async (leadId): Promise<BatchItemResult> => {
      const result = await analyzeOne(leadId, options);
      done += 1;
      // Avisa quem está acompanhando assim que cada lead termina, para a
      // interface poder dizer "Analisando 7 de 20".
      options.onResult?.(result, done, total);
      return result;
    },
  );

  return {
    results,
    analyzed: results.filter((item) => item.status === "analyzed").length,
    reused: results.filter((item) => item.status === "reused").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
  };
}

/** Um lead do lote. Qualquer erro vira resultado, nunca exceção. */
async function analyzeOne(leadId: string, options: AnalyzeOptions): Promise<BatchItemResult> {
  try {
    const outcome = await analyzeLeadOpportunity(leadId, options);
    if (outcome.status === "analyzed") {
      return { leadId, status: "analyzed", message: "Analisado.", score: outcome.analysis.score };
    }
    if (outcome.reason === "current") {
      return {
        leadId,
        status: "reused",
        message: "Análise atual reaproveitada - nenhum token gasto.",
        score: outcome.analysis.score,
      };
    }
    return { leadId, status: "skipped", message: outcome.message };
  } catch (error) {
    // Erro individual é registrado no servidor e resumido para o usuário.
    logger.error("falha ao analisar lead no lote", { leadId, code: toAppError(error).code });
    return { leadId, status: "failed", message: userMessage(error) };
  }
}
