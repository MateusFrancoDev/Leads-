"use server";

/**
 * Server Actions da tela de busca. Toda entrada passa por Zod antes de
 * qualquer chamada externa - nada vindo do navegador e usado direto.
 */

import { redirect } from "next/navigation";
import { userMessage } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import {
  buildLeadFiltersQuery,
  formDataToObject,
  parseLeadFilters,
  searchFormSchema,
} from "@/lib/validation";
import { executeSearch } from "@/server/services/lead-search-service";

const logger = createLogger("search-action");

export interface SearchActionState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const initialSearchActionState: SearchActionState = { status: "idle" };

export async function runSearchAction(
  _previous: SearchActionState,
  formData: FormData,
): Promise<SearchActionState> {
  const raw = formDataToObject(formData);
  const parsed = searchFormSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message;
    }
    return { status: "error", message: "Revise os campos destacados.", fieldErrors };
  }

  let searchId: string;
  try {
    const execution = await executeSearch(parsed.data);
    searchId = execution.searchId;
  } catch (error) {
    logger.error("falha na busca", { termo: parsed.data.term });
    return { status: "error", message: userMessage(error) };
  }

  // Os filtros de exibicao vao na URL: a tabela e renderizada no servidor a
  // partir do banco, sem repetir a consulta ao provider.
  const filters = parseLeadFilters(raw);
  redirect(`/buscar${buildLeadFiltersQuery(filters, { searchId, limit: undefined })}`);
}
