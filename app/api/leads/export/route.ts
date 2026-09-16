/**
 * Download do CSV com os leads filtrados.
 *
 * Usa os mesmos filtros da tabela (query string), então o que o usuário vê e
 * exatamente o que ele exporta. Nenhuma chamada externa acontece aqui.
 */

import { createLogger } from "@/lib/logger";
import { userMessage } from "@/lib/errors";
import { parseLeadFilters } from "@/lib/validation";
import { exportLeads } from "@/server/services/lead-export";

const logger = createLogger("export");

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const params: Record<string, string | string[]> = Object.fromEntries(searchParams.entries());
  // Quando o usuário marcou leads na tabela, exporta só eles.
  const ids = searchParams.getAll("ids");
  if (ids.length > 0) params.ids = ids;

  const filters = parseLeadFilters(params);

  try {
    const { csv, filename, rows } = await exportLeads(filters);
    logger.info("csv gerado", { linhas: rows });

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("falha ao exportar");
    return new Response(userMessage(error), { status: 500 });
  }
}
