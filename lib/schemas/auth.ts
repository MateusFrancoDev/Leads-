/**
 * Validação da entrada de autenticação. O formulário e o Server Action usam o
 * mesmo schema - a interface nunca é a única barreira.
 */

import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 8;

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido").trim().toLowerCase(),
  // Sem regra de complexidade no login: a senha já existe, só precisa conferir.
  password: z.string().min(1, "Informe a senha"),
  /** Para onde voltar depois de entrar. Só caminho interno, nunca URL externa. */
  next: z
    .string()
    .optional()
    .transform((value) => (value && value.startsWith("/") && !value.startsWith("//") ? value : undefined)),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Regras da senha na hora de criar ou trocar - aí sim exigimos qualidade. */
export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres`)
  .max(200, "Senha muito longa")
  .refine((value) => /[a-zA-Z]/.test(value), "A senha precisa ter pelo menos uma letra")
  .refine((value) => /\d/.test(value), "A senha precisa ter pelo menos um número");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "Repita a nova senha"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120, "Nome muito longo"),
  email: z.email("Informe um e-mail válido").trim().toLowerCase(),
});
