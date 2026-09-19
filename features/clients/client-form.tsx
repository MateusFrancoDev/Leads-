"use client";

/**
 * Cadastro e edição de cliente. O mesmo componente serve os dois casos: o que
 * muda é o action e os valores iniciais, então não existem dois formulários
 * para manter em sincronia.
 */


import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { useFormAction } from "@/components/ui/use-form-action";
import { CLIENT_STATUS_OPTIONS } from "@/lib/domain/enums";
import type { ActionState } from "@/server/actions/action-state";

export interface ClientFormValues {
  id?: string;
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  website?: string | null;
  document?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string;
  notes?: string | null;
}

export function ClientForm({
  action,
  values = {},
  submitLabel = "Salvar cliente",
  /** Depois de criar, leva para a ficha do cliente para já criar o projeto. */
  redirectOnSuccess,
  onDone,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values?: ClientFormValues;
  submitLabel?: string;
  redirectOnSuccess?: (clientId: string) => string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useFormAction(action, {
    onSuccess: (result) => {
      onDone?.();
      // Depois de criar, segue direto para a ficha do registro novo.
      if (redirectOnSuccess && result.createdId) router.push(redirectOnSuccess(result.createdId));
    },
  });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {values.id ? <input type="hidden" name="clientId" value={values.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *" htmlFor="client-name" error={errors.name}>
          <Input
            id="client-name"
            name="name"
            required
            maxLength={120}
            defaultValue={values.name ?? ""}
            placeholder="Maria Souza"
          />
        </Field>

        <Field label="Empresa" htmlFor="client-company" error={errors.company}>
          <Input
            id="client-company"
            name="company"
            maxLength={160}
            defaultValue={values.company ?? ""}
            placeholder="Souza Odontologia"
          />
        </Field>

        <Field label="E-mail" htmlFor="client-email" error={errors.email}>
          <Input
            id="client-email"
            name="email"
            type="email"
            maxLength={200}
            defaultValue={values.email ?? ""}
          />
        </Field>

        <Field label="Telefone" htmlFor="client-phone" error={errors.phone}>
          <Input
            id="client-phone"
            name="phone"
            inputMode="tel"
            maxLength={30}
            defaultValue={values.phone ?? ""}
            placeholder="(11) 3456-7890"
          />
        </Field>

        <Field label="WhatsApp" htmlFor="client-whatsapp" error={errors.whatsapp}>
          <Input
            id="client-whatsapp"
            name="whatsapp"
            inputMode="tel"
            maxLength={30}
            defaultValue={values.whatsapp ?? ""}
            placeholder="(11) 98765-4321"
          />
        </Field>

        <Field label="Instagram" htmlFor="client-instagram" error={errors.instagram}>
          <Input
            id="client-instagram"
            name="instagram"
            maxLength={80}
            defaultValue={values.instagram ?? ""}
            placeholder="@souzaodonto"
          />
        </Field>

        <Field label="Site" htmlFor="client-website" error={errors.website}>
          <Input
            id="client-website"
            name="website"
            maxLength={300}
            defaultValue={values.website ?? ""}
            placeholder="souzaodonto.com.br"
          />
        </Field>

        <Field
          label="CPF / CNPJ"
          htmlFor="client-document"
          hint="Opcional. Usado no contrato e na nota."
          error={errors.document}
        >
          <Input
            id="client-document"
            name="document"
            inputMode="numeric"
            maxLength={25}
            defaultValue={values.document ?? ""}
          />
        </Field>

        <Field label="Cidade" htmlFor="client-city" error={errors.city}>
          <Input
            id="client-city"
            name="city"
            maxLength={120}
            defaultValue={values.city ?? ""}
          />
        </Field>

        <Field label="UF" htmlFor="client-state" error={errors.state}>
          <Input
            id="client-state"
            name="state"
            maxLength={40}
            defaultValue={values.state ?? ""}
            placeholder="SP"
          />
        </Field>

        <Field label="Status" htmlFor="client-status" error={errors.status}>
          <Select id="client-status" name="status" defaultValue={values.status ?? "LEAD"}>
            {CLIENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Observações" htmlFor="client-notes" error={errors.notes}>
        <Textarea
          id="client-notes"
          name="notes"
          maxLength={4000}
          defaultValue={values.notes ?? ""}
          placeholder="Como chegou até nós, o que foi combinado, preferências..."
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormFeedback state={state} />
        <Button type="submit" variant="primary" disabled={pending} className="ml-auto">
          {pending ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
