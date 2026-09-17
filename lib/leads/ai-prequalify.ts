/**
 * Pré-qualificação em TypeScript: decide, de graça, se vale gastar uma chamada
 * de IA com este lead. É o filtro mais barato do módulo e roda sempre antes do
 * provider - nenhum lead vai ao modelo sem passar por aqui.
 *
 * Função pura, sem Prisma e sem rede: dá para testar e dá para usar na
 * interface para explicar ao usuário por que um lead foi pulado.
 *
 * A regra que mais importa para este negócio: empresa SEM SITE não é lead
 * ruim. É o perfil mais interessante, porque é exatamente a quem se vende a
 * criação de site. O que descarta um lead é falta de dados, não falta de site.
 */

import { WebsiteStatus, WhatsappStatus } from "@/generated/prisma/enums";

/** Só o que a decisão usa - qualquer LeadListItem/LeadDetail serve. */
export interface AiPrequalifyInput {
  name: string;
  category: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  whatsappStatus: WhatsappStatus;
  website: string | null;
  websiteStatus: WebsiteStatus;
  city: string | null;
  state: string | null;
  score: number;
}

export type AiSkipReason =
  | "invalid-record"
  | "no-contact"
  | "not-enough-data";

export interface AiPrequalifyResult {
  /** false = não vale a chamada; o serviço nem chega ao provider. */
  analyze: boolean;
  /** 0 a 100. Ordena a fila do lote: o mais promissor primeiro. */
  priority: number;
  /** Frase pronta para exibir ao usuário. */
  reason: string;
  skipReason?: AiSkipReason;
}

/** Situações em que nenhum site próprio é conhecido (sem afirmar que não existe). */
const WITHOUT_KNOWN_WEBSITE: readonly WebsiteStatus[] = [
  WebsiteStatus.NO_WEBSITE,
  WebsiteStatus.NOT_PROVIDED,
  WebsiteStatus.SOCIAL_ONLY,
];

/**
 * Sinais de que o site cadastrado pode estar problemático - e, portanto, de que
 * há o que analisar. Não afirmam nada sobre o site: só dizem que vale olhar.
 */
const SUSPECT_WEBSITE: readonly WebsiteStatus[] = [
  WebsiteStatus.INVALID_WEBSITE,
  WebsiteStatus.UNREACHABLE_WEBSITE,
];

export function shouldAnalyzeWithAI(lead: AiPrequalifyInput): AiPrequalifyResult {
  const name = lead.name?.trim() ?? "";

  // Registro quebrado: nem dá para escrever uma abordagem comercial.
  if (name.length < 2) {
    return {
      analyze: false,
      priority: 0,
      reason: "Registro sem nome utilizável.",
      skipReason: "invalid-record",
    };
  }

  const hasContact =
    Boolean(lead.phone) ||
    Boolean(lead.email) ||
    Boolean(lead.instagram) ||
    lead.whatsappStatus === WhatsappStatus.CONFIRMED;
  const hasWebsite = Boolean(lead.website) && lead.websiteStatus === WebsiteStatus.HAS_WEBSITE;

  // Sem canal de contato E sem site: não há o que abordar nem o que analisar.
  if (!hasContact && !hasWebsite) {
    return {
      analyze: false,
      priority: 0,
      reason: "Sem telefone, e-mail, Instagram ou site: não há como abordar esta empresa.",
      skipReason: "no-contact",
    };
  }

  // Um nome solto com um contato ainda é pouco para uma análise que valha o custo.
  const signals = [lead.category, lead.city, lead.phone, lead.email, lead.instagram].filter(
    Boolean,
  ).length;
  if (signals < 2) {
    return {
      analyze: false,
      priority: 0,
      reason: "Dados públicos insuficientes para uma análise que valha a chamada.",
      skipReason: "not-enough-data",
    };
  }

  const withoutKnownWebsite = WITHOUT_KNOWN_WEBSITE.includes(lead.websiteStatus);
  const suspectWebsite = SUSPECT_WEBSITE.includes(lead.websiteStatus);

  let priority = 0;
  const highlights: string[] = [];

  if (withoutKnownWebsite) {
    priority += 40;
    highlights.push("nenhum site conhecido");
  } else if (suspectWebsite) {
    priority += 35;
    highlights.push("site cadastrado com problema");
  } else if (hasWebsite) {
    priority += 15;
    highlights.push("site para avaliar");
  }

  if (lead.phone) {
    priority += 20;
    highlights.push("telefone público");
  }
  if (lead.whatsappStatus === WhatsappStatus.CONFIRMED) priority += 10;
  if (lead.instagram) priority += 10;
  if (lead.email) priority += 5;
  if (lead.category) priority += 5;
  if (lead.city && lead.state) priority += 5;

  // O score de regras já resume os mesmos sinais: entra como desempate.
  priority += Math.round(lead.score / 20);

  return {
    analyze: true,
    priority: Math.max(0, Math.min(100, priority)),
    reason: highlights.length > 0 ? `Vale analisar: ${highlights.join(", ")}.` : "Vale analisar.",
  };
}

/**
 * Ordena um lote do mais promissor para o menos, já sem os descartados.
 * O lote consome o teto de chamadas pela ordem - se algo ficar de fora, fica
 * o que menos interessa.
 */
export function rankForAiAnalysis<T extends AiPrequalifyInput>(
  leads: readonly T[],
): { lead: T; prequalify: AiPrequalifyResult }[] {
  return leads
    .map((lead) => ({ lead, prequalify: shouldAnalyzeWithAI(lead) }))
    .filter((entry) => entry.prequalify.analyze)
    .sort((a, b) => b.prequalify.priority - a.prequalify.priority);
}
