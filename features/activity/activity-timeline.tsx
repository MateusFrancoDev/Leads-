import Link from "next/link";
import { Avatar } from "@/components/layout/user-menu";
import { EmptyState } from "@/components/ui/feedback";
import { formatDateTime, formatDayMonth, formatRelative, isSameDay } from "@/lib/dates";

/**
 * Linha do tempo das atividades. Server Component: é só leitura.
 *
 * Os eventos são agrupados por dia, com a data aparecendo uma vez só à
 * esquerda - é assim que se lê "no dia 12 aconteceram três coisas" sem
 * repetir a data em toda linha.
 */

export interface ActivityItem {
  id: string;
  description: string;
  createdAt: Date;
  user: { id: string; name: string; avatarUrl: string | null } | null;
  project?: { id: string; name: string } | null;
}

export function ActivityTimeline({
  activities,
  /** Na página de histórico geral vale mostrar a que projeto o evento pertence. */
  showProject = false,
  emptyTitle = "Nada aconteceu ainda",
  emptyDescription = "Cada ação no sistema vira uma linha aqui, com quem fez e quando.",
}: {
  activities: ReadonlyArray<ActivityItem>;
  showProject?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (activities.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ol className="flex flex-col">
      {activities.map((activity, index) => {
        const previous = activities[index - 1];
        const isNewDay = !previous || !isSameDay(previous.createdAt, activity.createdAt);
        const isLast = index === activities.length - 1;

        return (
          <li key={activity.id} className="flex gap-3">
            <div className="flex w-12 shrink-0 justify-end pt-3">
              {isNewDay ? (
                <span className="text-xs text-ink-subtle tabular-nums">
                  {formatDayMonth(activity.createdAt)}
                </span>
              ) : null}
            </div>

            {/* A linha vertical liga os eventos; o último não continua. */}
            <div className="flex shrink-0 flex-col items-center">
              <span className="mt-4 size-1.5 rounded-full bg-line-strong" aria-hidden />
              {isLast ? null : <span className="w-px flex-1 bg-line" aria-hidden />}
            </div>

            <div className="min-w-0 flex-1 py-3">
              <p className="text-sm text-ink">{activity.description}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
                {activity.user ? (
                  <Avatar
                    name={activity.user.name}
                    avatarUrl={activity.user.avatarUrl}
                    className="size-4 text-[9px]"
                  />
                ) : null}
                <span title={formatDateTime(activity.createdAt)}>
                  {formatRelative(activity.createdAt)}
                </span>
                {showProject && activity.project ? (
                  <>
                    <span aria-hidden>·</span>
                    <Link
                      href={`/projetos/${activity.project.id}`}
                      className="truncate hover:text-ink-muted hover:underline"
                    >
                      {activity.project.name}
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
