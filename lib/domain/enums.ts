/**
 * Espelho dos enums do schema Prisma, com o rótulo em português e o tom visual
 * de cada valor. Existe para que Client Components não precisem importar o
 * Prisma Client - é a mesma convenção já usada por types/lead.ts.
 *
 * Trocar um valor aqui exige trocar no prisma/schema.prisma (e vice-versa).
 */

import type { Tone } from "@/components/ui/badge";

/** Descrição de um valor de enum pronta para a interface. */
export interface EnumOption<T extends string> {
  value: T;
  label: string;
  tone: Tone;
}

/** Monta o par value/label que os selects esperam. */
export function toSelectOptions<T extends string>(
  options: ReadonlyArray<EnumOption<T>>,
): Array<{ value: string; label: string }> {
  return options.map(({ value, label }) => ({ value, label }));
}

function indexBy<T extends string>(
  options: ReadonlyArray<EnumOption<T>>,
): Record<T, EnumOption<T>> {
  return Object.fromEntries(options.map((option) => [option.value, option])) as Record<
    T,
    EnumOption<T>
  >;
}

// ---------------------------------------------------------------- usuários

export const USER_ROLES = ["ADMIN", "PARTNER", "EMPLOYEE"] as const;
export type UserRoleValue = (typeof USER_ROLES)[number];

export const USER_ROLE_OPTIONS: ReadonlyArray<EnumOption<UserRoleValue>> = [
  { value: "ADMIN", label: "Administrador", tone: "accent" },
  { value: "PARTNER", label: "Sócio", tone: "neutral" },
  { value: "EMPLOYEE", label: "Funcionário", tone: "neutral" },
];

export const USER_ROLE = indexBy(USER_ROLE_OPTIONS);

// ---------------------------------------------------------------- clientes

export const CLIENT_STATUSES = ["LEAD", "NEGOTIATING", "ACTIVE", "COMPLETED", "INACTIVE"] as const;
export type ClientStatusValue = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_OPTIONS: ReadonlyArray<EnumOption<ClientStatusValue>> = [
  { value: "LEAD", label: "Lead", tone: "neutral" },
  { value: "NEGOTIATING", label: "Em negociação", tone: "warning" },
  { value: "ACTIVE", label: "Cliente ativo", tone: "positive" },
  { value: "COMPLETED", label: "Projeto concluído", tone: "accent" },
  { value: "INACTIVE", label: "Inativo", tone: "neutral" },
];

export const CLIENT_STATUS = indexBy(CLIENT_STATUS_OPTIONS);

/** Cliente que conta como ativo nos indicadores do painel. */
export const ACTIVE_CLIENT_STATUSES: ReadonlyArray<ClientStatusValue> = ["ACTIVE"];

// ---------------------------------------------------------------- projetos

export const PROJECT_TYPES = [
  "LANDING_PAGE",
  "INSTITUTIONAL_SITE",
  "ECOMMERCE",
  "SAAS",
  "APP",
  "MAINTENANCE",
  "CONSULTING",
  "AUTOMATION",
  "OTHER",
] as const;
export type ProjectTypeValue = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_OPTIONS: ReadonlyArray<EnumOption<ProjectTypeValue>> = [
  { value: "LANDING_PAGE", label: "Landing page", tone: "neutral" },
  { value: "INSTITUTIONAL_SITE", label: "Site institucional", tone: "neutral" },
  { value: "ECOMMERCE", label: "E-commerce", tone: "neutral" },
  { value: "SAAS", label: "SaaS", tone: "neutral" },
  { value: "APP", label: "Aplicativo", tone: "neutral" },
  { value: "MAINTENANCE", label: "Manutenção", tone: "neutral" },
  { value: "CONSULTING", label: "Consultoria", tone: "neutral" },
  { value: "AUTOMATION", label: "Automação", tone: "neutral" },
  { value: "OTHER", label: "Outro", tone: "neutral" },
];

export const PROJECT_TYPE = indexBy(PROJECT_TYPE_OPTIONS);

export const PROJECT_STATUSES = [
  "QUOTE",
  "AWAITING_APPROVAL",
  "AWAITING_PAYMENT",
  "PLANNING",
  "DEVELOPMENT",
  "REVIEW",
  "AWAITING_CLIENT",
  "COMPLETED",
  "CANCELLED",
] as const;
export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_OPTIONS: ReadonlyArray<EnumOption<ProjectStatusValue>> = [
  { value: "QUOTE", label: "Orçamento", tone: "neutral" },
  { value: "AWAITING_APPROVAL", label: "Aguardando aprovação", tone: "warning" },
  { value: "AWAITING_PAYMENT", label: "Aguardando pagamento", tone: "warning" },
  { value: "PLANNING", label: "Em planejamento", tone: "accent" },
  { value: "DEVELOPMENT", label: "Em desenvolvimento", tone: "accent" },
  { value: "REVIEW", label: "Em revisão", tone: "accent" },
  { value: "AWAITING_CLIENT", label: "Aguardando cliente", tone: "warning" },
  { value: "COMPLETED", label: "Concluído", tone: "positive" },
  { value: "CANCELLED", label: "Cancelado", tone: "negative" },
];

export const PROJECT_STATUS = indexBy(PROJECT_STATUS_OPTIONS);

/**
 * Projeto que ainda dá trabalho: não está concluído nem cancelado.
 * Usado nos indicadores de projetos ativos e nos avisos de prazo.
 */
export const ACTIVE_PROJECT_STATUSES: ReadonlyArray<ProjectStatusValue> = [
  "QUOTE",
  "AWAITING_APPROVAL",
  "AWAITING_PAYMENT",
  "PLANNING",
  "DEVELOPMENT",
  "REVIEW",
  "AWAITING_CLIENT",
];

/** Colunas do Kanban de projetos: as etapas de trabalho, sem o cancelado. */
export const PROJECT_BOARD_COLUMNS: ReadonlyArray<ProjectStatusValue> = [
  "QUOTE",
  "PLANNING",
  "DEVELOPMENT",
  "REVIEW",
  "AWAITING_CLIENT",
  "COMPLETED",
];

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type PriorityValue = (typeof PRIORITIES)[number];

export const PRIORITY_OPTIONS: ReadonlyArray<EnumOption<PriorityValue>> = [
  { value: "LOW", label: "Baixa", tone: "neutral" },
  { value: "NORMAL", label: "Normal", tone: "neutral" },
  { value: "HIGH", label: "Alta", tone: "warning" },
  { value: "URGENT", label: "Urgente", tone: "negative" },
];

export const PRIORITY = indexBy(PRIORITY_OPTIONS);

export const CONTRACT_STATUSES = ["NOT_SENT", "SENT", "SIGNED"] as const;
export type ContractStatusValue = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_OPTIONS: ReadonlyArray<EnumOption<ContractStatusValue>> = [
  { value: "NOT_SENT", label: "Não enviado", tone: "neutral" },
  { value: "SENT", label: "Enviado", tone: "warning" },
  { value: "SIGNED", label: "Assinado", tone: "positive" },
];

export const CONTRACT_STATUS = indexBy(CONTRACT_STATUS_OPTIONS);

// ---------------------------------------------------------------- tarefas

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export type TaskStatusValue = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_OPTIONS: ReadonlyArray<EnumOption<TaskStatusValue>> = [
  { value: "TODO", label: "A fazer", tone: "neutral" },
  { value: "IN_PROGRESS", label: "Em andamento", tone: "accent" },
  { value: "REVIEW", label: "Em revisão", tone: "warning" },
  { value: "DONE", label: "Concluído", tone: "positive" },
];

export const TASK_STATUS = indexBy(TASK_STATUS_OPTIONS);

// ---------------------------------------------------------------- financeiro

export const PAYMENT_STATUSES = ["PENDING", "PAID", "CANCELLED"] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_OPTIONS: ReadonlyArray<EnumOption<PaymentStatusValue>> = [
  { value: "PENDING", label: "A receber", tone: "warning" },
  { value: "PAID", label: "Recebido", tone: "positive" },
  { value: "CANCELLED", label: "Cancelado", tone: "neutral" },
];

export const PAYMENT_STATUS = indexBy(PAYMENT_STATUS_OPTIONS);

export const PAYMENT_METHODS = [
  "PIX",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "BOLETO",
  "CASH",
  "OTHER",
] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_OPTIONS: ReadonlyArray<EnumOption<PaymentMethodValue>> = [
  { value: "PIX", label: "Pix", tone: "neutral" },
  { value: "BANK_TRANSFER", label: "Transferência", tone: "neutral" },
  { value: "CREDIT_CARD", label: "Cartão de crédito", tone: "neutral" },
  { value: "DEBIT_CARD", label: "Cartão de débito", tone: "neutral" },
  { value: "BOLETO", label: "Boleto", tone: "neutral" },
  { value: "CASH", label: "Dinheiro", tone: "neutral" },
  { value: "OTHER", label: "Outro", tone: "neutral" },
];

export const PAYMENT_METHOD = indexBy(PAYMENT_METHOD_OPTIONS);

export const EXPENSE_CATEGORIES = [
  "DOMAIN",
  "HOSTING",
  "API",
  "DATABASE",
  "DESIGNER",
  "FREELANCER",
  "LICENSE",
  "SOFTWARE",
  "TOOL",
  "OTHER",
] as const;
export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_OPTIONS: ReadonlyArray<EnumOption<ExpenseCategoryValue>> = [
  { value: "DOMAIN", label: "Domínio", tone: "neutral" },
  { value: "HOSTING", label: "Hospedagem", tone: "neutral" },
  { value: "API", label: "API", tone: "neutral" },
  { value: "DATABASE", label: "Banco de dados", tone: "neutral" },
  { value: "DESIGNER", label: "Designer", tone: "neutral" },
  { value: "FREELANCER", label: "Freelancer", tone: "neutral" },
  { value: "LICENSE", label: "Licença", tone: "neutral" },
  { value: "SOFTWARE", label: "Software", tone: "neutral" },
  { value: "TOOL", label: "Ferramenta", tone: "neutral" },
  { value: "OTHER", label: "Outro", tone: "neutral" },
];

export const EXPENSE_CATEGORY = indexBy(EXPENSE_CATEGORY_OPTIONS);

// ---------------------------------------------------------------- arquivos

export const FILE_CATEGORIES = [
  "BRIEFING",
  "CONTRACT",
  "DESIGN",
  "LOGO",
  "CONTENT",
  "DEVELOPMENT",
  "FINANCE",
  "DELIVERY",
  "OTHER",
] as const;
export type FileCategoryValue = (typeof FILE_CATEGORIES)[number];

export const FILE_CATEGORY_OPTIONS: ReadonlyArray<EnumOption<FileCategoryValue>> = [
  { value: "BRIEFING", label: "Briefing", tone: "neutral" },
  { value: "CONTRACT", label: "Contrato", tone: "neutral" },
  { value: "DESIGN", label: "Design", tone: "neutral" },
  { value: "LOGO", label: "Logo", tone: "neutral" },
  { value: "CONTENT", label: "Conteúdo", tone: "neutral" },
  { value: "DEVELOPMENT", label: "Desenvolvimento", tone: "neutral" },
  { value: "FINANCE", label: "Financeiro", tone: "neutral" },
  { value: "DELIVERY", label: "Entrega", tone: "neutral" },
  { value: "OTHER", label: "Outro", tone: "neutral" },
];

export const FILE_CATEGORY = indexBy(FILE_CATEGORY_OPTIONS);

// ---------------------------------------------------------------- calendário

export const EVENT_TYPES = ["MEETING", "DELIVERY", "REMINDER", "OTHER"] as const;
export type EventTypeValue = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_OPTIONS: ReadonlyArray<EnumOption<EventTypeValue>> = [
  { value: "MEETING", label: "Reunião", tone: "accent" },
  { value: "DELIVERY", label: "Entrega", tone: "positive" },
  { value: "REMINDER", label: "Lembrete", tone: "warning" },
  { value: "OTHER", label: "Outro", tone: "neutral" },
];

export const EVENT_TYPE = indexBy(EVENT_TYPE_OPTIONS);

// ---------------------------------------------------------------- histórico

export const ACTIVITY_ENTITIES = [
  "CLIENT",
  "PROJECT",
  "TASK",
  "PAYMENT",
  "EXPENSE",
  "NOTE",
  "FILE",
  "EVENT",
  "USER",
] as const;
export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number];

export const ACTIVITY_ENTITY_LABEL: Record<ActivityEntity, string> = {
  CLIENT: "Cliente",
  PROJECT: "Projeto",
  TASK: "Tarefa",
  PAYMENT: "Pagamento",
  EXPENSE: "Custo",
  NOTE: "Anotação",
  FILE: "Arquivo",
  EVENT: "Compromisso",
  USER: "Usuário",
};

export const ACTIVITY_ACTIONS = [
  "CREATED",
  "UPDATED",
  "DELETED",
  "STATUS_CHANGED",
  "PROGRESS_CHANGED",
  "DEADLINE_CHANGED",
  "PAYMENT_REGISTERED",
  "PAYMENT_RECEIVED",
  "EXPENSE_REGISTERED",
  "FILE_ADDED",
  "FILE_REMOVED",
  "NOTE_ADDED",
  "TASK_COMPLETED",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];
