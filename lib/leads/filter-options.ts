/**
 * Opções dos filtros de lead. Arquivo sem dependências, seguro para Client
 * Components (o schema Zod que valida estes valores fica em lib/validation).
 */

import { WEBSITE_STATUSES } from "@/lib/leads/types";

/** Filtro de site: os três status públicos, sem afirmar ausência onde ela não foi comprovada. */
export const SITE_FILTER_OPTIONS = ["any", ...WEBSITE_STATUSES] as const;
export type SiteFilter = (typeof SITE_FILTER_OPTIONS)[number];

export const SITE_FILTER_LABELS: Record<SiteFilter, string> = {
  any: "Indiferente",
  found: "Site encontrado",
  not_checked: "Site não informado / não verificado",
  not_found: "Sem site (confirmado)",
};

/** WhatsApp: confirmado é diferente de "tem celular". */
export const WHATSAPP_FILTER_OPTIONS = ["any", "confirmed", "confirmed_or_possible", "none"] as const;
export type WhatsappFilter = (typeof WHATSAPP_FILTER_OPTIONS)[number];

export const WHATSAPP_FILTER_LABELS: Record<WhatsappFilter, string> = {
  any: "Indiferente",
  confirmed: "Confirmado",
  confirmed_or_possible: "Confirmado ou possível",
  none: "Não encontrado",
};

/** Teto de "Quantidade" numa busca. O pedido à fonte pode ser maior (folga para duplicados). */
export const MAX_SEARCH_QUANTITY = 200;
export const DEFAULT_SEARCH_QUANTITY = 50;

export function toSelectOptions<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): Array<{ value: T; label: string }> {
  return values.map((value) => ({ value, label: labels[value] }));
}
