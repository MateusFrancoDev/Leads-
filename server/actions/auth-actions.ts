"use server";

/** Entrar e sair do sistema. Não existe cadastro: usuários vêm do terminal. */

import { redirect } from "next/navigation";
import { createLogger } from "@/lib/logger";
import { loginSchema } from "@/lib/schemas/auth";
import {
  failure,
  formValues,
  invalidInput,
  type ActionState,
} from "@/server/actions/action-state";
import { verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { findUserForLogin, markLoggedIn } from "@/server/repositories/user-repository";

const logger = createLogger("auth");

/**
 * Confere e-mail e senha. A mensagem de erro é sempre a mesma, tenha o e-mail
 * sido encontrado ou não: dizer "usuário não existe" entrega quais endereços
 * têm conta. E a senha é conferida mesmo sem usuário (com um hash inválido),
 * para que o tempo de resposta não denuncie a diferença.
 */
export async function loginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  const { email, password, next } = parsed.data;
  const wrongCredentials: ActionState = {
    status: "error",
    message: "E-mail ou senha incorretos.",
  };

  try {
    const user = await findUserForLogin(email);
    const passwordMatches = await verifyPassword(password, user?.passwordHash ?? "scrypt$0$0$0$x$x");

    if (!user || !passwordMatches) return wrongCredentials;
    if (!user.isActive) {
      return { status: "error", message: "Este acesso está desativado." };
    }

    await createSession(user.id);
    await markLoggedIn(user.id);
  } catch (error) {
    logger.error("falha no login");
    return failure(error);
  }

  // redirect() lança por dentro: precisa ficar fora do try/catch.
  redirect(next ?? "/dashboard");
}

/** Encerra a sessão de verdade: apaga a linha no banco, não só o cookie. */
export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
