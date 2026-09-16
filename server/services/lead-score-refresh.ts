/**
 * Recalcula o Lead Score a partir do estado atual do lead.
 * Chamado depois de enriquecer ou analisar o site - as duas operações mudam
 * os sinais que alimentam a pontuação.
 */

import { AppError } from "@/lib/errors";
import { calculateLeadScore, type LeadScoreResult } from "@/lib/leads/lead-score";
import { findLeadScoringSnapshot, updateLeadScore } from "@/server/repositories/lead-repository";

export async function refreshLeadScore(leadId: string): Promise<LeadScoreResult> {
  const snapshot = await findLeadScoringSnapshot(leadId);
  if (!snapshot) throw new AppError("NOT_FOUND");

  const score = calculateLeadScore(snapshot);
  await updateLeadScore(leadId, score);
  return score;
}
