import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ActionState } from "@/server/actions/action-state";

/**
 * Resposta do formulário depois de enviar. Um componente só para que
 * "Cliente cadastrado com sucesso." e "Revise os campos destacados." apareçam
 * sempre no mesmo lugar e com o mesmo peso.
 *
 * `role="status"` faz o leitor de tela anunciar sem roubar o foco de quem
 * ainda está digitando.
 */
export function FormFeedback({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === "idle" || !state.message) return null;

  const isError = state.status === "error";

  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-center gap-1.5 text-xs",
        isError ? "text-negative" : "text-positive",
        className,
      )}
    >
      {isError ? (
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
      )}
      {state.message}
    </p>
  );
}
