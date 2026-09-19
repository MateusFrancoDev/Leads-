"use client";

/**
 * Anotações de um cliente ou projeto: campo de escrita no topo, histórico
 * abaixo, da mais recente para a mais antiga.
 *
 * O formulário fica em cima porque escrever é o que se faz aqui com mais
 * frequência - ler é consulta ocasional.
 */

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/layout/user-menu";
import { EmptyState } from "@/components/ui/feedback";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Textarea } from "@/components/ui/form";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { useFormAction } from "@/components/ui/use-form-action";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { createNoteAction, deleteNoteAction } from "@/server/actions/content-actions";

export interface NoteItem {
  id: string;
  content: string;
  createdAt: Date;
  user: { id: string; name: string; avatarUrl: string | null } | null;
  project?: { id: string; name: string } | null;
}

export function NotesPanel({
  notes,
  projectId,
  clientId,
}: {
  notes: ReadonlyArray<NoteItem>;
  projectId?: string;
  clientId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // Depois de salvar, o campo é limpo para a próxima anotação.
  const [state, formAction, pending] = useFormAction(createNoteAction, {
    onSuccess: () => formRef.current?.reset(),
  });

  return (
    <div className="flex flex-col gap-5">
      <form ref={formRef} action={formAction} className="flex flex-col gap-2.5">
        {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
        {clientId ? <input type="hidden" name="clientId" value={clientId} /> : null}

        <Textarea
          name="content"
          required
          maxLength={4000}
          aria-label="Nova anotação"
          placeholder="Cliente pediu alteração no menu. Novo prazo combinado para sexta."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormFeedback state={state} />
          <Button type="submit" variant="primary" size="sm" disabled={pending} className="ml-auto">
            {pending ? "Salvando..." : "Adicionar anotação"}
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <EmptyState
          title="Nenhuma anotação ainda"
          description="Use este espaço para o que foi combinado, o que o cliente pediu e o que ficou pendente."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-line bg-surface p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={note.user?.name ?? "?"} avatarUrl={note.user?.avatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">
                      {note.user?.name ?? "Usuário removido"}
                    </p>
                    <p className="text-xs text-ink-subtle" title={formatDateTime(note.createdAt)}>
                      {formatRelative(note.createdAt)}
                      {note.project ? ` · ${note.project.name}` : ""}
                    </p>
                  </div>
                </div>

                <ConfirmAction
                  action={deleteNoteAction}
                  hiddenFields={{ noteId: note.id }}
                  title="Excluir anotação"
                  description="A anotação será removida do histórico."
                  triggerLabel="Excluir"
                />
              </div>

              <p className="mt-2.5 text-sm whitespace-pre-wrap text-ink">{note.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
