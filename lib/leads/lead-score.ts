/**
 * Lead Score (0-100) e os motivos que explicam a nota. Regras fixas, sem IA:
 * os pesos ficam em lib/config/lead-score.ts.
 *
 * Os motivos são escritos com cuidado para não afirmar mais do que se sabe:
 * "site não informado na fonte" não é "não tem site".
 */

import { ScoreLevel, WebsiteStatus, WhatsappStatus } from "@/generated/prisma/enums";
import { LEAD_SCORE_CONFIG } from "@/lib/config/lead-score";

export interface LeadScoreInput {
  websiteStatus: WebsiteStatus;
  whatsappStatus: WhatsappStatus;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  street: string | null;
  number: string | null;
  city: string | null;
  /** Conhecido apenas após a análise de site. */
  websiteHasHttps?: boolean | null;
}

export interface LeadScoreResult {
  score: number;
  level: ScoreLevel;
  reasons: string[];
}

const { weights, levels, maxScore } = LEAD_SCORE_CONFIG;

/** Situações em que nenhum site próprio é conhecido. */
const WITHOUT_KNOWN_WEBSITE: readonly WebsiteStatus[] = [
  WebsiteStatus.NO_WEBSITE,
  WebsiteStatus.NOT_PROVIDED,
  WebsiteStatus.SOCIAL_ONLY,
];

export function calculateLeadScore(input: LeadScoreInput): LeadScoreResult {
  const reasons: string[] = [];
  let score = 0;

  const add = (points: number, reason: string) => {
    if (points <= 0) return;
    score += points;
    reasons.push(`${reason} (+${points})`);
  };

  switch (input.websiteStatus) {
    case WebsiteStatus.NO_WEBSITE:
      add(weights.websiteConfirmedMissing, "Confirmado que não possui site");
      break;
    case WebsiteStatus.NOT_PROVIDED:
    case WebsiteStatus.SOCIAL_ONLY:
      add(weights.websiteNotProvided, "Site não informado na fonte (não confirmado)");
      break;
    case WebsiteStatus.UNREACHABLE_WEBSITE:
      add(weights.websiteUnreachable, "Site cadastrado não respondeu na análise");
      break;
    case WebsiteStatus.INVALID_WEBSITE:
      add(weights.websiteInvalid, "Endereço de site inválido na fonte");
      break;
    default:
      break;
  }

  if (input.websiteHasHttps === false) add(weights.websiteWithoutHttps, "Site sem HTTPS");

  if (input.phone) add(weights.phone, "Possui telefone");

  if (input.whatsappStatus === WhatsappStatus.CONFIRMED) {
    add(weights.confirmedWhatsapp, "WhatsApp confirmado");
  } else if (input.whatsappStatus === WhatsappStatus.POSSIBLE) {
    add(weights.possibleWhatsapp, "Celular que pode ter WhatsApp (não confirmado)");
  }

  if (input.instagram) add(weights.instagram, "Instagram encontrado");
  if (input.email) add(weights.email, "Possui e-mail");
  if (input.street && input.number && input.city) add(weights.fullAddress, "Endereço completo");

  const hasSocial = Boolean(input.instagram || input.facebook);
  if (hasSocial && WITHOUT_KNOWN_WEBSITE.includes(input.websiteStatus)) {
    add(weights.socialPresenceWithoutWebsite, "Presença em rede social sem site conhecido");
  }

  const finalScore = Math.max(0, Math.min(score, maxScore));
  return { score: finalScore, level: resolveScoreLevel(finalScore), reasons };
}

export function resolveScoreLevel(score: number): ScoreLevel {
  if (score >= levels.high) return ScoreLevel.HIGH;
  if (score >= levels.medium) return ScoreLevel.MEDIUM;
  return ScoreLevel.LOW;
}
