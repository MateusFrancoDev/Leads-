/**
 * POST /api/leads/:id/analyze - analisa um lead já gravado com a IA.
 *
 * Fluxo: valida a entrada -> busca o lead no banco -> pré-qualifica ->
 * chama o provider -> valida a resposta com Zod -> grava -> devolve.
 * Tudo isso acontece no servidor: a chave da IA nunca chega ao navegador, e
 * esta resposta carrega só a análise.
 *
 * É a rota que a análise em lote consome, um lead por requisição - assim um
 * lead que falha não interrompe os outros e o progresso aparece na hora.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { appErrorResponse, errorCode, errorResponse } from "@/server/api/errors";
import { analyzeLeadOpportunity } from "@/server/services/lead-ai-service";

const logger = createLogger("api-lead-analyze");

/** Corpo opcional: sem corpo, é a primeira análise; com `force`, é "Reanalisar". */
const bodySchema = z.object({ force: z.boolean().default(false) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown = {};
  if (request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "INVALID_JSON", "JSON inválido.");
    }
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "INVALID_INPUT", "Parâmetros de análise inválidos.");
  }

  try {
    const outcome = await analyzeLeadOpportunity(id, { force: parsed.data.force });

    if (outcome.status === "skipped" && outcome.reason === "not-qualified") {
      return Response.json(
        { status: "skipped", reason: outcome.reason, message: outcome.message, analysis: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // A página do lead e a tabela mostram score e data da análise.
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");

    return Response.json(
      {
        status: outcome.status,
        reason: outcome.status === "skipped" ? outcome.reason : undefined,
        analysis: outcome.analysis,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // O detalhe técnico fica no log do servidor; o cliente recebe a mensagem segura.
    logger.error("falha ao analisar lead", { leadId: id, code: errorCode(error) });
    return appErrorResponse(error);
  }
}
