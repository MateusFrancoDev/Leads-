import Link from "next/link";
import { EnumBadge, DeadlineBadge } from "@/components/ui/indicators";
import { ProgressBar } from "@/components/ui/progress";
import { PRIORITY, PROJECT_STATUS, PROJECT_TYPE } from "@/lib/domain/enums";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { ProjectRow } from "@/server/repositories/project-repository";

/**
 * Cartão de projeto. É o mesmo componente na lista de projetos, na ficha do
 * cliente e no Kanban - com `compact` para a versão que vive numa coluna
 * estreita, onde valor e progresso ainda cabem mas o resto não.
 */
export function ProjectCard({
  project,
  compact = false,
  className,
}: {
  project: ProjectRow;
  compact?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-line-strong",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/projetos/${project.id}`}
            className="block truncate text-sm font-medium text-ink hover:text-accent hover:underline"
          >
            {project.name}
          </Link>
          <Link
            href={`/clientes/${project.client.id}`}
            className="block truncate text-xs text-ink-subtle hover:text-ink-muted hover:underline"
          >
            {project.client.company ?? project.client.name}
          </Link>
        </div>
        {project.priority !== "NORMAL" && project.priority !== "LOW" ? (
          <EnumBadge option={PRIORITY[project.priority]} />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {compact ? null : <EnumBadge option={PROJECT_STATUS[project.status]} />}
        {compact ? null : (
          <span className="text-xs text-ink-subtle">{PROJECT_TYPE[project.type].label}</span>
        )}
        <DeadlineBadge deadline={project.deadline} startDate={project.startDate} />
      </div>

      <ProgressBar value={project.progress} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
        <span className="font-medium text-ink tabular-nums">{formatMoney(project.valueCents)}</span>
        <span className="text-ink-subtle tabular-nums">
          {project.finance.receivedCents > 0
            ? `${formatMoney(project.finance.receivedCents)} recebido`
            : "Nada recebido"}
        </span>
      </div>

      {project.openTaskCount > 0 ? (
        <p className="text-xs text-ink-subtle">
          {project.openTaskCount} tarefa{project.openTaskCount === 1 ? "" : "s"} em aberto
        </p>
      ) : null}
    </article>
  );
}
