/**
 * Extrai contatos que estão escritos no HTML do site oficial da empresa.
 *
 * Só devolve o que aparece na página: links mailto:/tel:, links do WhatsApp,
 * perfis de redes sociais e e-mails/telefones escritos no texto visível.
 * Nada é montado a partir do domínio ou do nome da empresa.
 *
 * Expressões regulares bastam aqui: não vale carregar um parser de HTML para
 * ler atributos href e texto.
 */

import {
  normalizeBrazilianPhone,
  normalizeEmail,
  normalizeForComparison,
  normalizeSocialProfileUrl,
  normalizeUrl,
} from "@/lib/normalize";

export interface ExtractedContacts {
  /** E-mails na ordem de confiança: mailto primeiro, texto depois. */
  emails: string[];
  /** Telefones normalizados (55 + DDD + número): tel: primeiro, texto depois. */
  phones: string[];
  hasMobilePhone: boolean;
  /** true quando há link wa.me / api.whatsapp.com, mesmo sem número legível. */
  hasWhatsappLink: boolean;
  whatsappNumbers: string[];
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  /** Links do próprio site que parecem página de contato/sobre. */
  contactPageLinks: string[];
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  commat: "@",
  period: ".",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Texto visível aproximado: sem scripts, estilos, comentários e tags. */
export function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** E-mail protegido pela Cloudflare (data-cfemail): é o e-mail real, apenas codificado. */
export function decodeCloudflareEmail(hex: string): string | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4 || hex.length % 2 !== 0) return null;
  const key = Number.parseInt(hex.slice(0, 2), 16);
  let result = "";
  for (let index = 2; index < hex.length; index += 2) {
    result += String.fromCharCode(Number.parseInt(hex.slice(index, index + 2), 16) ^ key);
  }
  return result;
}

/** Número de um link do WhatsApp (wa.me/55..., api.whatsapp.com/send?phone=55...). */
export function extractWhatsappNumber(link: string | null | undefined): string | null {
  if (!link) return null;
  const decoded = decodeHtmlEntities(link);
  const direct = /wa\.me\/\+?(\d{10,15})/i.exec(decoded);
  const param = /[?&]phone=\+?(\d{10,15})/i.exec(decoded);
  const digits = direct?.[1] ?? param?.[1];
  return digits ? (normalizeBrazilianPhone(digits)?.digits ?? null) : null;
}

const WHATSAPP_LINK = /(?:https?:)?\/\/(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)\/[^\s"'<>]*|whatsapp:\/\/send\?[^\s"'<>]*/gi;

const ANCHOR = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const CF_EMAIL = /data-cfemail\s*=\s*["']?([0-9a-f]+)/gi;

const TEXT_EMAIL = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;

/** Telefones escritos com formatação típica: (11) 98765-4321, 11 3456-7890, +55 11 98765 4321. */
const TEXT_PHONES = [
  /\(\s*\d{2}\s*\)\s*9?\s?\d{4}[\s.-]?\d{4}/g,
  /(?:\+?55[\s.]*)?\b\d{2}[\s.]+9?\d{4}-\d{4}\b/g,
  /\+55[\s.]*\d{2}[\s.]*9?\d{4}[\s.-]?\d{4}/g,
];

/** Extensões que aparecem como "e-mail" em nomes de arquivo (logo@2x.png). */
const FILE_LIKE_TLD = /\.(png|jpe?g|gif|svg|webp|ico|css|js|avif|bmp)$/i;
/** Domínios de exemplo ou de ferramentas: nunca são o contato da empresa. */
const IGNORED_EMAIL_DOMAINS = new Set([
  "example.com", "example.org", "exemplo.com", "exemplo.com.br", "email.com", "domain.com",
  "dominio.com", "dominio.com.br", "seudominio.com", "seudominio.com.br", "sentry.io",
  "wixpress.com", "sentry.wixpress.com", "sentry-next.wixpress.com",
]);
const PLACEHOLDER_LOCAL_PART = /^(seu|your)[._-]?(e?-?mail|nome|name)$/i;

function isUsableEmail(email: string): boolean {
  if (FILE_LIKE_TLD.test(email)) return false;
  const [local, domain] = email.split("@");
  if (!local || !domain) return false;
  if (IGNORED_EMAIL_DOMAINS.has(domain) || PLACEHOLDER_LOCAL_PART.test(local)) return false;
  return true;
}

const CONTACT_PAGE_HINT = /\b(contato|contatos|contact|contact us|fale conosco|sobre|sobre nos|about|about us|quem somos)\b/;
const NON_PAGE_EXTENSION = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mp3)$/i;

function sameSite(a: URL, b: URL): boolean {
  const host = (url: URL) => url.hostname.replace(/^www\./, "").toLowerCase();
  return host(a) === host(b);
}

function pushUnique(list: string[], value: string | null): void {
  if (value && !list.includes(value)) list.push(value);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function extractContacts(html: string, pageUrl: string): ExtractedContacts {
  const base = new URL(pageUrl);
  const emails: string[] = [];
  const phones: string[] = [];
  const whatsappNumbers: string[] = [];
  const contactPageLinks: string[] = [];
  let hasMobilePhone = false;
  let hasWhatsappLink = false;
  let instagram: string | null = null;
  let facebook: string | null = null;
  let linkedin: string | null = null;

  const addPhone = (raw: string) => {
    const parsed = normalizeBrazilianPhone(raw);
    if (!parsed) return;
    pushUnique(phones, parsed.digits);
    if (parsed.isMobile) hasMobilePhone = true;
  };

  for (const match of html.matchAll(ANCHOR)) {
    const attributes = match[1] ?? "";
    const hrefMatch = HREF.exec(attributes);
    const href = decodeHtmlEntities((hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? "").trim());
    if (!href) continue;

    if (/^mailto:/i.test(href)) {
      const address = safeDecode(href.slice(7).split("?")[0] ?? "");
      for (const part of address.split(/[,;]/)) {
        const email = normalizeEmail(part);
        if (email && isUsableEmail(email)) pushUnique(emails, email);
      }
      continue;
    }

    if (/^tel:/i.test(href)) {
      addPhone(safeDecode(href.slice(4)));
      continue;
    }

    if (/^(javascript|data|sms|callto):/i.test(href) || href.startsWith("#")) continue;

    let absolute: URL;
    try {
      absolute = new URL(href, base);
    } catch {
      continue;
    }
    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") continue;

    const normalized = normalizeUrl(absolute.toString());
    if (normalized) {
      instagram ??= normalizeSocialProfileUrl("instagram", normalized);
      facebook ??= normalizeSocialProfileUrl("facebook", normalized);
      linkedin ??= normalizeSocialProfileUrl("linkedin", normalized);
    }

    if (sameSite(absolute, base) && !NON_PAGE_EXTENSION.test(absolute.pathname)) {
      const text = normalizeForComparison(htmlToText(match[2] ?? ""));
      const path = normalizeForComparison(safeDecode(absolute.pathname).replace(/[-_/]+/g, " "));
      if (CONTACT_PAGE_HINT.test(text) || CONTACT_PAGE_HINT.test(path)) {
        absolute.hash = "";
        if (absolute.toString() !== base.toString()) pushUnique(contactPageLinks, absolute.toString());
      }
    }
  }

  // Links do WhatsApp também aparecem em botões flutuantes e scripts de widget.
  for (const match of html.matchAll(WHATSAPP_LINK)) {
    hasWhatsappLink = true;
    pushUnique(whatsappNumbers, extractWhatsappNumber(match[0]));
  }

  for (const match of html.matchAll(CF_EMAIL)) {
    const email = normalizeEmail(decodeCloudflareEmail(match[1] ?? ""));
    if (email && isUsableEmail(email)) pushUnique(emails, email);
  }

  const text = htmlToText(html);
  for (const match of text.matchAll(TEXT_EMAIL)) {
    const email = normalizeEmail(match[0]);
    if (email && isUsableEmail(email)) pushUnique(emails, email);
  }
  for (const pattern of TEXT_PHONES) {
    for (const match of text.matchAll(pattern)) addPhone(match[0]);
  }

  return {
    emails,
    phones,
    hasMobilePhone,
    hasWhatsappLink,
    whatsappNumbers,
    instagram,
    facebook,
    linkedin,
    contactPageLinks,
  };
}
