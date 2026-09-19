"use client";

/** Formulário de entrada. Único ponto público do sistema. */

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { initialActionState } from "@/server/actions/action-state";
import { loginAction } from "@/server/actions/auth-actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialActionState);
  // Guardado pelo proxy quando alguém tenta abrir uma página sem estar logado.
  const next = useSearchParams().get("next") ?? "";
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="E-mail" htmlFor="login-email" error={errors.email}>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="voce@empresa.com.br"
        />
      </Field>

      <Field label="Senha" htmlFor="login-password" error={errors.password}>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-negative">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
