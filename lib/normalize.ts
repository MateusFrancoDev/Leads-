/**
 * Funções de normalização usadas por providers, repositórios e UI.
 * Este arquivo e a única fonte dessas regras - não duplicar em outros módulos.
 */

/** Minúsculas, sem acento e sem espaços duplicados. Base para chaves e comparações. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Versão de normalizeText para chaves: só letras, números e hífen. */
export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Espaços colapsados, mantendo acentuação e caixa originais (para exibir). */
export function cleanupText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

// ---------------------------------------------------------------- telefone

const BR_COUNTRY_CODE = "55";

/** DDDs em uso no Brasil (Anatel). Número com DDD fora da lista é descartado. */
const VALID_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

export interface BrazilianPhone {
  /** Formato gravado no banco: 55 + DDD + número (ou 0800... para não geográficos). */
  digits: string;
  ddd: string | null;
  /** Celular (9 dígitos começando com 9). Nunca significa "tem WhatsApp". */
  isMobile: boolean;
  /** 0800, 0300, 0303, 0500 e 0900: sem DDD e sem WhatsApp. */
  isNonGeographic: boolean;
}

/**
 * Interpreta um telefone brasileiro escrito de qualquer jeito
 * ("+55 (11) 9 8765-4321", "011 3456-7890", "0 21 11 98765 4321").
 *
 * Só aceita o que dá para discar como está: nada é completado. Celular antigo
 * sem o nono dígito, número sem DDD ou com DDD inexistente retornam null.
 */
export function normalizeBrazilianPhone(value: string | null | undefined): BrazilianPhone | null {
  if (!value) return null;
  // Ramal não faz parte do número discável.
  const main = value.split(/\b(?:ramal|ext\.?|r\.)/i)[0] ?? "";
  let digits = main.replace(/\D/g, "");
  if (digits.length < 10) return null;

  if (/^0(?:800|300|303|500|900)\d{7}$/.test(digits)) {
    return { digits, ddd: null, isMobile: false, isNonGeographic: true };
  }

  if (digits.startsWith(BR_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    // 0 + DDD + número, ou 0 + operadora (2 dígitos) + DDD + número.
    const withoutTrunk = digits.slice(1);
    if (withoutTrunk.length === 10 || withoutTrunk.length === 11) digits = withoutTrunk;
    else if (withoutTrunk.length === 12 || withoutTrunk.length === 13) digits = withoutTrunk.slice(2);
    else return null;
  }

  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = digits.slice(0, 2);
  const subscriber = digits.slice(2);
  if (!VALID_DDDS.has(ddd)) return null;

  const isMobile = subscriber.length === 9 && subscriber.startsWith("9");
  const isLandline = subscriber.length === 8 && /^[2-5]/.test(subscriber);
  if (!isMobile && !isLandline) return null;

  return { digits: `${BR_COUNTRY_CODE}${digits}`, ddd, isMobile, isNonGeographic: false };
}

/**
 * Normaliza para o formato usado no banco (ex.: 5511987654321).
 * Retorna null quando não é um telefone brasileiro válido.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  return normalizeBrazilianPhone(value)?.digits ?? null;
}

/** Celular brasileiro. Indica WhatsApp apenas como possibilidade, nunca como fato. */
export function isBrazilianMobile(phone: string | null | undefined): boolean {
  return normalizeBrazilianPhone(phone)?.isMobile ?? false;
}

/** Formata para leitura: 5511987654321 -> (11) 98765-4321. */
export function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.startsWith(BR_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    const area = digits.slice(2, 4);
    const rest = digits.slice(4);
    const middle = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const end = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `(${area}) ${middle}-${end}`;
  }
  return `+${digits}`;
}

/** Link wa.me. O envio da mensagem sempre depende de uma ação do usuário. */
export function whatsappLink(phone: string | null | undefined): string | null {
  const normalized = normalizeBrazilianPhone(phone);
  if (!normalized || normalized.isNonGeographic) return null;
  return `https://wa.me/${normalized.digits}`;
}

// --------------------------------------------------------------------- url

/** Garante esquema https, valida o host e remove barra final. Retorna null se inválida. */
export function normalizeUrl(value: string | null | undefined): string | null {
  const raw = cleanupText(value);
  if (!raw) return null;
  // Qualquer esquema que não seja http(s) (ftp://, file://, javascript:) é recusado.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
  if (/^(?:javascript|data|file|mailto|tel):/i.test(raw)) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
    url.hash = "";
    const normalized = url.toString();
    return url.pathname === "/" && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    return null;
  }
}

/** Domínio sem www, em minúsculas. */
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

/** Domínios que NÃO contam como site próprio da empresa. */
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

/** Identifica a rede social de uma URL. null = domínio próprio. */
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

/** Caminhos que são páginas da própria rede (post, compartilhar), não perfis. */
const NON_PROFILE_SEGMENTS: Readonly<Record<"instagram" | "facebook" | "linkedin", ReadonlySet<string>>> = {
  instagram: new Set(["p", "reel", "reels", "tv", "explore", "stories", "accounts", "direct", "about", "legal", "developer"]),
  facebook: new Set(["sharer", "sharer.php", "share", "share.php", "dialog", "plugins", "tr", "login", "login.php", "help", "policies", "events", "watch", "hashtag"]),
  linkedin: new Set(["sharing", "shareArticle", "feed", "login", "signup", "help", "legal"]),
};

const INSTAGRAM_HANDLE = /^@?([A-Za-z0-9._]{1,30})$/;
const FACEBOOK_HANDLE = /^@?([A-Za-z0-9.\-]{2,80})$/;

/**
 * URL canônica de perfil a partir do que a fonte informou explicitamente: uma
 * URL da rede ou o nome de usuário (ex.: etiqueta contact:instagram=clinicabella).
 *
 * Nunca deriva um perfil do nome da empresa - só formata o que já veio escrito.
 * Retorna null para links de post, compartilhamento ou de outra rede.
 */
export function normalizeSocialProfileUrl(
  platform: "instagram" | "facebook" | "linkedin",
  value: string | null | undefined,
): string | null {
  const raw = cleanupText(value);
  if (!raw) return null;

  const looksLikeUrl = /[/.]/.test(raw) && (/^https?:\/\//i.test(raw) || /\.(com|me|am)\b/i.test(raw));
  if (!looksLikeUrl) {
    if (platform === "linkedin") return null;
    const match = (platform === "instagram" ? INSTAGRAM_HANDLE : FACEBOOK_HANDLE).exec(raw);
    if (!match) return null;
    const host = platform === "instagram" ? "www.instagram.com" : "www.facebook.com";
    return `https://${host}/${match[1]}`;
  }

  const url = normalizeUrl(raw);
  if (!url || detectSocialPlatform(url) !== platform) return null;

  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (!first || NON_PROFILE_SEGMENTS[platform].has(first)) return null;

  if (platform === "instagram") {
    const match = INSTAGRAM_HANDLE.exec(first);
    return match ? `https://www.instagram.com/${match[1]}` : null;
  }
  if (platform === "facebook") {
    if (first === "profile.php") {
      const id = parsed.searchParams.get("id");
      return id && /^\d+$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}` : null;
    }
    if (first === "pages" || first === "people") {
      return segments.length >= 2 ? `https://www.facebook.com/${segments.slice(0, 3).join("/")}` : null;
    }
    return `https://www.facebook.com/${first}`;
  }
  // LinkedIn: só páginas de empresa ou de pessoa.
  if ((first === "company" || first === "in" || first === "school") && segments[1]) {
    return `https://www.linkedin.com/${first}/${segments[1]}`;
  }
  return null;
}

// ------------------------------------------------------------------ e-mail

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value: string | null | undefined): string | null {
  const raw = cleanupText(value)?.toLowerCase();
  if (!raw) return null;
  return EMAIL_PATTERN.test(raw) ? raw : null;
}

// -------------------------------------------------------------- localização

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

/** Siglas das UFs em ordem alfabética, para selects. */
export const BRAZILIAN_STATE_CODES: readonly string[] = [...STATE_CODES].sort();

/** Nome da UF (sem acento, que o Nominatim aceita): "SP" -> "sao paulo". */
export function stateNameFromCode(code: string | null | undefined): string | null {
  const upper = code?.trim().toUpperCase();
  if (!upper) return null;
  const entry = Object.entries(BRAZILIAN_STATES).find(([, value]) => value === upper);
  return entry ? entry[0] : null;
}

/** Aceita "SP", "sp" ou "São Paulo" e devolve sempre a sigla em maiúsculas. */
export function normalizeState(value: string | null | undefined): string | null {
  const raw = cleanupText(value);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper.length === 2 && STATE_CODES.has(upper)) return upper;
  return BRAZILIAN_STATES[normalizeText(raw)] ?? null;
}

/** Cidade em formato de exibição (Title Case), preservando conectores. */
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

/** CEP brasileiro no formato 00000-000. Qualquer outra coisa vira null. */
export function normalizePostalCode(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : null;
}

// ------------------------------------------------------------- deduplicação

/**
 * Texto para comparação: sem acento, sem caixa, sem pontuação e sem espaços
 * duplicados. "BARBEARIA JOÃO!" e "Barbearia  Joao" viram "barbearia joao".
 */
export function normalizeForComparison(value: string | null | undefined): string {
  if (!value) return "";
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Chave única de último recurso. Com id real na fonte, a chave é o próprio id
 * (duas unidades de uma rede com o mesmo nome continuam sendo leads distintos);
 * a comparação por telefone, domínio, endereço e proximidade fica em
 * lib/leads/deduplication.ts.
 */
export function buildDedupeKey(input: {
  provider: string;
  externalId?: string | null;
  name: string;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
}): string {
  if (input.externalId) return `${input.provider}:${input.externalId}`;
  const name = slugify(input.name);
  const phone = normalizePhone(input.phone) ?? "";
  const place = slugify(input.address ?? "") || slugify(input.city ?? "");
  return [name, phone, place].filter(Boolean).join("|");
}
