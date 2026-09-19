import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { EmptyState, PageHeader, Panel } from "@/components/ui/feedback";
import { FILE_CATEGORY_OPTIONS, toSelectOptions } from "@/lib/domain/enums";
import { fileFiltersSchema } from "@/lib/schemas/work";
import { FilesPanel } from "@/features/files/files-panel";
import { requireUser } from "@/server/auth/dal";
import { serverConfig } from "@/server/config";
import { listClientOptions } from "@/server/repositories/client-repository";
import { listFiles } from "@/server/repositories/content-repository";
import { listProjectOptions } from "@/server/repositories/project-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Arquivos" };

export default async function FilesPage({ searchParams }: PageProps<"/arquivos">) {
  await requireUser();

  const filters = fileFiltersSchema.parse(await searchParams);
  const [files, projects, clients] = await Promise.all([
    listFiles(filters),
    listProjectOptions(),
    listClientOptions(),
  ]);

  const hasFilters = Boolean(filters.q || filters.category || filters.projectId || filters.clientId);
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);

  return (
    <>
      <PageHeader
        title="Arquivos"
        description="Contratos, briefings, logos e tudo que o cliente enviou."
      />

      <FilterBar
        action="/arquivos"
        searchValue={filters.q}
        searchPlaceholder="Nome do arquivo"
        hasActiveFilters={hasFilters}
      >
        <FilterSelect
          name="category"
          label="Categoria"
          value={filters.category}
          options={toSelectOptions(FILE_CATEGORY_OPTIONS)}
        />
        <FilterSelect
          name="projectId"
          label="Projeto"
          value={filters.projectId}
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
        />
        <FilterSelect
          name="clientId"
          label="Cliente"
          value={filters.clientId}
          options={clients.map((client) => ({
            value: client.id,
            label: client.company ?? client.name,
          }))}
        />
      </FilterBar>

      {files.length === 0 ? (
        <Panel>
          <EmptyState
            title={hasFilters ? "Nenhum arquivo com esses filtros" : "Nenhum arquivo ainda"}
            description={
              hasFilters
                ? "Ajuste os filtros para ver outros arquivos."
                : "Arquivos são enviados dentro de um projeto ou de um cliente, na aba Arquivos."
            }
            action={
              hasFilters ? (
                <Link href="/arquivos" className={buttonClasses("secondary", "sm")}>
                  Limpar filtros
                </Link>
              ) : (
                <Link href="/projetos" className={buttonClasses("secondary", "sm")}>
                  Ir para projetos
                </Link>
              )
            }
          />
        </Panel>
      ) : (
        <>
          {/* Sem projeto nem cliente definido, esta tela é só consulta: o envio
              acontece dentro do projeto ou do cliente, onde o arquivo pertence. */}
          <FilesPanel
            files={files}
            maxUploadMb={serverConfig.storage.maxUploadMb}
            showProject
          />
          <p className="text-xs text-ink-subtle tabular-nums">
            {files.length} arquivo(s) ·{" "}
            {(totalBytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB
            no total
          </p>
        </>
      )}
    </>
  );
}
