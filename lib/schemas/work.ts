/**
 * Validação de tarefas, anotações, arquivos e compromissos do calendário.
 */

import { z } from "zod";
import {
  EVENT_TYPES,
  EXPENSE_CATEGORIES,
  FILE_CATEGORIES,
  PAYMENT_METHODS,
  PRIORITIES,
  TASK_STATUSES,
} from "@/lib/domain/enums";
import {
  id,
  optionalDate,
  optionalDateTime,
  optionalId,
  optionalText,
  requiredMoneyCents,
  requiredText,
} from "@/lib/schemas/fields";

// ---------------------------------------------------------------- tarefas

export const taskSchema = z.object({
  projectId: id,
  title: requiredText(200, "Informe o título da tarefa"),
  description: optionalText(4000),
  assignedUserId: optionalId,
  priority: z.enum(PRIORITIES).default("NORMAL"),
  status: z.enum(TASK_STATUSES).default("TODO"),
  deadline: optionalDate,
});

export type TaskInput = z.infer<typeof taskSchema>;

/** Arrastar no Kanban: só o destino muda. */
export const taskStatusSchema = z.object({
  taskId: id,
  status: z.enum(TASK_STATUSES),
  /** Posição dentro da coluna de destino, quando a tela informa. */
  position: z.coerce.number().int().min(0).max(10_000).optional(),
});

export const taskFiltersSchema = z.object({
  q: optionalText(120),
  status: z.enum(TASK_STATUSES).optional().catch(undefined),
  priority: z.enum(PRIORITIES).optional().catch(undefined),
  projectId: optionalId.catch(undefined),
  assignedUserId: optionalId.catch(undefined),
  /** "minhas" filtra pelo usuário logado sem precisar saber o id dele. */
  scope: z.enum(["todas", "minhas"]).catch("todas"),
  view: z.enum(["kanban", "lista"]).catch("kanban"),
});

export type TaskFilters = z.infer<typeof taskFiltersSchema>;

// ---------------------------------------------------------------- anotações

/** A anotação pertence a um projeto, a um cliente, ou aos dois. */
export const noteSchema = z
  .object({
    projectId: optionalId,
    clientId: optionalId,
    content: requiredText(4000, "Escreva a anotação"),
  })
  .refine((data) => data.projectId || data.clientId, {
    message: "A anotação precisa estar ligada a um cliente ou projeto",
    path: ["content"],
  });

export type NoteInput = z.infer<typeof noteSchema>;

// ---------------------------------------------------------------- arquivos

export const fileMetaSchema = z
  .object({
    projectId: optionalId,
    clientId: optionalId,
    category: z.enum(FILE_CATEGORIES).default("OTHER"),
  })
  .refine((data) => data.projectId || data.clientId, {
    message: "Escolha o projeto ou o cliente do arquivo",
    path: ["category"],
  });

export const fileFiltersSchema = z.object({
  q: optionalText(120),
  category: z.enum(FILE_CATEGORIES).optional().catch(undefined),
  projectId: optionalId.catch(undefined),
  clientId: optionalId.catch(undefined),
});

export type FileFilters = z.infer<typeof fileFiltersSchema>;

// ---------------------------------------------------------------- calendário

export const calendarEventSchema = z.object({
  title: requiredText(200, "Informe o título do compromisso"),
  description: optionalText(2000),
  type: z.enum(EVENT_TYPES).default("MEETING"),
  startsAt: optionalDateTime.refine((date): date is Date => date !== null, "Informe a data e a hora"),
  allDay: z.coerce.boolean().default(false),
  projectId: optionalId,
  clientId: optionalId,
});

export type CalendarEventInput = z.infer<typeof calendarEventSchema>;

// ------------------------------------------------- pagamentos e despesas

export const paymentSchema = z.object({
  projectId: id,
  description: optionalText(200),
  amountCents: requiredMoneyCents,
  method: z.enum(PAYMENT_METHODS).default("PIX"),
  dueDate: optionalDate,
  /** Preenchida = parcela já recebida. */
  paidAt: optionalDate,
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export const expenseSchema = z.object({
  projectId: id,
  description: requiredText(200, "Descreva o custo"),
  category: z.enum(EXPENSE_CATEGORIES).default("OTHER"),
  amountCents: requiredMoneyCents,
  date: optionalDate,
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export const financeFiltersSchema = z.object({
  /** "2026-09" ou vazio para todo o período. */
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
  clientId: optionalId.catch(undefined),
  projectId: optionalId.catch(undefined),
  /** PENDING | PAID | CANCELLED | OVERDUE (este último é derivado). */
  status: z.enum(["PENDING", "PAID", "CANCELLED", "OVERDUE"]).optional().catch(undefined),
  method: z.enum(PAYMENT_METHODS).optional().catch(undefined),
  tab: z.enum(["recebimentos", "custos"]).catch("recebimentos"),
});

export type FinanceFilters = z.infer<typeof financeFiltersSchema>;
