"use client";

/** Formulários de configuração: dados da empresa, perfil e troca de senha. */

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { MIN_PASSWORD_LENGTH } from "@/lib/schemas/auth";
import { initialActionState } from "@/server/actions/action-state";
import {
  changePasswordAction,
  updateCompanyAction,
  updateProfileAction,
} from "@/server/actions/settings-actions";

export function CompanyForm({ companyName }: { companyName: string }) {
  const [state, formAction, pending] = useActionState(updateCompanyAction, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Nome da empresa"
        htmlFor="company-name"
        hint="Aparece na navegação e na tela de entrada."
        error={errors.companyName}
      >
        <Input
          id="company-name"
          name="companyName"
          required
          maxLength={80}
          defaultValue={companyName}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormFeedback state={state} />
        <Button type="submit" variant="primary" disabled={pending} className="ml-auto">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="profile-name" error={errors.name}>
          <Input id="profile-name" name="name" required maxLength={120} defaultValue={name} />
        </Field>

        <Field label="E-mail" htmlFor="profile-email" error={errors.email}>
          <Input
            id="profile-email"
            name="email"
            type="email"
            required
            maxLength={200}
            defaultValue={email}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormFeedback state={state} />
        <Button type="submit" variant="primary" disabled={pending} className="ml-auto">
          {pending ? "Salvando..." : "Salvar perfil"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Senha atual" htmlFor="current-password" error={errors.currentPassword}>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nova senha"
          htmlFor="new-password"
          hint={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres, com letra e número.`}
          error={errors.newPassword}
        >
          <Input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </Field>

        <Field label="Repita a nova senha" htmlFor="confirm-password" error={errors.confirmPassword}>
          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormFeedback state={state} />
        <Button type="submit" variant="primary" disabled={pending} className="ml-auto">
          {pending ? "Alterando..." : "Alterar senha"}
        </Button>
      </div>
    </form>
  );
}
