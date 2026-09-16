/**
 * Análise de site sob demanda.
 *
 * Antes de baixar qualquer página verifica o banco: se já existe análise
 * dentro do prazo, nada e refeito. O resultado atualiza a situação do site
 * e o Lead Score (site fora do ar vira oportunidade).
 */

import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { serverConfig } from "@/server/config";
import {
  findLeadById,
  findWebsiteAnalysis,
  saveWebsiteAnalysis,
  type StoredWebsiteAnalysis,
} from "@/server/repositories/lead-repository";
import { recordApiUsage } from "@/server/repositories/search-repository";
import { refreshLeadScore } from "@/server/services/lead-score-refresh";
import { analyzeWebsite } from "@/server/services/website-analyzer";
import { WebsiteStatus } from "@/types/lead";

const logger = createLogger("lead-website");

export type WebsiteAnalysisOutcome =
  | { status: "analyzed"; issues: string[]; reachable: boolean; score: number }
  | { status: "skipped"; reason: "no-website" | "recent"; analysis: StoredWebsiteAnalysis | null };

function isFresh(analysis: StoredWebsiteAnalysis | null): boolean {
  if (!analysis) return false;
  return Date.now() - analysis.checkedAt.getTime() < serverConfig.websiteAnalysisTtlMs;
}

export async function analyzeLeadWebsite(leadId: string): Promise<WebsiteAnalysisOutcome> {
  const lead = await findLeadById(leadId);
  if (!lead) throw new AppError("NOT_FOUND");

  const existing = await findWebsiteAnalysis(leadId);
  if (!lead.website) return { status: "skipped", reason: "no-website", analysis: existing };
  if (isFresh(existing)) return { status: "skipped", reason: "recent", analysis: existing };

  const result = await analyzeWebsite(lead.website);
  const websiteStatus = result.reachable
    ? WebsiteStatus.HAS_WEBSITE
    : WebsiteStatus.UNREACHABLE_WEBSITE;

  const message = result.reachable
    ? `Site analisado: ${result.issues.length} pontos de melhoria`
    : "Site não respondeu na análise";

  await saveWebsiteAnalysis(
    leadId,
    {
      finalUrl: result.finalUrl,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      hasHttps: result.hasHttps,
      hasViewport: result.hasViewport,
      hasTitle: result.hasTitle,
      hasDescription: result.hasDescription,
      hasFavicon: result.hasFavicon,
      hasContactForm: result.hasContactForm,
      hasPhone: result.hasPhone,
      hasWhatsapp: result.hasWhatsapp,
      hasAnalytics: result.hasAnalytics,
      hasMetaPixel: result.hasMetaPixel,
      title: result.title,
      description: result.description,
      contentHash: result.contentHash,
      issues: result.issues,
    },
    websiteStatus,
    message,
  );

  const score = await refreshLeadScore(leadId);

  await recordApiUsage({
    provider: "website",
    operation: "analyze",
    requests: 1,
    items: 1,
    success: result.reachable,
  });

  logger.info("análise concluida", { leadId, problemas: result.issues.length });
  return { status: "analyzed", issues: result.issues, reachable: result.reachable, score: score.score };
}
