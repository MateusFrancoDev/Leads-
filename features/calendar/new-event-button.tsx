"use client";

/** Criação de compromisso (reunião, entrega, lembrete) a partir do calendário. */

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { Modal } from "@/components/ui/modal";
import { useFormAction } from "@/components/ui/use-form-action";
import { EVENT_TYPE_OPTIONS } from "@/lib/domain/enums";
import { createEventAction } from "@/server/actions/content-actions";

export function NewEventButton({
  projects,
  clients,
}: {
  projects: ReadonlyArray<{ id: string; name: string; client: { name: string } }>;
  clients: ReadonlyArray<{ id: string; name: string; company: string | null }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, pending] = useFormAction(createEventAction, {
    onSuccess: () => setIsOpen(false),
  });
  const errors = state.fieldErrors ?? {};

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={() => setIsOpen(true)}>
        <CalendarPlus className="size-3.5" aria-hidden />
        Novo compromisso
      </Button>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Novo compromisso"
        description="Reuniões e entregas. Prazos de projeto e parcelas já aparecem sozinhos."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Título *" htmlFor="event-title" error={errors.title}>
            <Input
              id="event-title"
              name="title"
              required
              maxLength={200}
              placeholder="Reunião de alinhamento"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data e hora *" htmlFor="event-date" error={errors.startsAt}>
              <Input id="event-date" name="startsAt" type="datetime-local" required />
            </Field>

            <Field label="Tipo" htmlFor="event-type" error={errors.type}>
              <Select id="event-type" name="type" defaultValue="MEETING">
                {EVENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Projeto" htmlFor="event-project" error={errors.projectId}>
              <Select id="event-project" name="projectId" defaultValue="">
                <option value="">Nenhum</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} — {project.client.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Cliente" htmlFor="event-client" error={errors.clientId}>
              <Select id="event-client" name="clientId" defaultValue="">
                <option value="">Nenhum</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company ?? client.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Descrição" htmlFor="event-description" error={errors.description}>
            <Textarea id="event-description" name="description" maxLength={2000} />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <FormFeedback state={state} />
            <Button type="submit" variant="primary" disabled={pending} className="ml-auto">
              {pending ? "Salvando..." : "Agendar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
