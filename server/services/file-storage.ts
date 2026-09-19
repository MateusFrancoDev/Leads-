/**
 * Guarda os arquivos enviados em disco, na pasta `storage/` (fora do
 * versionamento e fora de `public/`).
 *
 * Fora de `public/` de propósito: o que está em public é servido pelo Next sem
 * passar por nenhuma verificação. Contrato assinado e briefing de cliente não
 * podem ficar em endereço público e adivinhável - por isso o download passa
 * por um Route Handler que confere a sessão antes de devolver os bytes.
 *
 * O nome no disco é gerado (id + extensão); o nome original fica no banco.
 * Isso evita colisão, caminho com "../" e nome de arquivo com caractere
 * estranho vindo do navegador.
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { AppError } from "@/lib/errors";
import { serverConfig } from "@/server/config";

/** Tipos aceitos: documentos, planilhas e imagens. Nada executável. */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
]);

/** Extensões que nunca entram, mesmo se o navegador declarar um tipo inocente. */
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".scr", ".msi", ".ps1", ".sh",
  ".js", ".mjs", ".cjs", ".jar", ".app", ".dll", ".vbs",
]);

/**
 * Caminho absoluto dentro de storage/. Único ponto do módulo que monta caminho
 * de disco, e por isso o único com o comentário do Turbopack: a pasta vem do
 * .env, então o bundler não consegue analisá-la estaticamente e passaria a
 * rastrear o projeto inteiro para o build.
 */
function storagePath(...segments: string[]): string {
  return resolve(/*turbopackIgnore: true*/ process.cwd(), serverConfig.storage.dir, ...segments);
}

export interface SavedFile {
  /** Caminho relativo dentro de storage/, que vai para o banco. */
  path: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Grava o arquivo e devolve os metadados. Valida tipo, extensão e tamanho
 * antes de escrever qualquer byte.
 */
export async function saveUpload(file: File, folder: string): Promise<SavedFile> {
  if (file.size === 0) {
    throw new AppError("INVALID_INPUT", "O arquivo está vazio.");
  }
  if (file.size > serverConfig.storage.maxUploadBytes) {
    throw new AppError(
      "INVALID_INPUT",
      `Arquivo maior que o limite de ${serverConfig.storage.maxUploadMb} MB.`,
    );
  }

  const extension = extname(file.name).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw new AppError("INVALID_INPUT", "Este tipo de arquivo não é aceito.");
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new AppError("INVALID_INPUT", `Tipo de arquivo não aceito (${file.type || "desconhecido"}).`);
  }

  // A pasta vem de um id do banco, mas nunca confiamos: só letras, números e traço.
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "geral";
  const fileName = `${randomUUID()}${extension}`;

  await mkdir(storagePath(safeFolder), { recursive: true });
  await writeFile(storagePath(safeFolder, fileName), Buffer.from(await file.arrayBuffer()));

  return {
    path: `${safeFolder}/${fileName}`,
    // O nome exibido é do usuário, então limitamos tamanho e tiramos separadores.
    name: file.name.replace(/[\\/]/g, "_").slice(0, 200) || `arquivo${extension}`,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

/**
 * Resolve o caminho relativo para um caminho absoluto, garantindo que ele
 * continua dentro de storage/. Sem esta checagem, um "path" adulterado no
 * banco poderia ler qualquer arquivo da máquina.
 */
function resolveInsideStorage(relativePath: string): string {
  const root = storagePath();
  const absolute = storagePath(relativePath);
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    throw new AppError("NOT_FOUND", "Arquivo não encontrado.");
  }
  return absolute;
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  try {
    return await readFile(resolveInsideStorage(relativePath));
  } catch {
    throw new AppError("NOT_FOUND", "O arquivo não está mais no disco.");
  }
}

/** Apaga o arquivo do disco. Sumiço silencioso: o registro já foi removido. */
export async function removeStoredFile(relativePath: string): Promise<void> {
  try {
    await unlink(resolveInsideStorage(relativePath));
  } catch {
    // Arquivo já não existe: nada a fazer.
  }
}

/** ETag estável para o navegador guardar o arquivo em cache. */
export function fileETag(id: string, sizeBytes: number): string {
  return `"${createHash("sha1").update(`${id}:${sizeBytes}`).digest("hex")}"`;
}

/** "1,2 MB" - tamanho legível na listagem. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
