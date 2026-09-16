/**
 * Leitura leve do site oficial para completar contatos do lead.
 *
 * Visita a página inicial e, no máximo, mais (maxPages - 1) páginas de
 * contato/sobre - primeiro as que o próprio site linka, depois caminhos comuns
 * (/contato, /contact, /sobre, /about). Para assim que tiver o essencial.
 *
 * Tudo que devolve foi lido no HTML. Se o site não mostra e-mail, o e-mail
 * continua null: nada é montado a partir do domínio.
 */

import { extractContacts, type ExtractedContacts } from "@/lib/leads/enrichment/contact-extractor";
import { safeFetch, type SafeFetchOptions, type SafeFetchResult } from "@/lib/leads/enrichment/safe-fetch";
import type { LeadEnrichmentStatus, LeadResult } from "@/lib/leads/types";
import { extractDomain, normalizeBrazilianPhone, normalizeUrl } from "@/lib/normalize";

export const DEFAULT_CONTACT_PATHS = ["/contato", "/contact", "/sobre", "/about"] as const;

export interface WebsiteCrawlerOptions {
  maxPages: number;
  timeoutMs: number;
  maxBytes: number;
  userAgent: string;
  /** Injetável nos testes; o padrão é o fetch com proteção SSRF. */
  fetchPage?: (url: string) => Promise<SafeFetchResult>;
  fetchOptions?: Partial<SafeFetchOptions>;
}

export interface WebsiteCrawlResult {
  status: Exclude<LeadEnrichmentStatus, "pending">;
  finalUrl: string | null;
  pagesVisited: string[];
  email: string | null;
  phone: string | null;
  hasMobilePhone: boolean;
  whatsappConfirmed: boolean;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
}

function emptyResult(status: WebsiteCrawlResult["status"]): WebsiteCrawlResult {
  return {
    status,
    finalUrl: null,
    pagesVisited: [],
    email: null,
    phone: null,
    hasMobilePhone: false,
    whatsappConfirmed: false,
    whatsapp: null,
    instagram: null,
    facebook: null,
    linkedin: null,
  };
}

function isHtmlSuccess(page: SafeFetchResult): boolean {
  return page.status >= 200 && page.status < 300 && page.body.length > 0;
}

/** Prefere o e-mail do próprio domínio do site (contato@clinica.com.br a um gmail de agência). */
function pickEmail(emails: readonly string[], siteUrl: string): string | null {
  const domain = extractDomain(siteUrl);
  if (domain) {
    const own = emails.find((email) => {
      const emailDomain = email.split("@")[1] ?? "";
      return emailDomain === domain || emailDomain.endsWith(`.${domain}`) || domain.endsWith(`.${emailDomain}`);
    });
    if (own) return own;
  }
  return emails[0] ?? null;
}

function mergeExtracted(target: ExtractedContacts, source: ExtractedContacts): void {
  for (const email of source.emails) if (!target.emails.includes(email)) target.emails.push(email);
  for (const phone of source.phones) if (!target.phones.includes(phone)) target.phones.push(phone);
  for (const number of source.whatsappNumbers) {
    if (!target.whatsappNumbers.includes(number)) target.whatsappNumbers.push(number);
  }
  target.hasMobilePhone ||= source.hasMobilePhone;
  target.hasWhatsappLink ||= source.hasWhatsappLink;
  target.instagram ??= source.instagram;
  target.facebook ??= source.facebook;
  target.linkedin ??= source.linkedin;
}

function hasEssentials(contacts: ExtractedContacts): boolean {
  return (
    contacts.emails.length > 0 &&
    contacts.phones.length > 0 &&
    contacts.hasWhatsappLink &&
    contacts.instagram !== null
  );
}

export async function crawlWebsite(rawUrl: string, options: WebsiteCrawlerOptions): Promise<WebsiteCrawlResult> {
  const siteUrl = normalizeUrl(rawUrl);
  if (!siteUrl) return emptyResult("failed");

  const fetchPage =
    options.fetchPage ??
    ((url: string) =>
      safeFetch(url, {
        timeoutMs: options.timeoutMs,
        maxBytes: options.maxBytes,
        userAgent: options.userAgent,
        ...options.fetchOptions,
      }));

  let home: SafeFetchResult;
  try {
    home = await fetchPage(siteUrl);
  } catch {
    return emptyResult("failed");
  }
  if (!isHtmlSuccess(home)) return { ...emptyResult("failed"), finalUrl: home.finalUrl };

  const contacts = extractContacts(home.body, home.finalUrl);
  const pagesVisited = [home.finalUrl];
  let failures = 0;

  const origin = new URL(home.finalUrl).origin;
  const discovered = contacts.contactPageLinks;
  const guessed = DEFAULT_CONTACT_PATHS.map((path) => `${origin}${path}`);
  const candidates = [...new Set([...discovered, ...guessed])].filter((url) => url !== home.finalUrl);
  const extraPages = Math.max(0, options.maxPages - 1);

  // Cada tentativa conta, mesmo as que dão 404: o teto é de requisições.
  let attempts = 0;
  for (const candidate of candidates) {
    if (attempts >= extraPages || hasEssentials(contacts)) break;
    attempts += 1;
    const isGuess = !discovered.includes(candidate);
    try {
      const page = await fetchPage(candidate);
      if (pagesVisited.includes(page.finalUrl)) continue;
      if (isHtmlSuccess(page)) {
        pagesVisited.push(page.finalUrl);
        mergeExtracted(contacts, extractContacts(page.body, page.finalUrl));
      } else if (!isGuess && (page.status >= 500 || page.status === 0)) {
        // Caminho adivinhado que dá 404 é normal; página linkada que falha não.
        failures += 1;
      }
    } catch {
      if (!isGuess) failures += 1;
    }
  }

  return {
    status: failures > 0 ? "partial" : "completed",
    finalUrl: home.finalUrl,
    pagesVisited,
    email: pickEmail(contacts.emails, home.finalUrl),
    phone: contacts.phones[0] ?? null,
    hasMobilePhone: contacts.hasMobilePhone,
    whatsappConfirmed: contacts.hasWhatsappLink,
    whatsapp: contacts.whatsappNumbers[0] ?? null,
    instagram: contacts.instagram,
    facebook: contacts.facebook,
    linkedin: contacts.linkedin,
  };
}

/**
 * Junta o que o site mostrou ao lead. Dados da fonte original têm prioridade:
 * o site só preenche campos vazios, sempre com origem "website".
 */
export function applyWebsiteCrawl(lead: LeadResult, crawl: WebsiteCrawlResult): LeadResult {
  const next: LeadResult = { ...lead, enrichmentStatus: crawl.status };
  if (crawl.status === "failed") return next;

  if (!next.email && crawl.email) {
    next.email = crawl.email;
    next.emailSource = "website";
  }
  if (!next.phone && crawl.phone) {
    next.phone = crawl.phone;
    next.phoneSource = "website";
  }
  if (!next.instagram && crawl.instagram) {
    next.instagram = crawl.instagram;
    next.instagramSource = "website";
  }
  next.facebook ??= crawl.facebook;
  next.linkedin ??= crawl.linkedin;

  if (crawl.whatsappConfirmed && next.whatsappStatus !== "confirmed") {
    next.whatsappStatus = "confirmed";
    next.whatsapp = next.whatsapp ?? crawl.whatsapp;
    next.whatsappSource = "website";
  } else if (next.whatsappStatus === "unknown" && normalizeBrazilianPhone(next.phone)?.isMobile) {
    next.whatsappStatus = "possible";
    next.whatsappSource = next.phoneSource;
  }
  return next;
}
