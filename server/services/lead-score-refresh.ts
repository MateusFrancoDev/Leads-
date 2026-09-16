/**
 * Recalcula o Lead Score a partir do estado atual do lead.
 * Chamado depois de enriquecer ou analisar o site - as duas operacoes mudam
 * os sinais que alimentam a pontuacao.
 */

import { AppError } from "@/lib/errors";
import { findLeadScoringSnapshot, updateLeadScore } from "@/server/repositories/lead-repository";
import { calculateLeadScore, type LeadScoreResult } from "@/server/services/lead-scoring";

export async function refreshLeadScore(leadId: string): Promise<LeadScoreResult> {
  const snapshot = await findLeadScoringSnapshot(leadId);
  if (!snapshot) throw new AppError("NOT_FOUND");

  const score = calculateLeadScore(snapshot);
  await updateLeadScore(leadId, score);
  return score;
}
