/**
 * Analise tecnica do site de um lead.
 *
 * Baixa a pagina uma unica vez, com timeout, e extrai sinais com expressoes
 * regulares - nao vale a pena carregar um parser de HTML inteiro para isso.
 * O conteudo relevante e reduzido a um hash: se o site nao mudou, nao ha
 * motivo para reprocessar nem, no futuro, gastar IA analisando de novo.
 */

import { createHash } from "node:crypto";
import { fetchWithTimeout } from "@/lib/http";
import { createLogger } from "@/lib/logger";
import { cleanupText, normalizeUrl } from "@/lib/normalize";
import { serverConfig } from "@/server/config";

const logger = createLogger("website-analyzer");

/** Teto de HTML lido: paginas gigantes nao podem consumir memoria do servidor. */
const MAX_HTML_LENGTH = 300_000;

/** Acima disso o site e considerado lento para um visitante de celular. */
const SLOW_RESPONSE_MS = 3_000;

export interface WebsiteAnalysis {
  reachable: boolean;
  finalUrl: string | null;
  httpStatus: number | null;
  responseTimeMs: number | null;
  /** null = nao foi possivel verificar (site fora do ar). */
  hasHttps: boolean | null;
  hasTitle: boolean | null;
  hasDescription: boolean | null;
  hasViewport: boolean | null;
  hasFavicon: boolean | null;
  hasContactForm: boolean | null;
  hasPhone: boolean | null;
  hasWhatsapp: boolean | null;
  hasAnalytics: boolean | null;
  hasMetaPixel: boolean | null;
  title: string | null;
  description: string | null;
  contentHash: string | null;
  /** Problemas em linguagem de negocio, prontos para exibir. */
  issues: string[];
  /** Links de redes sociais encontrados na pagina (viram enriquecimento). */
  socialLinks: string[];
  /** Primeiro e-mail encontrado na pagina. */
  email: string | null;
}

const PATTERNS = {
  title: /<title[^>]*>([\s\S]*?)<\/title>/i,
  description: /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i,
  descriptionReversed: /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i,
  viewport: /<meta[^>]+name=["']viewport["']/i,
  favicon: /<link[^>]+rel=["'][^"']*icon[^"']*["']/i,
  form: /<form[\s>]/i,
  tel: /href=["']tel:/i,
  whatsapp: /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i,
  analytics: /googletagmanager\.com|google-analytics\.com|gtag\s*\(/i,
  metaPixel: /connect\.facebook\.net|fbq\s*\(/i,
  email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  socialLink: /https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|linkedin\.com|tiktok\.com)\/[^\s"'<>]+/gi,
} as const;

function firstMatch(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? cleanupText(match[1]) : null;
}

/** Hash do texto visivel: muda quando o conteudo muda, nao quando muda um script. */
function hashContent(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha1").update(text).digest("hex");
}

function collectIssues(analysis: WebsiteAnalysis): string[] {
  const issues: string[] = [];
  if (!analysis.reachable) {
    issues.push("Site nao respondeu");
    return issues;
  }
  if (analysis.httpStatus && analysis.httpStatus >= 400) {
    issues.push(`Site retornou erro ${analysis.httpStatus}`);
  }
  if (analysis.hasHttps === false) issues.push("Site sem HTTPS");
  if (analysis.hasViewport === false) issues.push("Sem viewport: provavelmente nao adapta ao celular");
  if (analysis.hasTitle === false) issues.push("Pagina sem title");
  if (analysis.hasDescription === false) issues.push("Sem meta description");
  if (analysis.hasFavicon === false) issues.push("Sem favicon");
  if (analysis.hasContactForm === false) issues.push("Sem formulario de contato");
  if (analysis.hasPhone === false) issues.push("Sem telefone clicavel");
  if (analysis.hasWhatsapp === false) issues.push("Sem botao de WhatsApp");
  if (analysis.hasAnalytics === false) issues.push("Sem Google Analytics");
  if (analysis.hasMetaPixel === false) issues.push("Sem Meta Pixel");
  if (analysis.responseTimeMs && analysis.responseTimeMs > SLOW_RESPONSE_MS) {
    issues.push(`Resposta lenta (${Math.round(analysis.responseTimeMs / 100) / 10}s)`);
  }
  return issues;
}

function unreachable(url: string | null): WebsiteAnalysis {
  // Nada pode ser afirmado sobre um site que nao respondeu: os sinais ficam
  // nulos (desconhecidos) para nao somar penalidade em cima de penalidade.
  const analysis: WebsiteAnalysis = {
    reachable: false,
    finalUrl: url,
    httpStatus: null,
    responseTimeMs: null,
    hasHttps: null,
    hasTitle: null,
    hasDescription: null,
    hasViewport: null,
    hasFavicon: null,
    hasContactForm: null,
    hasPhone: null,
    hasWhatsapp: null,
    hasAnalytics: null,
    hasMetaPixel: null,
    title: null,
    description: null,
    contentHash: null,
    issues: [],
    socialLinks: [],
    email: null,
  };
  analysis.issues = collectIssues(analysis);
  return analysis;
}

/** Baixa e avalia a pagina. Nunca lanca: site fora do ar e um resultado valido. */
export async function analyzeWebsite(rawUrl: string): Promise<WebsiteAnalysis> {
  const url = normalizeUrl(rawUrl);
  if (!url) return unreachable(null);

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      timeoutMs: serverConfig.external.timeoutMs,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProspectaBot/1.0)" },
    });
  } catch {
    logger.info("site inacessivel", { url });
    return unreachable(url);
  }

  const responseTimeMs = Date.now() - startedAt;
  const finalUrl = response.url || url;

  let html = "";
  try {
    html = (await response.text()).slice(0, MAX_HTML_LENGTH);
  } catch {
    html = "";
  }

  const description =
    firstMatch(html, PATTERNS.description) ?? firstMatch(html, PATTERNS.descriptionReversed);

  const analysis: WebsiteAnalysis = {
    reachable: response.status < 400,
    finalUrl,
    httpStatus: response.status,
    responseTimeMs,
    hasHttps: finalUrl.startsWith("https://"),
    hasTitle: PATTERNS.title.test(html),
    hasDescription: Boolean(description),
    hasViewport: PATTERNS.viewport.test(html),
    hasFavicon: PATTERNS.favicon.test(html),
    hasContactForm: PATTERNS.form.test(html),
    hasPhone: PATTERNS.tel.test(html),
    hasWhatsapp: PATTERNS.whatsapp.test(html),
    hasAnalytics: PATTERNS.analytics.test(html),
    hasMetaPixel: PATTERNS.metaPixel.test(html),
    title: firstMatch(html, PATTERNS.title),
    description,
    contentHash: html ? hashContent(html) : null,
    issues: [],
    socialLinks: [...new Set(html.match(PATTERNS.socialLink) ?? [])].slice(0, 10),
    email: html.match(PATTERNS.email)?.[0]?.toLowerCase() ?? null,
  };

  analysis.issues = collectIssues(analysis);
  logger.info("site analisado", { url: finalUrl, status: response.status, problemas: analysis.issues.length });
  return analysis;
}
