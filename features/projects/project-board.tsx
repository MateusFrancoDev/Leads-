"use client";

/**
 * Kanban de projetos com arrastar e soltar.
 *
 * Usa a API de arrastar do próprio HTML (`draggable` + dragover/drop), sem
 * biblioteca. Ela não funciona bem em tela de toque - por isso cada cartão
 * também traz um seletor de coluna, que aparece no celular e serve de
 * alternativa acessível ao teclado em qualquer tamanho de tela.
 *
 * Ao soltar, o cartão muda de coluna na hora (estado otimista) e o servidor é
 * avisado em seguida; se a gravação falhar, o cartão volta para onde estava e
 * o erro aparece acima do quadro.
 */

import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { PROJECT_BOARD_COLUMNS, PROJECT_STATUS, type ProjectStatusValue } from "@/lib/domain/enums";
import { formatMoneyShort } from "@/lib/money";
import { ProjectCard } from "@/features/projects/project-card";
import { initialActionState } from "@/server/actions/action-state";
import { moveProjectAction } from "@/server/actions/project-actions";
import type { ProjectRow } from "@/server/repositories/project-repository";

export function ProjectBoard({ projects }: { projects: ReadonlyArray<ProjectRow> }) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ProjectStatusValue | null>(null);

  // A coluna muda na tela antes da resposta do servidor; o React desfaz sozinho
  // se a transição terminar sem o dado novo ter chegado.
  const [optimistic, moveOptimistic] = useOptimistic(
    projects,
    (current, move: { id: string; status: ProjectStatusValue }) =>
      current.map((project) =>
        project.id === move.id ? { ...project, status: move.status } : project,
      ),
  );

  function move(projectId: string, status: ProjectStatusValue): void {
    const project = optimistic.find((item) => item.id === projectId);
    if (!project || project.status === status) return;

    setError(null);
    startTransition(async () => {
      moveOptimistic({ id: projectId, status });

      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("status", status);

      const result = await moveProjectAction(initialActionState, formData);
      if (result.status === "error") setError(result.message ?? "Não foi possível mover o projeto.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {PROJECT_BOARD_COLUMNS.map((status) => {
          const columnProjects = optimistic.filter((project) => project.status === status);
          const totalCents = columnProjects.reduce((sum, project) => sum + project.valueCents, 0);

          return (
            <section
              key={status}
              onDragOver={(event) => {
                // Sem preventDefault o navegador recusa o "soltar".
                event.preventDefault();
                setDropTarget(status);
              }}
              onDragLeave={() => setDropTarget((current) => (current === status ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setDropTarget(null);
                const projectId = event.dataTransfer.getData("text/plain");
                if (projectId) move(projectId, status);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-canvas p-2 transition-colors",
                dropTarget === status ? "border-accent bg-accent-soft" : "border-line",
              )}
            >
              <header className="flex items-baseline justify-between gap-2 px-1.5 pt-1">
                <h3 className="text-xs font-medium text-ink">{PROJECT_STATUS[status].label}</h3>
                <span className="text-xs text-ink-subtle tabular-nums">
                  {columnProjects.length}
                  {totalCents > 0 ? ` · ${formatMoneyShort(totalCents)}` : ""}
                </span>
              </header>

              {columnProjects.length === 0 ? (
                <p className="px-1.5 py-6 text-center text-xs text-ink-subtle">
                  Arraste um projeto para cá.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {columnProjects.map((project) => (
                    <li
                      key={project.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", project.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <ProjectCard project={project} compact />

                      {/* Alternativa ao arrastar: funciona no toque e no teclado. */}
                      <label className="mt-1 flex items-center gap-1.5 px-1 text-xs text-ink-subtle">
                        <span className="sr-only">Mover {project.name} para</span>
                        <select
                          value={project.status}
                          onChange={(event) =>
                            move(project.id, event.target.value as ProjectStatusValue)
                          }
                          className="w-full rounded border border-line bg-surface px-1.5 py-1 text-xs text-ink-muted focus:border-accent focus:outline-none"
                        >
                          {PROJECT_BOARD_COLUMNS.map((option) => (
                            <option key={option} value={option}>
                              {PROJECT_STATUS[option].label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-xs text-ink-subtle">
        Arraste os cartões entre as colunas, ou use o seletor dentro de cada cartão. Projetos
        cancelados não aparecem no quadro.
      </p>
    </div>
  );
}
