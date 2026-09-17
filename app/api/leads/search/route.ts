/**
 * POST /api/leads/search - busca empresas reais por segmento e cidade.
 *
 * Exige Content-Type application/json: um site qualquer aberto no navegador
 * não consegue disparar a busca por um formulário simples (o navegador pediria
 * permissão CORS antes, e ela não é concedida).
 */

import { after } from "next/server";
import { createLogger } from "@/lib/logger";
import { leadSearchRequestSchema } from "@/lib/validation";
import { appErrorResponse, errorCode, errorResponse } from "@/server/api/errors";
import { searchLeads } from "@/server/services/lead-search-service";

const logger = createLogger("api-lead-search");

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Envie o corpo como application/json.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "JSON inválido.");
  }

  const parsed = leadSearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      field: issue.path.join(".") || "body",
      message: issue.message,
    }));
    return errorResponse(400, "INVALID_INPUT", "Revise os campos da busca.", details);
  }

  const { query, city, state, limit, extraCities, ...filters } = parsed.data;

  try {
    const outcome = await searchLeads(
      { query, city, state, limit, extraCities, filters },
      { scheduleBackground: (task) => after(task) },
    );
    return Response.json(
      {
        leads: outcome.leads,
        metadata: { ...outcome.metadata, source: outcome.source, searchId: outcome.searchId },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logger.error("falha na busca", { code: errorCode(error) });
    return appErrorResponse(error);
  }
}
