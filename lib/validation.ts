/**
 * Schemas Zod de tudo que entra na aplicacao: formulario de busca e filtros
 * vindos da URL. Nenhum dado do navegador e usado sem passar por aqui.
 */

import { z } from "zod";
import { LEAD_STATUS_ORDER, LeadStatus } from "@/types/lead";
import { APP_CONFIG } from "@/lib/config/app-config";

/** Filtro de tres estados usado nas colunas "possui / nao possui". */
export const TRI_STATE = ["any", "yes", "no"] as const;
export type TriState = (typeof TRI_STATE)[number];

const triState = z.enum(TRI_STATE).catch("any");

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional().catch(undefined);

export const LEAD_SORT_OPTIONS = ["score", "recent", "reviews", "rating"] as const;
export type LeadSort = (typeof LEAD_SORT_OPTIONS)[number];

export const LEAD_SORT_LABELS: Record<LeadSort, string> = {
  score: "Maior score",
  recent: "Mais recentes",
  reviews: "Mais avaliacoes",
  rating: "Melhor nota",
};

/** Filtros da tabela de leads (lidos da query string). */
export const leadFiltersSchema = z.object({
  q: optionalText(120),
  category: optionalText(120),
  city: optionalText(120),
  state: optionalText(60),
  neighborhood: optionalText(120),

  website: triState,
  phone: triState,
  whatsapp: triState,
  instagram: triState,
  email: triState,

  minRating: z.coerce.number().min(0).max(5).optional().catch(undefined),
  minReviews: z.coerce.number().int().min(0).max(100_000).optional().catch(undefined),
  maxReviews: z.coerce.number().int().min(0).max(100_000).optional().catch(undefined),
  minScore: z.coerce.number().int().min(0).max(100).optional().catch(undefined),
  status: z.enum(LEAD_STATUS_ORDER as unknown as [LeadStatus, ...LeadStatus[]]).optional().catch(undefined),
  favorites: z.coerce.boolean().optional().catch(undefined),

  searchId: optionalText(40),
  listId: optionalText(40),
  /** Selecao explicita de leads (checkboxes da tabela). */
  ids: z.array(z.string().min(1).max(40)).max(500).optional().catch(undefined),
  sort: z.enum(LEAD_SORT_OPTIONS).catch("score"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(APP_CONFIG.pagination.maxPageSize)
    .catch(APP_CONFIG.pagination.defaultPageSize),
});

export type LeadFilters = z.infer<typeof leadFiltersSchema>;

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Remove chaves vazias antes de validar - "" nao deve virar 0 nem filtro ativo. */
export function parseLeadFilters(params: RawSearchParams): LeadFilters {
  const cleaned: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    // "ids" e o unico filtro com varios valores (uma checkbox por lead).
    if (key === "ids") {
      const ids = (Array.isArray(value) ? value : [value]).filter(
        (item): item is string => typeof item === "string" && item.trim() !== "",
      );
      if (ids.length > 0) cleaned.ids = ids;
      continue;
    }
    const single = Array.isArray(value) ? value[0] : value;
    if (typeof single === "string" && single.trim() !== "") cleaned[key] = single.trim();
  }
  return leadFiltersSchema.parse(cleaned);
}

/** Monta a query string preservando apenas filtros ativos. */
export function buildLeadFiltersQuery(
  filters: Partial<LeadFilters>,
  overrides: Partial<Record<keyof LeadFilters, string | number | undefined>> = {},
): string {
  const params = new URLSearchParams();
  const merged: Record<string, unknown> = { ...filters, ...overrides };

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === "" || value === "any") continue;
    // A selecao e momentanea: nunca entra nos links de navegacao.
    if (key === "ids") continue;
    if (key === "sort" && value === "score") continue;
    if (key === "limit" && value === APP_CONFIG.pagination.defaultPageSize) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Formulario "Buscar empresas". Validado no Server Action antes de gastar API. */
export const searchFormSchema = z.object({
  term: z
    .string()
    .trim()
    .min(2, "Informe o ramo ou nicho (ex.: clinicas de estetica)")
    .max(120, "Ramo muito longo"),
  keyword: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(60).optional(),
  neighborhood: z.string().trim().max(120).optional(),
  radiusKm: z.coerce.number().min(1, "Raio minimo de 1 km").max(50, "Raio maximo de 50 km").optional(),
});

export type SearchFormInput = z.infer<typeof searchFormSchema>;

/** Converte FormData em objeto simples, descartando campos vazios. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && value.trim() !== "") result[key] = value.trim();
  }
  return result;
}

/** Criacao de lista de prospeccao. */
export const listFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome para a lista")
    .max(80, "Nome muito longo"),
  description: z.string().trim().max(240).optional(),
});

export type ListFormInput = z.infer<typeof listFormSchema>;
