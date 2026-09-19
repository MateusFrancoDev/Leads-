"use client";

/**
 * Botão que só executa a ação depois de confirmar em um diálogo.
 *
 * Usado em toda exclusão (cliente, projeto, pagamento, arquivo, tarefa). A
 * confirmação diz exatamente o que será apagado e o que vai junto - "Excluir
 * projeto" sem avisar que as parcelas somem seria uma armadilha.
 */

import { useActionState, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { initialActionState, type ActionState } from "@/server/actions/action-state";

export function ConfirmAction({
  action,
  hiddenFields,
  title,
  description,
  confirmLabel = "Excluir",
  triggerLabel,
  triggerIcon,
  variant = "ghost",
  size = "sm",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Campos enviados junto (ids do registro). */
  hiddenFields: Record<string, string>;
  title: string;
  description: string;
  confirmLabel?: string;
  triggerLabel: string;
  triggerIcon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setIsOpen(true)}>
        {triggerIcon ?? <Trash2 className="size-3.5" aria-hidden />}
        {triggerLabel}
      </Button>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        description={description}
        size="sm"
      >
        <form action={formAction} className="flex flex-col gap-4">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          {state.status === "error" && state.message ? (
            <p role="alert" className="text-sm text-negative">
              {state.message}
            </p>
          ) : (
            <p className="text-sm text-ink-muted">Esta ação não pode ser desfeita.</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setIsOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Excluindo..." : confirmLabel}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
