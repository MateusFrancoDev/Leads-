/**
 * Estados de resposta dos Server Actions do módulo de leads.
 *
 * Ficam neste arquivo, e não junto dos actions, porque um módulo de Server Actions
 * só pode exportar funções assíncronas: tudo que ele exporta vira uma referência
 * de ação chamável pelo cliente, e um objeto não pode ser isso. Exportar de lá a
 * constante de estado inicial derruba a página em tempo de execução com
 * "can only export async functions, found object".
 *
 * É a mesma ideia de server/actions/action-state.ts, que serve o sistema
 * interno. Os formatos abaixo são os do módulo de leads, preservados como
 * estavam para não mexer no comportamento daquelas telas.
 */

/** Ações sobre um lead (status, favorito, anotações, enriquecimento). */
export interface LeadActionState {
  status: "idle" | "error" | "success";
  message?: string;
}

export const initialLeadActionState: LeadActionState = { status: "idle" };

/** Ações sobre listas de prospecção. */
export interface ListActionState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const initialListActionState: ListActionState = { status: "idle" };

/** Formulário de busca de leads. Não tem estado de sucesso: ele redireciona. */
export interface SearchActionState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const initialSearchActionState: SearchActionState = { status: "idle" };
