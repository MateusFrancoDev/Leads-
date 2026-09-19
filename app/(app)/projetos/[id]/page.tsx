import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { DeadlineBadge, EnumBadge, FieldList, FieldValue } from "@/components/ui/indicators";
import { Stat, StatGrid } from "@/components/ui/stat";
import { Tabs } from "@/components/ui/tabs";
import { describeDeadline, formatDate } from "@/lib/dates";
import {
  CONTRACT_STATUS,
  FILE_CATEGORY,
  PRIORITY,
  PROJECT_STATUS,
  PROJECT_TYPE,
} from "@/lib/domain/enums";
import { summarizeProjectFinance } from "@/lib/finance";
import { formatMoney, formatPercent } from "@/lib/money";
import { readParam } from "@/lib/search-params";
import { ActivityTimeline } from "@/features/activity/activity-timeline";
import { FilesPanel } from "@/features/files/files-panel";
import { NotesPanel } from "@/features/notes/notes-panel";
import { BriefingForm } from "@/features/projects/briefing-form";
import { ContractControl, ProgressControl } from "@/features/projects/project-controls";
import { ProjectFinancePanel } from "@/features/projects/project-finance-panel";
import { ProjectForm } from "@/features/projects/project-form";
import { NewTaskButton, TaskBoard } from "@/features/tasks/task-board";
import { deleteProjectAction, updateProjectAction } from "@/server/actions/project-actions";
import { requireUser } from "@/server/auth/dal";
import { serverConfig } from "@/server/config";
import { listClientOptions } from "@/server/repositories/client-repository";
import { findProjectDetail } from "@/server/repositories/project-repository";
import { listActiveUsers } from "@/server/repositories/user-repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/projetos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const project = await findProjectDetail(id);
  return { title: project?.name ?? "Projeto" };
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: PageProps<"/projetos/[id]">) {
  await requireUser();

  const { id } = await params;
  const project = await findProjectDetail(id);
  if (!project) notFound();

  const tab = readParam(await searchParams, "aba", "visao");
  const [clients, users] = await Promise.all([listClientOptions(), listActiveUsers()]);

  const finance = summarizeProjectFinance(project.valueCents, project.payments, project.expenses);
  const deadline = project.deadline ? describeDeadline(project.deadline, project.startDate) : null;
  const openTasks = project.tasks.filter((task) => task.status !== "DONE").length;
  const contractFiles = project.files.filter((file) => file.category === "CONTRACT");

  const projectOption = [{ id: project.id, name: project.name, client: { name: project.client.name } }];

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
        title={project.name}
        description={`${PROJECT_TYPE[project.type].label} · ${project.client.company ?? project.client.name}`}
        actions={
          <>
            {project.projectUrl ? (
              <a
                href={project.projectUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Abrir projeto
              </a>
            ) : null}
            {project.repositoryUrl ? (
              <a
                href={project.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <GitBranch className="size-3.5" aria-hidden />
                Repositório
              </a>
            ) : null}
            <ConfirmAction
              action={deleteProjectAction}
              hiddenFields={{ projectId: project.id }}
              title={`Excluir ${project.name}`}
              description="As tarefas, parcelas, custos, anotações, arquivos e a timeline deste projeto também serão apagados."
              triggerLabel="Excluir"
              variant="secondary"
            />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <EnumBadge option={PROJECT_STATUS[project.status]} />
        <EnumBadge option={PRIORITY[project.priority]} />
        <DeadlineBadge deadline={project.deadline} startDate={project.startDate} />
        <Link
          href={`/clientes/${project.client.id}`}
          className="text-xs text-ink-muted hover:text-ink hover:underline"
        >
          {project.client.name}
        </Link>
      </div>

      <Tabs
        defaultValue="visao"
        items={[
          { value: "visao", label: "Visão geral" },
          { value: "tarefas", label: "Tarefas", count: openTasks },
          { value: "financeiro", label: "Financeiro", count: project.payments.length },
          { value: "briefing", label: "Briefing" },
          { value: "contrato", label: "Contrato" },
          { value: "arquivos", label: "Arquivos", count: project.files.length },
          { value: "anotacoes", label: "Anotações", count: project.projectNotes.length },
          { value: "timeline", label: "Timeline" },
          { value: "editar", label: "Editar" },
        ]}
      />

      {tab === "visao" ? (
        <>
          <StatGrid columns={4}>
            <Stat label="Valor do projeto" value={formatMoney(finance.totalCents)} />
            <Stat label="Recebido" value={formatMoney(finance.receivedCents)} tone="positive" />
            <Stat
              label="Falta receber"
              value={formatMoney(finance.remainingCents)}
              tone={finance.remainingCents > 0 ? "warning" : "default"}
            />
            <Stat
              label="Lucro"
              value={formatMoney(finance.profitCents)}
              hint={`Margem ${formatPercent(finance.marginPercent)}`}
              tone={finance.profitCents >= 0 ? "positive" : "negative"}
            />
          </StatGrid>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Panel className="p-4 md:p-5">
              <FieldList columns={2}>
                <FieldValue label="Cliente">
                  <Link
                    href={`/clientes/${project.client.id}`}
                    className="text-accent hover:underline"
                  >
                    {project.client.company ?? project.client.name}
                  </Link>
                </FieldValue>
                <FieldValue label="Tipo de serviço">{PROJECT_TYPE[project.type].label}</FieldValue>
                <FieldValue label="Início">{formatDate(project.startDate)}</FieldValue>
                <FieldValue label="Prazo de entrega">{formatDate(project.deadline)}</FieldValue>
                <FieldValue label="Contrato">
                  {CONTRACT_STATUS[project.contractStatus].label}
                </FieldValue>
                <FieldValue label="Concluído em">{formatDate(project.completedAt)}</FieldValue>
                <FieldValue label="Tecnologias">
                  {project.technologies.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {project.technologies.map((tech) => (
                        <Badge key={tech}>{tech}</Badge>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )}
                </FieldValue>
                <FieldValue label="Custo estimado">
                  {formatMoney(project.estimatedCostCents)}
                </FieldValue>
              </FieldList>

              {project.description ? (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-xs text-ink-subtle">Descrição</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{project.description}</p>
                </div>
              ) : null}

              {project.notes ? (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="text-xs text-ink-subtle">Observações</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{project.notes}</p>
                </div>
              ) : null}
            </Panel>

            <div className="flex flex-col gap-4">
              <Panel className="p-4">
                <ProgressControl projectId={project.id} progress={project.progress} />
              </Panel>

              {deadline ? (
                <Panel className="p-4">
                  <h3 className="text-sm font-medium text-ink">Prazo</h3>
                  <p
                    className={`mt-1 text-lg font-semibold ${deadline.isOverdue ? "text-negative" : "text-ink"}`}
                  >
                    {deadline.label}
                  </p>
                  <dl className="mt-3 flex flex-col gap-1.5 text-xs text-ink-muted">
                    <div className="flex justify-between gap-3">
                      <dt>Entrega combinada</dt>
                      <dd className="text-ink tabular-nums">{formatDate(project.deadline)}</dd>
                    </div>
                    {deadline.daysRunning !== null ? (
                      <div className="flex justify-between gap-3">
                        <dt>Em andamento há</dt>
                        <dd className="text-ink tabular-nums">{deadline.daysRunning} dias</dd>
                      </div>
                    ) : null}
                    {deadline.percentUsed !== null ? (
                      <div className="flex justify-between gap-3">
                        <dt>Prazo consumido</dt>
                        <dd className="text-ink tabular-nums">{deadline.percentUsed}%</dd>
                      </div>
                    ) : null}
                  </dl>
                </Panel>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {tab === "tarefas" ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <NewTaskButton projects={projectOption} users={users} lockedProjectId={project.id} />
          </div>
          <TaskBoard tasks={project.tasks} projects={projectOption} users={users} hideProject />
        </div>
      ) : null}

      {tab === "financeiro" ? (
        <ProjectFinancePanel
          projectId={project.id}
          valueCents={project.valueCents}
          payments={project.payments}
          expenses={project.expenses}
        />
      ) : null}

      {tab === "briefing" ? (
        <Panel className="p-4 md:p-5">
          <BriefingForm projectId={project.id} values={project.briefing ?? {}} />
        </Panel>
      ) : null}

      {tab === "contrato" ? (
        <div className="flex flex-col gap-4">
          <Panel className="p-4 md:p-5">
            <ContractControl projectId={project.id} contractStatus={project.contractStatus} />
          </Panel>

          <div>
            <h3 className="mb-3 text-sm font-medium text-ink">Arquivos do contrato</h3>
            <p className="mb-3 text-xs text-ink-subtle">
              Envie o contrato com a categoria &quot;{FILE_CATEGORY.CONTRACT.label}&quot; para que
              ele apareça aqui.
            </p>
            <FilesPanel
              files={contractFiles}
              projectId={project.id}
              maxUploadMb={serverConfig.storage.maxUploadMb}
            />
          </div>
        </div>
      ) : null}

      {tab === "arquivos" ? (
        <FilesPanel
          files={project.files}
          projectId={project.id}
          maxUploadMb={serverConfig.storage.maxUploadMb}
        />
      ) : null}

      {tab === "anotacoes" ? (
        <NotesPanel notes={project.projectNotes} projectId={project.id} />
      ) : null}

      {tab === "timeline" ? (
        <Panel className="px-4 py-2">
          <ActivityTimeline
            activities={project.activities}
            emptyTitle="A timeline começa agora"
            emptyDescription="Cada mudança de status, pagamento, arquivo e anotação vira uma linha aqui, automaticamente."
          />
        </Panel>
      ) : null}

      {tab === "editar" ? (
        <Panel className="p-4 md:p-5">
          <ProjectForm
            action={updateProjectAction}
            clients={clients}
            submitLabel="Salvar alterações"
            values={{
              id: project.id,
              clientId: project.clientId,
              name: project.name,
              type: project.type,
              description: project.description,
              valueCents: project.valueCents,
              estimatedCostCents: project.estimatedCostCents,
              startDate: project.startDate,
              deadline: project.deadline,
              status: project.status,
              priority: project.priority,
              progress: project.progress,
              technologies: project.technologies,
              projectUrl: project.projectUrl,
              repositoryUrl: project.repositoryUrl,
              notes: project.notes,
              contractStatus: project.contractStatus,
            }}
          />
        </Panel>
      ) : null}
    </>
  );
}
