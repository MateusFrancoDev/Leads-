"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteListAction, initialListActionState } from "@/server/actions/list-actions";

/** Exclui a lista. Os leads continuam na base - so o agrupamento some. */
export function DeleteListButton({ listId, listName }: { listId: string; listName: string }) {
  const [state, formAction, pending] = useActionState(deleteListAction, initialListActionState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Excluir a lista "${listName}"? Os leads nao serao apagados.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="listId" value={listId} />
      <Button type="submit" size="sm" disabled={pending}>
        <Trash2 className="size-3.5" aria-hidden />
        {pending ? "Excluindo..." : "Excluir lista"}
      </Button>
      {state.status === "error" && state.message ? (
        <p role="status" className="mt-1 text-xs text-negative">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
