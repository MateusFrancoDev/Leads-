/**
 * Formato único de resposta dos Server Actions deste sistema, para que todo
 * formulário trate sucesso, erro geral e erro por campo do mesmo jeito.
 * É a mesma forma que os actions de leads já usavam, agora compartilhada.
 */

import type { ZodError } from "zod";
import { userMessage } from "@/lib/errors";

export interface ActionState {
  status: "idle" | "error" | "success";
  message?: string;
  /** Mensagem por campo, na chave igual ao `name` do input. */
  fieldErrors?: Record<string, string>;
  /** Id do registro criado, quando a tela precisa navegar até ele. */
  createdId?: string;
}

export const initialActionState: ActionState = { status: "idle" };

/** Primeira mensagem de cada campo - mostrar todas de uma vez só polui a tela. */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}

export function invalidInput(error: ZodError): ActionState {
  return {
    status: "error",
    message: "Revise os campos destacados.",
    fieldErrors: fieldErrorsFrom(error),
  };
}

export function failure(error: unknown): ActionState {
  return { status: "error", message: userMessage(error) };
}

export function success(message: string, createdId?: string): ActionState {
  return { status: "success", message, createdId };
}

/**
 * FormData -> objeto simples. Campos vazios viram undefined para que os
 * `.optional()` do Zod funcionem e "" não seja gravado como texto vazio.
 */
export function formValues(formData: FormData): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    values[key] = trimmed === "" ? undefined : trimmed;
  }
  return values;
}

/** Vários valores com o mesmo `name` (checkboxes, tecnologias...). */
export function formList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}
