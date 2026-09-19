"use server";

/** Perfil do usuário, troca de senha e dados da empresa. */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { changePasswordSchema, profileSchema } from "@/lib/schemas/auth";
import { requiredText } from "@/lib/schemas/fields";
import {
  failure,
  formValues,
  invalidInput,
  success,
  type ActionState,
} from "@/server/actions/action-state";
import { canManageUsers, requireUser } from "@/server/auth/dal";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroyAllSessions } from "@/server/auth/session";
import {
  emailIsTaken,
  readPasswordHash,
  updateProfile,
  updatePasswordHash,
} from "@/server/repositories/user-repository";
import { updateSettings } from "@/server/repositories/settings-repository";
import { logActivity } from "@/server/services/activity-log";

const logger = createLogger("settings-action");

export async function updateProfileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    if (await emailIsTaken(parsed.data.email, user.id)) {
      return {
        status: "error",
        message: "Revise os campos destacados.",
        fieldErrors: { email: "Já existe um usuário com este e-mail." },
      };
    }

    await updateProfile(user.id, parsed.data);

    revalidatePath("/perfil");
    revalidatePath("/configuracoes");
    return success("Perfil atualizado.");
  } catch (error) {
    logger.error("falha ao atualizar perfil");
    return failure(error);
  }
}

/**
 * Troca de senha. Ao trocar, todas as sessões caem - inclusive as de outro
 * navegador, que é o ponto de trocar a senha - e uma nova é aberta aqui, para
 * que quem acabou de trocar não seja expulso da própria tela.
 */
export async function changePasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const currentHash = await readPasswordHash(user.id);
    if (!currentHash || !(await verifyPassword(parsed.data.currentPassword, currentHash))) {
      return {
        status: "error",
        message: "Revise os campos destacados.",
        fieldErrors: { currentPassword: "Senha atual incorreta." },
      };
    }

    await updatePasswordHash(user.id, await hashPassword(parsed.data.newPassword));
    await destroyAllSessions(user.id);
    await createSession(user.id);

    await logActivity({
      userId: user.id,
      entityType: "USER",
      entityId: user.id,
      action: "UPDATED",
      description: `${user.name} alterou a própria senha.`,
    });

    return success("Senha alterada. As outras sessões foram encerradas.");
  } catch (error) {
    logger.error("falha ao trocar senha");
    return failure(error);
  }
}

export async function updateCompanyAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    return { status: "error", message: "Só o administrador altera os dados da empresa." };
  }

  const parsed = z
    .object({ companyName: requiredText(80, "Informe o nome da empresa") })
    .safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    await updateSettings({ companyName: parsed.data.companyName });

    // O nome aparece na sidebar e no login: revalida a raiz inteira.
    revalidatePath("/", "layout");
    return success("Dados da empresa atualizados.");
  } catch (error) {
    logger.error("falha ao atualizar empresa");
    return failure(error);
  }
}
