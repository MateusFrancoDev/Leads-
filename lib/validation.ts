/**
 * Schemas Zod de tudo que entra na aplicação: formulário de busca, payload da
 * API e filtros vindos da URL. Nenhum dado do navegador e usado sem passar por aqui.
 */

import { z } from "zod";
import { LEAD_STATUS_ORDER, LeadStatus } from "@/types/lead";
import { APP_CONFIG } from "@/lib/config/app-config";
import {
  DEFAULT_SEARCH_QUANTITY,
  MAX_SEARCH_QUANTITY,
  SITE_FILTER_OPTIONS,
  WHATSAPP_FILTER_OPTIONS,
} from "@/lib/leads/filter-options";
import { WEBSITE_STATUSES, type LeadSearchFilters } from "@/lib/leads/types";
import { normalizeState } from "@/lib/normalize";

/** Filtro de três estados usado nas colunas "possui / não possui". */
export const TRI_STATE = ["any", "yes", "no"] as const;
export type TriState = (typeof TRI_STATE)[number];

const triState = z.enum(TRI_STATE).catch("any");

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional().catch(undefined);

export const LEAD_SORT_OPTIONS = ["score", "recent", "name"] as const;
export type LeadSort = (typeof LEAD_SORT_OPTIONS)[number];

export const LEAD_SORT_LABELS: Record<LeadSort, string> = {
  score: "Maior score",
  recent: "Mais recentes",
  name: "Nome (A-Z)",
};

/** Filtros da tabela de leads (lidos da query string). */
export const leadFiltersSchema = z.object({
  q: optionalText(120),
  category: optionalText(120),
  city: optionalText(120),
  state: optionalText(60),
  neighborhood: optionalText(120),

  site: z.enum(SITE_FILTER_OPTIONS).catch("any"),
  phone: triState,
  whatsapp: z.enum(WHATSAPP_FILTER_OPTIONS).catch("any"),
  instagram: triState,
  email: triState,

  minScore: z.coerce.number().int().min(0).max(100).optional().catch(undefined),
  status: z.enum(LEAD_STATUS_ORDER as unknown as [LeadStatus, ...LeadStatus[]]).optional().catch(undefined),
  favorites: z.coerce.boolean().optional().catch(undefined),

  searchId: optionalText(40),
  listId: optionalText(40),
  /** Seleção explícita de leads (checkboxes da tabela). */
  ids: z.array(z.string().min(1).max(40)).max(500).optional().catch(undefined),
  sort: z.enum(LEAD_SORT_OPTIONS).catch("score"),
  /** Quantidade pedida na busca: teto do total exibido. */
  max: z.coerce.number().int().min(1).max(MAX_SEARCH_QUANTITY).optional().catch(undefined),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(APP_CONFIG.pagination.maxPageSize)
    .catch(APP_CONFIG.pagination.defaultPageSize),
});

export type LeadFilters = z.infer<typeof leadFiltersSchema>;

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Remove chaves vazias antes de validar - "" não deve virar 0 nem filtro ativo. */
export function parseLeadFilters(params: RawSearchParams): LeadFilters {
  const cleaned: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    // "ids" e o único filtro com vários valores (uma checkbox por lead).
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
    // A seleção e momentânea: nunca entra nos links de navegação.
    if (key === "ids") continue;
    if (key === "sort" && value === "score") continue;
    if (key === "limit" && value === APP_CONFIG.pagination.defaultPageSize) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Converte os filtros da tela no formato aceito pela busca. */
export function toSearchFilters(filters: LeadFilters): LeadSearchFilters {
  const presence = (value: TriState) => (value === "yes" ? true : value === "no" ? false : undefined);
  return {
    hasPhone: presence(filters.phone),
    hasWhatsapp: filters.whatsapp === "confirmed" ? true : filters.whatsapp === "none" ? false : undefined,
    hasInstagram: presence(filters.instagram),
    hasEmail: presence(filters.email),
    websiteStatus: filters.site === "any" ? undefined : filters.site,
    minScore: filters.minScore,
  };
}

const uf = z
  .string()
  .trim()
  .min(2, "Informe a UF (ex.: SP)")
  .max(40)
  .transform((value, context) => {
    const code = normalizeState(value);
    if (!code) {
      context.addIssue({ code: "custom", message: "UF inválida (ex.: SP)" });
      return z.NEVER;
    }
    return code;
  });

/** Campos comuns da busca, usados pelo formulário e pela API. */
const searchCoreSchema = {
  query: z
    .string()
    .trim()
    .min(2, "Informe o segmento (ex.: barbearia)")
    .max(120, "Segmento muito longo"),
  city: z.string().trim().min(2, "Informe a cidade").max(120, "Cidade muito longa"),
  state: uf,
  limit: z.coerce
    .number()
    .int("Quantidade deve ser um número inteiro")
    .min(1, "Quantidade mínima de 1")
    .max(MAX_SEARCH_QUANTITY, `Quantidade máxima de ${MAX_SEARCH_QUANTITY}`)
    .default(DEFAULT_SEARCH_QUANTITY),
};

/** Teto de cidades vizinhas: cada uma é uma consulta a mais nos serviços públicos. */
export const MAX_EXTRA_CITIES = 5;

const extraCityName = z.string().trim().min(2, "Cidade vizinha inválida").max(120);

/** Formulário "Buscar leads". Validado no Server Action antes de qualquer chamada externa. */
export const searchFormSchema = z.object({
  ...searchCoreSchema,
  /** "Barueri, Carapicuíba" - separadas por vírgula ou ponto e vírgula. */
  nearbyCities: z
    .string()
    .optional()
    .transform((value) => (value ?? "").split(/[,;]/).map((city) => city.trim()).filter(Boolean))
    .pipe(z.array(extraCityName).max(MAX_EXTRA_CITIES, `No máximo ${MAX_EXTRA_CITIES} cidades vizinhas`)),
});

export type SearchFormInput = z.infer<typeof searchFormSchema>;

/** POST /api/leads/search. Filtros ausentes = indiferente. */
export const leadSearchRequestSchema = z.strictObject({
  ...searchCoreSchema,
  extraCities: z.array(extraCityName).max(MAX_EXTRA_CITIES).default([]),
  hasPhone: z.boolean().optional(),
  hasWhatsapp: z.boolean().optional(),
  hasInstagram: z.boolean().optional(),
  hasEmail: z.boolean().optional(),
  websiteStatus: z.enum(WEBSITE_STATUSES).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
});

export type LeadSearchRequestInput = z.infer<typeof leadSearchRequestSchema>;

/** Converte FormData em objeto simples, descartando campos vazios. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && value.trim() !== "") result[key] = value.trim();
  }
  return result;
}

/** Criação de lista de prospecção. */
export const listFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome para a lista")
    .max(80, "Nome muito longo"),
  description: z.string().trim().max(240).optional(),
});

export type ListFormInput = z.infer<typeof listFormSchema>;
