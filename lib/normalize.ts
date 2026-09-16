/**
 * Funcoes de normalizacao usadas por providers, repositorios e UI.
 * Este arquivo e a unica fonte dessas regras - nao duplicar em outros modulos.
 */

/** Minusculas, sem acento e sem espacos duplicados. Base para chaves e comparacoes. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Versao de normalizeText para chaves: so letras, numeros e hifen. */
export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Espacos colapsados, mantendo acentuacao e caixa originais (para exibir). */
export function cleanupText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

// ---------------------------------------------------------------- telefone

const BR_COUNTRY_CODE = "55";

/**
 * Normaliza para o formato usado no banco: apenas digitos com DDI (ex.: 5511987654321).
 * Numeros brasileiros sem DDI recebem 55. Retorna null quando nao e um telefone plausivel.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return null;

  if (digits.startsWith(BR_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `${BR_COUNTRY_CODE}${digits}`;
  }
  // Numero internacional: mantemos como veio, desde que tenha tamanho de E.164.
  if (digits.length <= 15) return digits;
  return null;
}

/** Celular brasileiro (DDD + 9 digitos) - unico caso em que assumimos WhatsApp. */
export function isBrazilianMobile(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  if (!digits.startsWith(BR_COUNTRY_CODE) || digits.length !== 13) return false;
  return digits[4] === "9";
}

/** Formata para leitura: 5511987654321 -> (11) 98765-4321. */
export function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith(BR_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    const area = digits.slice(2, 4);
    const rest = digits.slice(4);
    const middle = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const end = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `(${area}) ${middle}-${end}`;
  }
  return `+${digits}`;
}

/** Link wa.me. O envio da mensagem sempre depende de uma acao do usuario. */
export function whatsappLink(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  return normalized ? `https://wa.me/${normalized}` : null;
}

// --------------------------------------------------------------------- url

/** Garante esquema https, valida o host e remove barra final. Retorna null se invalida. */
export function normalizeUrl(value: string | null | undefined): string | null {
  const raw = cleanupText(value);
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
    url.hash = "";
    const normalized = url.toString();
    return url.pathname === "/" && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    return null;
  }
}

/** Dominio sem www, em minusculas. */
export function extractDomain(value: string | null | undefined): string | null {
  const url = normalizeUrl(value);
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------- social

export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "twitter",
  "youtube",
  "whatsapp",
  "aggregator",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** Dominios que NAO contam como site proprio da empresa. */
const SOCIAL_DOMAINS: ReadonlyArray<{ match: string; platform: SocialPlatform }> = [
  { match: "instagram.com", platform: "instagram" },
  { match: "instagr.am", platform: "instagram" },
  { match: "facebook.com", platform: "facebook" },
  { match: "fb.com", platform: "facebook" },
  { match: "fb.me", platform: "facebook" },
  { match: "linkedin.com", platform: "linkedin" },
  { match: "tiktok.com", platform: "tiktok" },
  { match: "twitter.com", platform: "twitter" },
  { match: "x.com", platform: "twitter" },
  { match: "youtube.com", platform: "youtube" },
  { match: "youtu.be", platform: "youtube" },
  { match: "wa.me", platform: "whatsapp" },
  { match: "api.whatsapp.com", platform: "whatsapp" },
  { match: "linktr.ee", platform: "aggregator" },
  { match: "linktree.com", platform: "aggregator" },
  { match: "beacons.ai", platform: "aggregator" },
  { match: "bio.link", platform: "aggregator" },
];

/** Identifica a rede social de uma URL. null = dominio proprio. */
export function detectSocialPlatform(value: string | null | undefined): SocialPlatform | null {
  const domain = extractDomain(value);
  if (!domain) return null;
  const found = SOCIAL_DOMAINS.find(
    (entry) => domain === entry.match || domain.endsWith(`.${entry.match}`),
  );
  return found ? found.platform : null;
}

/** Handle a partir de uma URL de rede social (primeiro segmento do caminho). */
export function extractSocialHandle(value: string | null | undefined): string | null {
  const url = normalizeUrl(value);
  if (!url) return null;
  try {
    const segment = new URL(url).pathname.split("/").filter(Boolean)[0];
    if (!segment) return null;
    return `@${segment.replace(/^@/, "").toLowerCase()}`;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ e-mail

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value: string | null | undefined): string | null {
  const raw = cleanupText(value)?.toLowerCase();
  if (!raw) return null;
  return EMAIL_PATTERN.test(raw) ? raw : null;
}

// -------------------------------------------------------------- localizacao

const BRAZILIAN_STATES: Readonly<Record<string, string>> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

const STATE_CODES = new Set(Object.values(BRAZILIAN_STATES));

/** Aceita "SP", "sp" ou "Sao Paulo" e devolve sempre a sigla em maiusculas. */
export function normalizeState(value: string | null | undefined): string | null {
  const raw = cleanupText(value);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper.length === 2 && STATE_CODES.has(upper)) return upper;
  return BRAZILIAN_STATES[normalizeText(raw)] ?? null;
}

/** Cidade em formato de exibicao (Title Case), preservando conectores. */
export function normalizeCity(value: string | null | undefined): string | null {
  const raw = cleanupText(value);
  if (!raw) return null;
  const connectors = new Set(["de", "da", "do", "das", "dos", "e"]);
  return raw
    .toLowerCase()
    .split(" ")
    .map((word, index) =>
      index > 0 && connectors.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

// ------------------------------------------------------------- deduplicacao

/**
 * Chave de deduplicacao usada quando o provider nao traz um id estavel.
 * Combina nome + telefone + cidade normalizados: especifico o bastante para
 * nao juntar empresas diferentes e estavel o bastante entre providers.
 */
export function buildDedupeKey(input: {
  name: string;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
}): string {
  const name = slugify(input.name);
  const phone = normalizePhone(input.phone) ?? "";
  const place = slugify(input.city ?? "") || slugify(input.address ?? "");
  return [name, phone, place].filter(Boolean).join("|");
}
