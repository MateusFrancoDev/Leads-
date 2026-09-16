/**
 * Download de páginas de terceiros com proteção contra SSRF.
 *
 * A URL do site vem de dado público (OpenStreetMap), então é tratada como
 * hostil. Antes de cada conexão - inclusive em cada redirect:
 * - só http/https, sem usuário/senha na URL e apenas portas 80/443;
 * - nomes como localhost/.local/.internal são recusados;
 * - o IP é verificado NO MOMENTO da conexão, pelo `lookup` do próprio socket.
 *   Validar o DNS antes e conectar depois abriria espaço para DNS rebinding;
 *   aqui o endereço conferido é exatamente o endereço usado.
 * Também há timeout total, limite de redirects e de bytes (inclusive depois
 * de descompactar, contra "zip bombs").
 */

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import zlib from "node:zlib";

export type SafeFetchErrorCode =
  | "INVALID_URL"
  | "BLOCKED_PROTOCOL"
  | "BLOCKED_PORT"
  | "BLOCKED_HOST"
  | "BLOCKED_ADDRESS"
  | "TOO_MANY_REDIRECTS"
  | "TIMEOUT"
  | "NETWORK";

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;

  constructor(code: SafeFetchErrorCode, message: string) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

// ------------------------------------------------------------------ endereços

// Listas separadas por versão: numa lista única, as regras IPv6 que embutem
// IPv4 (::ffff:0:0/96) também casam com qualquer endereço IPv4.
const BLOCKED_IPV4 = new BlockList();
const BLOCKED_IPV6 = new BlockList();
// IPv4: "this network", privadas, CGNAT, loopback, link-local (inclui o
// 169.254.169.254 de metadados de nuvem), documentação, benchmark, multicast e reservadas.
BLOCKED_IPV4.addSubnet("0.0.0.0", 8, "ipv4");
BLOCKED_IPV4.addSubnet("10.0.0.0", 8, "ipv4");
BLOCKED_IPV4.addSubnet("100.64.0.0", 10, "ipv4");
BLOCKED_IPV4.addSubnet("127.0.0.0", 8, "ipv4");
BLOCKED_IPV4.addSubnet("169.254.0.0", 16, "ipv4");
BLOCKED_IPV4.addSubnet("172.16.0.0", 12, "ipv4");
BLOCKED_IPV4.addSubnet("192.0.0.0", 24, "ipv4");
BLOCKED_IPV4.addSubnet("192.0.2.0", 24, "ipv4");
BLOCKED_IPV4.addSubnet("192.168.0.0", 16, "ipv4");
BLOCKED_IPV4.addSubnet("198.18.0.0", 15, "ipv4");
BLOCKED_IPV4.addSubnet("198.51.100.0", 24, "ipv4");
BLOCKED_IPV4.addSubnet("203.0.113.0", 24, "ipv4");
BLOCKED_IPV4.addSubnet("224.0.0.0", 4, "ipv4");
BLOCKED_IPV4.addSubnet("240.0.0.0", 4, "ipv4");
// IPv6: não especificado, loopback, ULA, link-local, multicast, documentação,
// e prefixos que embutem IPv4 (mapeado, NAT64, 6to4, Teredo).
BLOCKED_IPV6.addAddress("::", "ipv6");
BLOCKED_IPV6.addAddress("::1", "ipv6");
BLOCKED_IPV6.addSubnet("fc00::", 7, "ipv6");
BLOCKED_IPV6.addSubnet("fe80::", 10, "ipv6");
BLOCKED_IPV6.addSubnet("ff00::", 8, "ipv6");
BLOCKED_IPV6.addSubnet("2001:db8::", 32, "ipv6");
BLOCKED_IPV6.addSubnet("2001::", 32, "ipv6");
BLOCKED_IPV6.addSubnet("2002::", 16, "ipv6");
BLOCKED_IPV6.addSubnet("64:ff9b::", 96, "ipv6");
BLOCKED_IPV6.addSubnet("::ffff:0:0", 96, "ipv6");

/** IPv4 embutido em "::ffff:10.0.0.1" ou "::ffff:a00:1". */
function embeddedIpv4(ip: string): string | null {
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (dotted) return dotted[1];
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
  if (!hex) return null;
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

/** true só para endereços roteáveis na internet pública. */
export function isPublicIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return !BLOCKED_IPV4.check(ip, "ipv4");
  if (version === 6) {
    const mapped = embeddedIpv4(ip);
    if (mapped) return isPublicIpAddress(mapped);
    return !BLOCKED_IPV6.check(ip, "ipv6");
  }
  return false;
}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".lan", ".intranet"];

export interface UrlPolicy {
  /** Portas aceitas. Padrão: 80 e 443. */
  allowedPorts?: readonly number[] | "any";
  /** Decide se um IP pode ser acessado. Padrão: isPublicIpAddress. */
  isAllowedAddress?: (ip: string) => boolean;
}

/** Valida a URL antes de qualquer conexão. Lança SafeFetchError quando recusada. */
export function assertUrlAllowed(rawUrl: string, policy: UrlPolicy = {}): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError("INVALID_URL", "URL inválida.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("BLOCKED_PROTOCOL", `Protocolo não permitido: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new SafeFetchError("INVALID_URL", "URL com credenciais não é permitida.");
  }

  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  const allowedPorts = policy.allowedPorts ?? [80, 443];
  if (allowedPorts !== "any" && !allowedPorts.includes(port)) {
    throw new SafeFetchError("BLOCKED_PORT", `Porta não permitida: ${port}`);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!hostname) throw new SafeFetchError("INVALID_URL", "URL sem host.");

  const isAllowedAddress = policy.isAllowedAddress ?? isPublicIpAddress;
  if (isIP(hostname)) {
    if (!isAllowedAddress(hostname)) {
      throw new SafeFetchError("BLOCKED_ADDRESS", "Endereço de rede interna não permitido.");
    }
    return url;
  }

  if (
    hostname === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    // Nome sem ponto só resolve em rede interna.
    !hostname.includes(".")
  ) {
    throw new SafeFetchError("BLOCKED_HOST", "Host interno não permitido.");
  }
  return url;
}

// --------------------------------------------------------------------- fetch

export type HostResolver = (hostname: string) => Promise<LookupAddress[]>;

const systemResolver: HostResolver = (hostname) =>
  new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) reject(error);
      else resolve(addresses);
    });
  });

export interface SafeFetchOptions extends UrlPolicy {
  timeoutMs: number;
  maxBytes: number;
  maxRedirects?: number;
  userAgent: string;
  resolveHost?: HostResolver;
}

export interface SafeFetchResult {
  status: number;
  finalUrl: string;
  contentType: string | null;
  /** Corpo decodificado; vazio para respostas que não são HTML/texto. */
  body: string;
  truncated: boolean;
  redirects: number;
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/** `lookup` do socket: resolve o DNS e só entrega endereços permitidos. */
function guardedLookup(resolveHost: HostResolver, isAllowedAddress: (ip: string) => boolean) {
  return (hostname: string, options: { all?: boolean }, callback: LookupCallback) => {
    resolveHost(hostname)
      .then((addresses) => {
        if (addresses.length === 0 || addresses.some((entry) => !isAllowedAddress(entry.address))) {
          const error: NodeJS.ErrnoException = new SafeFetchError(
            "BLOCKED_ADDRESS",
            "O domínio aponta para um endereço de rede interna.",
          );
          callback(error, "", 0);
          return;
        }
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      })
      .catch((error: NodeJS.ErrnoException) => callback(error, "", 0));
  };
}

function charsetOf(contentType: string | null, head: Buffer): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (fromHeader) return fromHeader;
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head.toString("latin1"))?.[1];
  return fromMeta ?? "utf-8";
}

function decodeBody(buffer: Buffer, contentType: string | null): string {
  try {
    return new TextDecoder(charsetOf(contentType, buffer.subarray(0, 2048))).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

const READABLE_CONTENT = /^(text\/html|application\/xhtml\+xml|text\/plain)/i;

interface SingleResponse {
  status: number;
  location: string | null;
  contentType: string | null;
  body: Buffer;
  truncated: boolean;
}

function requestOnce(url: URL, options: SafeFetchOptions, signal: AbortSignal): Promise<SingleResponse> {
  const client = url.protocol === "https:" ? https : http;
  const lookup = guardedLookup(options.resolveHost ?? systemResolver, options.isAllowedAddress ?? isPublicIpAddress);

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: "GET",
        lookup: lookup as unknown as typeof dnsLookup,
        signal,
        headers: {
          "User-Agent": options.userAgent,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "Accept-Language": "pt-BR,pt;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (response: IncomingMessage) => {
        const status = response.statusCode ?? 0;
        const location = typeof response.headers.location === "string" ? response.headers.location : null;
        const contentType = response.headers["content-type"] ?? null;

        if ((status >= 300 && status < 400) || !READABLE_CONTENT.test(contentType ?? "text/html")) {
          response.resume();
          resolve({ status, location, contentType, body: Buffer.alloc(0), truncated: false });
          return;
        }

        const encoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          encoding === "gzip" || encoding === "x-gzip"
            ? response.pipe(zlib.createGunzip())
            : encoding === "deflate"
              ? response.pipe(zlib.createInflate())
              : encoding === "br"
                ? response.pipe(zlib.createBrotliDecompress())
                : response;

        const chunks: Buffer[] = [];
        let size = 0;
        let settled = false;
        const finish = (truncated: boolean) => {
          if (settled) return;
          settled = true;
          resolve({ status, location, contentType, body: Buffer.concat(chunks), truncated });
        };

        stream.on("data", (chunk: Buffer) => {
          if (settled) return;
          const remaining = options.maxBytes - size;
          if (chunk.length >= remaining) {
            chunks.push(chunk.subarray(0, Math.max(0, remaining)));
            size = options.maxBytes;
            finish(true);
            request.destroy();
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        stream.on("end", () => finish(false));
        stream.on("error", (error: Error) => {
          // Corpo parcial ainda é útil quando a conexão cai no fim.
          if (size > 0) finish(true);
          else if (!settled) {
            settled = true;
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

/**
 * GET seguro de uma página. Segue redirects manualmente, validando cada destino.
 * Lança SafeFetchError quando a URL (ou um redirect) é recusada ou a rede falha.
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? 3;
  const signal = AbortSignal.timeout(options.timeoutMs);
  let url = assertUrlAllowed(rawUrl, options);

  for (let redirects = 0; ; redirects += 1) {
    let response: SingleResponse;
    try {
      response = await requestOnce(url, options, signal);
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      const cause = (error as { cause?: unknown }).cause;
      if (cause instanceof SafeFetchError) throw cause;
      if (signal.aborted) throw new SafeFetchError("TIMEOUT", "Tempo limite excedido.");
      throw new SafeFetchError("NETWORK", "Falha de rede ao acessar o site.");
    }

    if (response.status >= 300 && response.status < 400 && response.location) {
      if (redirects >= maxRedirects) {
        throw new SafeFetchError("TOO_MANY_REDIRECTS", "Redirecionamentos demais.");
      }
      let next: string;
      try {
        next = new URL(response.location, url).toString();
      } catch {
        throw new SafeFetchError("INVALID_URL", "Redirect para URL inválida.");
      }
      url = assertUrlAllowed(next, options);
      continue;
    }

    return {
      status: response.status,
      finalUrl: url.toString(),
      contentType: response.contentType,
      body: response.body.length > 0 ? decodeBody(response.body, response.contentType) : "",
      truncated: response.truncated,
      redirects,
    };
  }
}
