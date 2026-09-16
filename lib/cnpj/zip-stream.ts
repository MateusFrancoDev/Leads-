/**
 * Leitura em streaming da única entrada de um .zip dos Dados Abertos do CNPJ.
 *
 * Os arquivos da Receita têm um único CSV compactado com deflate. Em vez de
 * instalar uma biblioteca de zip ou extrair vários GB para o disco, lemos o
 * cabeçalho local da entrada e descompactamos o restante com o zlib do Node,
 * direto para o parser de linhas.
 */

import { createReadStream, openSync, readSync, closeSync } from "node:fs";
import { Readable } from "node:stream";
import zlib from "node:zlib";

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const LOCAL_HEADER_SIZE = 30;

export interface ZipEntryInfo {
  name: string;
  /** 0 = armazenado sem compressão, 8 = deflate. */
  method: number;
  dataOffset: number;
}

export function readFirstZipEntry(header: Buffer): ZipEntryInfo {
  if (header.length < LOCAL_HEADER_SIZE || header.readUInt32LE(0) !== LOCAL_HEADER_SIGNATURE) {
    throw new Error("Arquivo não é um zip válido.");
  }
  const method = header.readUInt16LE(8);
  const nameLength = header.readUInt16LE(26);
  const extraLength = header.readUInt16LE(28);
  if (method !== 0 && method !== 8) throw new Error(`Compressão não suportada no zip (método ${method}).`);
  return {
    name: header.toString("latin1", LOCAL_HEADER_SIZE, LOCAL_HEADER_SIZE + nameLength),
    method,
    dataOffset: LOCAL_HEADER_SIZE + nameLength + extraLength,
  };
}

/** Stream com o conteúdo descompactado da primeira entrada do zip. */
export function openZipEntryStream(filePath: string): Readable {
  const fd = openSync(filePath, "r");
  const header = Buffer.alloc(LOCAL_HEADER_SIZE + 65_535 * 2);
  let bytes: number;
  try {
    bytes = readSync(fd, header, 0, header.length, 0);
  } finally {
    closeSync(fd);
  }

  const entry = readFirstZipEntry(header.subarray(0, bytes));
  const raw = createReadStream(filePath, { start: entry.dataOffset, highWaterMark: 1024 * 1024 });
  if (entry.method === 0) return raw;

  // O fluxo deflate termina sozinho; o que vem depois (diretório central) é ignorado.
  const inflate = zlib.createInflateRaw({ chunkSize: 1024 * 1024 });
  raw.on("error", (error) => inflate.destroy(error));
  inflate.on("close", () => raw.destroy());
  return raw.pipe(inflate);
}
