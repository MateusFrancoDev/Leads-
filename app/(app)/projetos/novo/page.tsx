import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { optionalParam } from "@/lib/search-params";
import { ProjectForm } from "@/features/projects/project-form";
import { requireUser } from "@/server/auth/dal";
import { createProjectAction } from "@/server/actions/project-actions";
import { listClientOptions } from "@/server/repositories/client-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Novo projeto" };

export default async function NewProjectPage({ searchParams }: PageProps<"/projetos/novo">) {
  await requireUser();

  const clients = await listClientOptions();
  // Projeto sem cliente não existe: manda cadastrar antes de mostrar o formulário.
  if (clients.length === 0) redirect("/clientes/novo");

  // Vindo de "Criar primeiro projeto" na ficha do cliente, ele já vem escolhido.
  const clientId = optionalParam(await searchParams, "clientId");

  return (
    <>
      <Link
        href="/projetos"
        className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Voltar para projetos
      </Link>

      <PageHeader
        title="Novo projeto"
        description="Cliente e nome bastam para começar. Valor, prazo e parcelas podem entrar depois."
      />

      <Panel className="p-4 md:p-5">
        <ProjectForm
          action={createProjectAction}
          clients={clients}
          values={{ clientId }}
          submitLabel="Criar projeto"
          redirectOnSuccess={(id) => `/projetos/${id}`}
        />
      </Panel>
    </>
  );
}
