/**
 * Validação de clientes, projetos e briefing. Os mesmos schemas servem o
 * formulário (mensagens de campo) e o Server Action (barreira de verdade).
 */

import { z } from "zod";
import {
  CLIENT_STATUSES,
  CONTRACT_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
} from "@/lib/domain/enums";
import {
  commaList,
  id,
  moneyCents,
  optionalDate,
  optionalDocument,
  optionalEmail,
  optionalId,
  optionalPhone,
  optionalText,
  optionalUrl,
  percent,
  requiredText,
} from "@/lib/schemas/fields";

// ---------------------------------------------------------------- clientes

export const clientSchema = z.object({
  name: requiredText(120, "Informe o nome do cliente"),
  company: optionalText(160),
  email: optionalEmail,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  instagram: optionalText(80),
  website: optionalUrl,
  document: optionalDocument,
  city: optionalText(120),
  state: optionalText(40),
  status: z.enum(CLIENT_STATUSES).default("LEAD"),
  notes: optionalText(4000),
});

export type ClientInput = z.infer<typeof clientSchema>;

/** Filtros da listagem de clientes, lidos da query string. */
export const clientFiltersSchema = z.object({
  q: optionalText(120),
  status: z.enum(CLIENT_STATUSES).optional().catch(undefined),
  sort: z.enum(["recent", "name", "revenue"]).catch("recent"),
});

export type ClientFilters = z.infer<typeof clientFiltersSchema>;

// ---------------------------------------------------------------- projetos

export const projectSchema = z.object({
  clientId: id,
  name: requiredText(160, "Informe o nome do projeto"),
  type: z.enum(PROJECT_TYPES).default("OTHER"),
  description: optionalText(4000),
  valueCents: moneyCents,
  estimatedCostCents: moneyCents,
  startDate: optionalDate,
  deadline: optionalDate,
  status: z.enum(PROJECT_STATUSES).default("QUOTE"),
  priority: z.enum(PRIORITIES).default("NORMAL"),
  progress: percent.default(0),
  technologies: commaList(25),
  projectUrl: optionalUrl,
  repositoryUrl: optionalUrl,
  notes: optionalText(4000),
  contractStatus: z.enum(CONTRACT_STATUSES).default("NOT_SENT"),
});

export type ProjectInput = z.infer<typeof projectSchema>;

/**
 * O prazo não pode ser anterior ao início. Checagem separada do schema base
 * porque a edição parcial (arrastar no Kanban) não manda as duas datas.
 */
export const projectFormSchema = projectSchema.refine(
  (data) => !data.startDate || !data.deadline || data.deadline >= data.startDate,
  { message: "O prazo não pode ser anterior ao início", path: ["deadline"] },
);

/** Mudança de status vinda do Kanban: um campo só. */
export const projectStatusSchema = z.object({
  projectId: id,
  status: z.enum(PROJECT_STATUSES),
});

export const projectProgressSchema = z.object({
  projectId: id,
  progress: percent,
});

export const projectFiltersSchema = z.object({
  q: optionalText(120),
  status: z.enum(PROJECT_STATUSES).optional().catch(undefined),
  type: z.enum(PROJECT_TYPES).optional().catch(undefined),
  priority: z.enum(PRIORITIES).optional().catch(undefined),
  clientId: optionalId.catch(undefined),
  /** "cards" | "tabela" | "kanban" - a mesma lista, três formas de olhar. */
  view: z.enum(["cards", "tabela", "kanban"]).catch("cards"),
  sort: z.enum(["deadline", "recent", "value", "name"]).catch("deadline"),
  /** Só projetos vencendo nos próximos N dias. */
  dueInDays: z.coerce.number().int().min(1).max(365).optional().catch(undefined),
  overdue: z.coerce.boolean().optional().catch(undefined),
});

export type ProjectFilters = z.infer<typeof projectFiltersSchema>;

// ---------------------------------------------------------------- briefing

export const briefingSchema = z.object({
  projectId: id,
  objective: optionalText(4000),
  audience: optionalText(2000),
  references: optionalText(2000),
  colors: optionalText(500),
  style: optionalText(1000),
  features: optionalText(4000),
  competitors: optionalText(2000),
  notes: optionalText(4000),
});

export type BriefingInput = z.infer<typeof briefingSchema>;
