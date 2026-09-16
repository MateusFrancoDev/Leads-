"use client";

/** Adiciona ou remove o lead das listas de prospecção. */

import { useActionState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import {
  addLeadToListAction,
  initialListActionState,
  removeLeadFromListAction,
} from "@/server/actions/list-actions";

export interface LeadListOption {
  id: string;
  name: string;
}

export function LeadListsPanel({
  leadId,
  lists,
  currentListIds,
}: {
  leadId: string;
  lists: readonly LeadListOption[];
  currentListIds: readonly string[];
}) {
  const [addState, addAction, addPending] = useActionState(
    addLeadToListAction,
    initialListActionState,
  );
  const [removeState, removeAction] = useActionState(
    removeLeadFromListAction,
    initialListActionState,
  );

  const current = lists.filter((list) => currentListIds.includes(list.id));
  const available = lists.filter((list) => !currentListIds.includes(list.id));
  const feedback = addState.message ?? removeState.message;
  const hasError = addState.status === "error" || removeState.status === "error";

  if (lists.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Voce ainda nao tem listas.{" "}
        <Link href="/listas" className="text-accent hover:underline">
          Criar a primeira
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {current.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {current.map((list) => (
            <li key={list.id}>
              <form action={removeAction} className="inline-flex">
                <input type="hidden" name="leadId" value={leadId} />
                <input type="hidden" name="listId" value={list.id} />
                <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-muted py-0.5 pr-1 pl-2 text-xs text-ink-muted">
                  {list.name}
                  <button
                    type="submit"
                    aria-label={`Remover de ${list.name}`}
                    className="rounded p-0.5 text-ink-subtle hover:text-negative"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      {available.length > 0 ? (
        <form action={addAction} className="flex items-end gap-2">
          <input type="hidden" name="leadId" value={leadId} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="lead-list" className="text-xs font-medium text-ink-muted">
              Adicionar a lista
            </label>
            <Select id="lead-list" name="listId" defaultValue={available[0].id}>
              {available.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={addPending}>
            {addPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-ink-subtle">Este lead já esta em todas as suas listas.</p>
      )}

      {feedback ? (
        <p role="status" className={hasError ? "text-xs text-negative" : "text-xs text-positive"}>
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
