/**
 * Lead Score (0-100) e os motivos que explicam a nota.
 * Os pesos ficam em lib/config/lead-score.ts - aqui so ha a regra de aplicacao.
 */

import { LEAD_SCORE_CONFIG } from "@/lib/config/lead-score";
import { ScoreLevel, WebsiteStatus } from "@/types/lead";

export interface LeadScoreInput {
  websiteStatus: WebsiteStatus;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
  rating: number | null;
  reviewsCount: number | null;
  /** Conhecido apenas apos a analise de site (Fase 2). */
  websiteHasHttps?: boolean | null;
}

export interface LeadScoreResult {
  score: number;
  level: ScoreLevel;
  reasons: string[];
}

const { weights, thresholds, levels, maxScore } = LEAD_SCORE_CONFIG;

export function calculateLeadScore(input: LeadScoreInput): LeadScoreResult {
  const reasons: string[] = [];
  let score = 0;

  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(`${reason} (+${points})`);
  };

  switch (input.websiteStatus) {
    case WebsiteStatus.NO_WEBSITE:
      add(weights.noWebsite, "Nao possui site proprio");
      break;
    case WebsiteStatus.SOCIAL_ONLY:
      add(weights.socialOnly, "Presenca apenas em rede social");
      break;
    case WebsiteStatus.INVALID_WEBSITE:
    case WebsiteStatus.UNREACHABLE_WEBSITE:
      add(weights.brokenWebsite, "Site cadastrado esta quebrado ou fora do ar");
      break;
    default:
      break;
  }

  if (input.websiteHasHttps === false) {
    add(weights.websiteWithoutHttps, "Site sem HTTPS");
  }

  if (input.phone) add(weights.hasPhone, "Possui telefone");
  if (input.whatsapp) add(weights.hasWhatsapp, "Possui WhatsApp");
  if (input.instagram) add(weights.hasInstagram, "Instagram encontrado");
  if (input.email) add(weights.hasEmail, "Possui e-mail");

  if (input.rating !== null && input.rating >= thresholds.goodRating) {
    add(weights.goodRating, `Nota ${input.rating.toFixed(1)} no Google`);
  }

  const reviews = input.reviewsCount ?? 0;
  if (reviews >= thresholds.manyReviews) {
    add(weights.manyReviews, `${reviews} avaliacoes`);
  }
  if (reviews >= thresholds.veryManyReviews) {
    add(weights.veryManyReviews, "Volume alto de avaliacoes");
  }

  const finalScore = Math.min(score, maxScore);
  return { score: finalScore, level: resolveScoreLevel(finalScore), reasons };
}

export function resolveScoreLevel(score: number): ScoreLevel {
  if (score >= levels.high) return ScoreLevel.HIGH;
  if (score >= levels.medium) return ScoreLevel.MEDIUM;
  return ScoreLevel.LOW;
}
