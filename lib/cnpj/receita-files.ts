/**
 * Acesso aos arquivos dos Dados Abertos do CNPJ publicados pela Receita Federal.
 *
 * Os arquivos ficam num compartilhamento público do Nextcloud da Receita,
 * acessível por WebDAV sem senha. O servidor é lento e às vezes derruba a
 * conexão, por isso o download retoma de onde parou (Range) e tenta de novo.
 */

import { createWriteStream, existsSync, statSync, renameSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

export const RECEITA_WEBDAV_URL = "https://arquivos.receitafederal.gov.br/public.php/webdav";
/** Token público do compartilhamento (vai como usuário, sem senha). */
export const RECEITA_SHARE_TOKEN = "YggdBLfdninEJX9";

const AUTH_HEADER = `Basic ${Buffer.from(`${RECEITA_SHARE_TOKEN}:`).toString("base64")}`;

export interface RemoteFile {
  name: string;
  size: number;
}

/** Lista uma pasta do compartilhamento (PROPFIND com profundidade 1). */
export async function listRemoteFolder(path = "", userAgent: string): Promise<RemoteFile[]> {
  const response = await fetch(`${RECEITA_WEBDAV_URL}/${path}`, {
    method: "PROPFIND",
    headers: { Authorization: AUTH_HEADER, Depth: "1", "User-Agent": userAgent },
    signal: AbortSignal.timeout(90_000),
  });
  if (response.status !== 207) throw new Error(`Receita Federal respondeu HTTP ${response.status} ao listar "${path}".`);
  return parsePropfind(await response.text());
}

export function parsePropfind(xml: string): RemoteFile[] {
  const files: RemoteFile[] = [];
  for (const match of xml.matchAll(/<d:response>([\s\S]*?)<\/d:response>/g)) {
    const href = /<d:href>([^<]+)<\/d:href>/.exec(match[1])?.[1];
    if (!href) continue;
    const name = decodeURIComponent(href.replace(/\/$/, "").split("/").pop() ?? "");
    const size = Number(/<d:getcontentlength>(\d+)<\/d:getcontentlength>/.exec(match[1])?.[1] ?? 0);
    if (name && name !== "webdav") files.push({ name, size });
  }
  return files;
}

/** Pasta mensal mais recente (ex.: "2026-09"). */
export function latestMonth(entries: readonly RemoteFile[]): string | null {
  const months = entries.map((entry) => entry.name).filter((name) => /^\d{4}-\d{2}$/.test(name)).sort();
  return months.at(-1) ?? null;
}

export interface DownloadOptions {
  userAgent: string;
  maxAttempts?: number;
  /** Sem receber nenhum byte por este tempo, a conexão é refeita. */
  idleTimeoutMs?: number;
  onProgress?: (downloaded: number, total: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Baixa um arquivo para `target`, retomando um `.part` existente. Arquivo já
 * completo (mesmo tamanho) não é baixado de novo.
 */
export async function downloadRemoteFile(remotePath: string, expectedSize: number, target: string, options: DownloadOptions): Promise<void> {
  if (existsSync(target) && statSync(target).size === expectedSize) return;
  await mkdir(dirname(target), { recursive: true });

  const partial = `${target}.part`;
  const maxAttempts = options.maxAttempts ?? 20;
  const idleTimeoutMs = options.idleTimeoutMs ?? 60_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const offset = existsSync(partial) ? statSync(partial).size : 0;
    if (offset === expectedSize) break;
    if (offset > expectedSize) throw new Error(`Arquivo parcial maior que o esperado: ${partial}. Apague-o e rode de novo.`);

    const controller = new AbortController();
    let idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
    };

    try {
      const response = await fetch(`${RECEITA_WEBDAV_URL}/${remotePath}`, {
        headers: {
          Authorization: AUTH_HEADER,
          "User-Agent": options.userAgent,
          ...(offset > 0 ? { Range: `bytes=${offset}-` } : {}),
        },
        signal: controller.signal,
      });
      if (offset > 0 && response.status !== 206) throw new Error(`Servidor não retomou o download (HTTP ${response.status}).`);
      if (offset === 0 && response.status !== 200) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error("Resposta sem corpo.");

      let downloaded = offset;
      const progress = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          downloaded += chunk.length;
          resetIdle();
          options.onProgress?.(downloaded, expectedSize);
          callback(null, chunk);
        },
      });
      await pipeline(
        Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>),
        progress,
        createWriteStream(partial, { flags: offset > 0 ? "a" : "w" }),
      );
    } catch (error) {
      lastError = error;
      await sleep(Math.min(30_000, 2_000 * attempt));
    } finally {
      clearTimeout(idleTimer);
    }
  }

  const size = existsSync(partial) ? statSync(partial).size : 0;
  if (size !== expectedSize) {
    throw new Error(
      `Não foi possível baixar ${remotePath} (${size} de ${expectedSize} bytes). ` +
        `Rode o import de novo: o download continua de onde parou. Último erro: ${String(lastError)}`,
    );
  }
  renameSync(partial, target);
}
