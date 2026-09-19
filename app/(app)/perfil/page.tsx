import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/layout/user-menu";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { EnumBadge } from "@/components/ui/indicators";
import { Stat, StatGrid } from "@/components/ui/stat";
import { formatDate, formatDateTime } from "@/lib/dates";
import { USER_ROLE } from "@/lib/domain/enums";
import { PasswordForm, ProfileForm } from "@/features/settings/settings-forms";
import { ActivityTimeline } from "@/features/activity/activity-timeline";
import { requireUser } from "@/server/auth/dal";
import { listActivities } from "@/server/repositories/content-repository";
import { countPendingTasks } from "@/server/repositories/task-repository";
import { findUserById } from "@/server/repositories/user-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const session = await requireUser();

  const [user, myTasks, activities] = await Promise.all([
    findUserById(session.id),
    countPendingTasks(session.id),
    listActivities({ limit: 30, userId: session.id }),
  ]);

  // A sessão é válida mas o usuário sumiu do banco: trata como página inexistente.
  if (!user) notFound();

  return (
    <>
      <PageHeader title="Meu perfil" description="Seus dados e o que você fez no sistema." />

      <Panel className="flex flex-wrap items-center gap-4 p-4 md:p-5">
        <Avatar name={user.name} avatarUrl={user.avatarUrl} className="size-12 text-base" />
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-ink">{user.name}</p>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
        <div className="ml-auto">
          <EnumBadge option={USER_ROLE[user.role]} />
        </div>
      </Panel>

      <StatGrid columns={3}>
        <Stat
          label="Tarefas atribuídas a você"
          value={String(myTasks)}
          href="/tarefas?scope=minhas"
        />
        <Stat
          label="Último acesso"
          value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Agora"}
        />
        <Stat label="No sistema desde" value={formatDate(user.createdAt)} />
      </StatGrid>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Dados</h2>
        <Panel className="p-4 md:p-5">
          <ProfileForm name={user.name} email={user.email} />
        </Panel>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Alterar senha</h2>
        <Panel className="p-4 md:p-5">
          <PasswordForm />
        </Panel>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Suas últimas ações</h2>
        <Panel className="px-4 py-2">
          <ActivityTimeline
            activities={activities}
            showProject
            emptyTitle="Nada registrado ainda"
            emptyDescription="Suas ações no sistema aparecem aqui assim que você começar a usar."
          />
        </Panel>
      </section>
    </>
  );
}
