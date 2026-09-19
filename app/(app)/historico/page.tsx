import type { Metadata } from "next";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { ACTIVITY_ENTITIES, ACTIVITY_ENTITY_LABEL, type ActivityEntity } from "@/lib/domain/enums";
import { optionalParam } from "@/lib/search-params";
import { ActivityTimeline } from "@/features/activity/activity-timeline";
import { requireUser } from "@/server/auth/dal";
import { listActivities } from "@/server/repositories/content-repository";
import { listAllUsers } from "@/server/repositories/user-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Histórico" };

/** Teto de linhas por consulta: o histórico cresce para sempre. */
const PAGE_SIZE = 200;

export default async function HistoryPage({ searchParams }: PageProps<"/historico">) {
  await requireUser();

  const raw = await searchParams;
  const userId = optionalParam(raw, "userId");
  const rawEntity = optionalParam(raw, "entityType");
  const entityType = ACTIVITY_ENTITIES.includes(rawEntity as ActivityEntity)
    ? (rawEntity as ActivityEntity)
    : undefined;

  const [activities, users] = await Promise.all([
    listActivities({ limit: PAGE_SIZE, userId, entityType }),
    listAllUsers(),
  ]);

  return (
    <>
      <PageHeader
        title="Histórico"
        description="Quem fez o quê, em ordem. Registrado automaticamente a cada ação."
      />

      <FilterBar
        action="/historico"
        showSearch={false}
        hasActiveFilters={Boolean(userId || entityType)}
      >
        <FilterSelect
          name="userId"
          label="Usuário"
          value={userId}
          options={users.map((user) => ({ value: user.id, label: user.name }))}
        />
        <FilterSelect
          name="entityType"
          label="Tipo"
          value={entityType}
          options={ACTIVITY_ENTITIES.map((entity) => ({
            value: entity,
            label: ACTIVITY_ENTITY_LABEL[entity],
          }))}
        />
      </FilterBar>

      <Panel className="px-4 py-2">
        <ActivityTimeline
          activities={activities}
          showProject
          emptyTitle="Nenhuma atividade registrada"
          emptyDescription="Cadastre um cliente ou um projeto e o histórico começa a se preencher sozinho."
        />
      </Panel>

      {activities.length === PAGE_SIZE ? (
        <p className="text-xs text-ink-subtle">
          Mostrando as {PAGE_SIZE} atividades mais recentes. Use os filtros para chegar às mais
          antigas.
        </p>
      ) : null}
    </>
  );
}
