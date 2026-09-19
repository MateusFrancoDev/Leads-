"use client";

/**
 * `useActionState` com um gancho de sucesso.
 *
 * Existe porque "fechar o diálogo depois de salvar" e "limpar o campo depois de
 * enviar" não são sincronização com um sistema externo - são a continuação da
 * ação. Fazer isso num `useEffect` que observa o estado provoca uma renderização
 * extra e é justamente o que o React desaconselha; aqui o retorno é tratado
 * dentro da própria ação, ainda na transição.
 */

import { useActionState, useCallback } from "react";
import { initialActionState, type ActionState } from "@/server/actions/action-state";

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function useFormAction(
  action: FormAction,
  options: {
    /** Chamado só quando o servidor respondeu com sucesso. */
    onSuccess?: (state: ActionState) => void;
  } = {},
): [ActionState, (formData: FormData) => void, boolean] {
  const { onSuccess } = options;

  const wrapped = useCallback<FormAction>(
    async (previous, formData) => {
      const result = await action(previous, formData);
      if (result.status === "success") onSuccess?.(result);
      return result;
    },
    [action, onSuccess],
  );

  return useActionState(wrapped, initialActionState);
}
