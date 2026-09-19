/**
 * Peças reaproveitadas pelos schemas do sistema interno: dinheiro, data,
 * texto opcional e enums. Ficam juntas para que "valor" e "prazo" sejam
 * validados do mesmo jeito em todos os formulários.
 */

import { z } from "zod";
import { parseDateInput } from "@/lib/dates";
import { parseMoneyToCents } from "@/lib/money";

/** Texto opcional: vazio vira undefined em vez de string vazia no banco. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Texto muito longo (máximo ${max} caracteres)`)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max, `Texto muito longo (máximo ${max} caracteres)`);

/**
 * Valor em reais digitado pelo usuário -> centavos. Campo vazio vale zero:
 * um projeto sem valor informado é um projeto de R$ 0,00, não um erro.
 */
export const moneyCents = z
  .string()
  .optional()
  .transform((value, context) => {
    if (value === undefined || value.trim() === "") return 0;
    const cents = parseMoneyToCents(value);
    if (cents === null) {
      context.addIssue({ code: "custom", message: "Valor inválido (ex.: 1500,00)" });
      return z.NEVER;
    }
    if (cents < 0) {
      context.addIssue({ code: "custom", message: "O valor não pode ser negativo" });
      return z.NEVER;
    }
    return cents;
  });

/** Igual a moneyCents, mas exige um valor maior que zero. */
export const requiredMoneyCents = moneyCents.refine(
  (cents) => cents > 0,
  "Informe um valor maior que zero",
);

/** Campo <input type="date"> opcional. */
export const optionalDate = z
  .string()
  .optional()
  .transform((value, context) => {
    if (value === undefined || value.trim() === "") return null;
    const date = parseDateInput(value);
    if (!date) {
      context.addIssue({ code: "custom", message: "Data inválida" });
      return z.NEVER;
    }
    return date;
  });

export const requiredDate = optionalDate.refine(
  (date): date is Date => date !== null,
  "Informe a data",
);

/** <input type="datetime-local"> -> Date no fuso local. */
export const optionalDateTime = z
  .string()
  .optional()
  .transform((value, context) => {
    if (value === undefined || value.trim() === "") return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      context.addIssue({ code: "custom", message: "Data e hora inválidas" });
      return z.NEVER;
    }
    return date;
  });

/** Identificador de registro vindo de campo oculto ou de select. */
export const id = z.string().trim().min(1, "Registro inválido").max(40);
export const optionalId = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((value) => (value === "" ? undefined : value));

/** Progresso do projeto: número inteiro de 0 a 100. */
export const percent = z.coerce
  .number()
  .int("Use um número inteiro")
  .min(0, "Mínimo 0%")
  .max(100, "Máximo 100%");

/** "Next.js, Prisma, Tailwind" -> ["Next.js", "Prisma", "Tailwind"]. */
export const commaList = (max: number) =>
  z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, max),
    );

/** URL opcional. Aceita "empresa.com.br" e completa o https. */
export const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value, context) => {
    if (!value) return undefined;
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      return new URL(candidate).toString();
    } catch {
      context.addIssue({ code: "custom", message: "Endereço inválido" });
      return z.NEVER;
    }
  });

/** E-mail opcional - muitos clientes só têm WhatsApp. */
export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .optional()
  .transform((value, context) => {
    if (!value) return undefined;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      context.addIssue({ code: "custom", message: "E-mail inválido" });
      return z.NEVER;
    }
    return value;
  });

/** Telefone/WhatsApp guardado só com dígitos, para busca e link de wa.me. */
export const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .optional()
  .transform((value, context) => {
    if (!value) return undefined;
    const digits = value.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      context.addIssue({ code: "custom", message: "Telefone inválido" });
      return z.NEVER;
    }
    return digits;
  });

/** CPF ou CNPJ: guarda só os dígitos, sem validar dígito verificador. */
export const optionalDocument = z
  .string()
  .trim()
  .max(25)
  .optional()
  .transform((value, context) => {
    if (!value) return undefined;
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      context.addIssue({ code: "custom", message: "Informe um CPF (11) ou CNPJ (14 dígitos)" });
      return z.NEVER;
    }
    return digits;
  });
