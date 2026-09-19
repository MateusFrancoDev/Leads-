import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { ClientForm } from "@/features/clients/client-form";
import { requireUser } from "@/server/auth/dal";
import { createClientAction } from "@/server/actions/client-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NewClientPage() {
  await requireUser();

  return (
    <>
      <Link
        href="/clientes"
        className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Voltar para clientes
      </Link>

      <PageHeader
        title="Novo cliente"
        description="Só o nome é obrigatório. O resto pode ser completado depois."
      />

      <Panel className="p-4 md:p-5">
        {/* Ao salvar, vai direto para a ficha - de onde se cria o primeiro projeto. */}
        <ClientForm
          action={createClientAction}
          submitLabel="Cadastrar cliente"
          redirectOnSuccess={(id) => `/clientes/${id}`}
        />
      </Panel>
    </>
  );
}
