import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState, PageHeader, Panel } from "@/components/ui/feedback";
import { EnumBadge, FieldList, FieldValue } from "@/components/ui/indicators";
import { Stat, StatGrid } from "@/components/ui/stat";
import { Tabs } from "@/components/ui/tabs";
import { formatDate } from "@/lib/dates";
import { readParam } from "@/lib/search-params";
import { CLIENT_STATUS } from "@/lib/domain/enums";
import { formatMoney, formatPercent, profitMargin } from "@/lib/money";
import { ActivityTimeline } from "@/features/activity/activity-timeline";
import { ClientForm } from "@/features/clients/client-form";
import { FilesPanel } from "@/features/files/files-panel";
import { NotesPanel } from "@/features/notes/notes-panel";
import { ProjectCard } from "@/features/projects/project-card";
import { deleteClientAction, updateClientAction } from "@/server/actions/client-actions";
import { requireUser } from "@/server/auth/dal";
import { serverConfig } from "@/server/config";
import { findClient } from "@/server/repositories/client-repository";
import { listProjectsByClient } from "@/server/repositories/project-repository";
import {
  listActivities,
  listClientFiles,
  listClientNotes,
} from "@/server/repositories/content-repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/clientes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const client = await findClient(id);
  return { title: client?.name ?? "Cliente" };
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: PageProps<"/clientes/[id]">) {
  await requireUser();

  const { id } = await params;
  const client = await findClient(id);
  if (!client) notFound();

  const tab = readParam(await searchParams, "aba", "visao");

  const [projects, notes, files] = await Promise.all([
    listProjectsByClient(client.id),
    listClientNotes(client.id),
    listClientFiles(client.id),
  ]);

  // Os números do cliente saem da soma dos projetos dele - nada é guardado
  // pronto, então nunca fica desatualizado.
  const totals = projects.reduce(
    (sum, project) => ({
      valueCents: sum.valueCents + project.finance.totalCents,
      receivedCents: sum.receivedCents + project.finance.receivedCents,
      remainingCents: sum.remainingCents + project.finance.remainingCents,
      costCents: sum.costCents + project.finance.costCents,
    }),
    { valueCents: 0, receivedCents: 0, remainingCents: 0, costCents: 0 },
  );
  const profitCents = totals.valueCents - totals.costCents;

  const openTasks = projects.reduce((sum, project) => sum + project.openTaskCount, 0);

  // A timeline do cliente é a soma das timelines dos projetos dele.
  const activities =
    projects.length > 0
      ? (await listActivities({ limit: 60 })).filter((activity) =>
          projects.some((project) => project.id === activity.project?.id),
        )
      : [];

  const contact = [client.whatsapp, client.phone, client.email].filter(Boolean);

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
        title={client.name}
        description={client.company ?? undefined}
        actions={
          <>
            <Link
              href={`/projetos/novo?clientId=${client.id}`}
              className={buttonClasses("primary", "sm")}
            >
              <Plus className="size-3.5" aria-hidden />
              {projects.length === 0 ? "Criar primeiro projeto" : "Novo projeto"}
            </Link>
            <ConfirmAction
              action={deleteClientAction}
              hiddenFields={{ clientId: client.id }}
              title={`Excluir ${client.name}`}
              description="Os projetos, pagamentos, custos, tarefas, anotações e arquivos deste cliente também serão apagados."
              triggerLabel="Excluir"
              variant="secondary"
            />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <EnumBadge option={CLIENT_STATUS[client.status]} />
        <span className="text-xs text-ink-subtle">Cliente desde {formatDate(client.createdAt)}</span>
      </div>

      <StatGrid columns={3}>
        <Stat label="Total faturado" value={formatMoney(totals.valueCents)} />
        <Stat label="Total recebido" value={formatMoney(totals.receivedCents)} tone="positive" />
        <Stat
          label="Total a receber"
          value={formatMoney(totals.remainingCents)}
          tone={totals.remainingCents > 0 ? "warning" : "default"}
        />
        <Stat label="Custos" value={formatMoney(totals.costCents)} />
        <Stat
          label="Lucro gerado"
          value={formatMoney(profitCents)}
          hint={`Margem ${formatPercent(profitMargin(totals.valueCents, totals.costCents))}`}
          tone={profitCents >= 0 ? "positive" : "negative"}
        />
        <Stat
          label="Projetos"
          value={String(projects.length)}
          hint={openTasks > 0 ? `${openTasks} tarefa(s) em aberto` : undefined}
        />
      </StatGrid>

      <Tabs
        defaultValue="visao"
        items={[
          { value: "visao", label: "Visão geral" },
          { value: "projetos", label: "Projetos", count: projects.length },
          { value: "anotacoes", label: "Anotações", count: notes.length },
          { value: "arquivos", label: "Arquivos", count: files.length },
          { value: "historico", label: "Histórico" },
          { value: "editar", label: "Editar" },
        ]}
      />

      {tab === "visao" ? (
        <Panel className="p-4 md:p-5">
          <FieldList>
            <FieldValue label="Contato">
              {contact.length > 0 ? contact.join(" · ") : "Não informado"}
            </FieldValue>
            <FieldValue label="Instagram">{client.instagram ?? "—"}</FieldValue>
            <FieldValue label="Site">
              {client.website ? (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  {client.website.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "—"
              )}
            </FieldValue>
            <FieldValue label="CPF / CNPJ">{client.document ?? "—"}</FieldValue>
            <FieldValue label="Cidade">
              {client.city ? `${client.city}${client.state ? `/${client.state}` : ""}` : "—"}
            </FieldValue>
            <FieldValue label="Cadastro">{formatDate(client.createdAt)}</FieldValue>
          </FieldList>

          {client.notes ? (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs text-ink-subtle">Observações</p>
              <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{client.notes}</p>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {tab === "projetos" ? (
        projects.length === 0 ? (
          <Panel>
            <EmptyState
              title="Nenhum projeto para este cliente"
              description="O próximo passo natural depois de cadastrar o cliente é registrar o que foi vendido."
              action={
                <Link
                  href={`/projetos/novo?clientId=${client.id}`}
                  className={buttonClasses("primary", "sm")}
                >
                  Criar primeiro projeto
                </Link>
              }
            />
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )
      ) : null}

      {tab === "anotacoes" ? <NotesPanel notes={notes} clientId={client.id} /> : null}

      {tab === "arquivos" ? (
        <FilesPanel
          files={files}
          clientId={client.id}
          maxUploadMb={serverConfig.storage.maxUploadMb}
          showProject
        />
      ) : null}

      {tab === "historico" ? (
        <Panel className="px-4 py-2">
          <ActivityTimeline
            activities={activities}
            showProject
            emptyTitle="Nenhuma atividade ainda"
            emptyDescription="Assim que houver movimento nos projetos deste cliente, tudo aparece aqui."
          />
        </Panel>
      ) : null}

      {tab === "editar" ? (
        <Panel className="p-4 md:p-5">
          <ClientForm
            action={updateClientAction}
            submitLabel="Salvar alterações"
            values={{
              id: client.id,
              name: client.name,
              company: client.company,
              email: client.email,
              phone: client.phone,
              whatsapp: client.whatsapp,
              instagram: client.instagram,
              website: client.website,
              document: client.document,
              city: client.city,
              state: client.state,
              status: client.status,
              notes: client.notes,
            }}
          />
        </Panel>
      ) : null}
    </>
  );
}
