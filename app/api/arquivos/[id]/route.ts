/**
 * Download dos arquivos guardados.
 *
 * Existe porque `storage/` fica fora de `public/`: o único jeito de chegar aos
 * bytes é por aqui, e aqui a sessão é conferida antes. Sem isso, qualquer
 * pessoa com o endereço baixaria o contrato de um cliente.
 */

import { NextResponse } from "next/server";
import { isAppError, userMessage } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { requireUserOrThrow } from "@/server/auth/dal";
import { findFileWithPath } from "@/server/repositories/content-repository";
import { fileETag, readStoredFile } from "@/server/services/file-storage";

const logger = createLogger("file-download");

export async function GET(request: Request, { params }: RouteContext<"/api/arquivos/[id]">) {
  try {
    await requireUserOrThrow();

    const { id } = await params;
    const file = await findFileWithPath(id);
    if (!file) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });

    const bytes = await readStoredFile(file.path);
    const etag = fileETag(file.id, bytes.byteLength);

    // Arquivo guardado nunca muda: se o navegador já tem, não reenviamos.
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304 });
    }

    // "inline" deixa o PDF e a imagem abrirem na aba; ?download=1 força salvar.
    const forceDownload = new URL(request.url).searchParams.get("download") === "1";
    const disposition = forceDownload ? "attachment" : "inline";

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        ETag: etag,
        // Privado: nunca guardar em cache compartilhado.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (isAppError(error) && error.code === "UNAUTHORIZED") {
      return NextResponse.json({ error: userMessage(error) }, { status: 401 });
    }
    if (isAppError(error) && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: userMessage(error) }, { status: 404 });
    }
    logger.error("falha ao servir arquivo");
    return NextResponse.json({ error: "Não foi possível abrir o arquivo." }, { status: 500 });
  }
}
