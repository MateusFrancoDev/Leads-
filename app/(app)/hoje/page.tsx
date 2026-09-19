import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Wallet } from "lucide-react";
import { Panel } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/feedback";
import { DeadlineBadge } from "@/components/ui/indicators";
import { addDays, describeDeadline, formatDate, startOfDay } from "@/lib/dates";
import { effectivePaymentStatus } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/server/auth/dal";
import { listCalendarItems } from "@/server/repositories/calendar-repository";
import { listPaymentsDueUntil } from "@/server/repositories/finance-repository";
import { listProjects } from "@/server/repositories/project-repository";
import { listTasksDueUntil } from "@/server/repositories/task-repository";
import type { ProjectFilters } from "@/lib/schemas/crm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Hoje" };

/** A janela de atenção: o que vence até uma semana à frente. */
const HORIZON_DAYS = 7;

export default async function TodayPage() {
  const user = await requireUser();

  const now = new Date();
  const today = startOfDay(now);
  const horizon = addDays(today, HORIZON_DAYS);

  const baseFilters = { view: "cards", sort: "deadline" } as ProjectFilters;

  const [tasks, payments, overdueProjects, dueProjects, todayEvents] = await Promise.all([
    listTasksDueUntil(horizon),
    listPaymentsDueUntil(horizon),
    listProjects({ ...baseFilters, overdue: true }),
    listProjects({ ...baseFilters, dueInDays: HORIZON_DAYS }),
    listCalendarItems(today, addDays(today, 1)),
  ]);

  const myTasks = tasks.filter((task) => task.assignee?.id === user.id);
  const otherTasks = tasks.filter((task) => task.assignee?.id !== user.id);
  const overduePayments = payments.filter((payment) => effectivePaymentStatus(payment, now) === "OVERDUE");
  const upcomingPayments = payments.filter((payment) => effectivePaymentStatus(payment, now) !== "OVERDUE");
  const meetings = todayEvents.filter((item) => item.kind === "event");

  const nothingToDo =
    tasks.length === 0 &&
    payments.length === 0 &&
    overdueProjects.length === 0 &&
    dueProjects.length === 0 &&
    meetings.length === 0;

  return (
    <>
      <PageHeader
        title="Hoje"
        description={`O que precisa da sua atenção hoje e nos próximos ${HORIZON_DAYS} dias.`}
      />

      {nothingToDo ? (
        <Panel className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <CheckCircle2 className="size-5 text-positive" aria-hidden />
          <p className="text-sm font-medium text-ink">Nada vencendo por enquanto</p>
          <p className="max-w-sm text-sm text-ink-muted">
            Nenhuma tarefa, pagamento ou prazo nos próximos {HORIZON_DAYS} dias. Bom momento para
            adiantar o que está em andamento.
          </p>
          <Link href="/projetos" className="mt-2 text-sm text-accent hover:underline">
            Ver projetos em andamento
          </Link>
        </Panel>
      ) : null}

      {overdueProjects.length > 0 ? (
        <Section
          title="Projetos atrasados"
          icon={<AlertTriangle className="size-3.5 text-negative" aria-hidden />}
          count={overdueProjects.length}
        >
          <ul className="flex flex-col divide-y divide-line">
            {overdueProjects.map((project) => {
              const info = describeDeadline(project.deadline as Date, project.startDate, now);
              return (
                <li key={project.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Link
                    href={`/projetos/${project.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-accent hover:underline"
                  >
                    {project.name}
                  </Link>
                  <span className="text-xs text-ink-subtle">{project.client.name}</span>
                  <DeadlineBadge deadline={project.deadline} startDate={project.startDate} />
                  <span className="text-xs text-ink-subtle tabular-nums">
                    {info.percentUsed !== null ? `${project.progress}% feito` : `${project.progress}%`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {overduePayments.length > 0 ? (
        <Section
          title="Pagamentos atrasados"
          icon={<AlertTriangle className="size-3.5 text-negative" aria-hidden />}
          count={overduePayments.length}
        >
          <ul className="flex flex-col divide-y divide-line">
            {overduePayments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <Link
                  href={`/projetos/${payment.project.id}?aba=financeiro`}
                  className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent hover:underline"
                >
                  {payment.project.name} · {payment.project.client.name}
                </Link>
                <span className="text-sm font-medium text-ink tabular-nums">
                  {formatMoney(payment.amountCents)}
                </span>
                <DeadlineBadge deadline={payment.dueDate} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {myTasks.length > 0 ? (
        <Section
          title="Minhas tarefas"
          icon={<Clock className="size-3.5 text-ink-subtle" aria-hidden />}
          count={myTasks.length}
          href="/tarefas?scope=minhas"
        >
          <TaskList tasks={myTasks} />
        </Section>
      ) : null}

      {otherTasks.length > 0 ? (
        <Section
          title="Outras tarefas com prazo"
          icon={<Clock className="size-3.5 text-ink-subtle" aria-hidden />}
          count={otherTasks.length}
          href="/tarefas"
        >
          <TaskList tasks={otherTasks} showAssignee />
        </Section>
      ) : null}

      {upcomingPayments.length > 0 ? (
        <Section
          title="Pagamentos a vencer"
          icon={<Wallet className="size-3.5 text-ink-subtle" aria-hidden />}
          count={upcomingPayments.length}
          href="/financeiro?status=PENDING"
        >
          <ul className="flex flex-col divide-y divide-line">
            {upcomingPayments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <Link
                  href={`/projetos/${payment.project.id}?aba=financeiro`}
                  className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent hover:underline"
                >
                  {payment.project.name} · {payment.project.client.name}
                </Link>
                <span className="text-sm font-medium text-ink tabular-nums">
                  {formatMoney(payment.amountCents)}
                </span>
                <DeadlineBadge deadline={payment.dueDate} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {dueProjects.length > 0 ? (
        <Section
          title="Entregas próximas"
          icon={<CalendarClock className="size-3.5 text-ink-subtle" aria-hidden />}
          count={dueProjects.length}
          href="/projetos"
        >
          <ul className="flex flex-col divide-y divide-line">
            {dueProjects.map((project) => (
              <li key={project.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <Link
                  href={`/projetos/${project.id}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-accent hover:underline"
                >
                  {project.name}
                </Link>
                <span className="text-xs text-ink-subtle">{project.client.name}</span>
                <span className="text-xs text-ink-subtle tabular-nums">{project.progress}%</span>
                <DeadlineBadge deadline={project.deadline} startDate={project.startDate} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {meetings.length > 0 ? (
        <Section
          title="Compromissos de hoje"
          icon={<CalendarClock className="size-3.5 text-ink-subtle" aria-hidden />}
          count={meetings.length}
          href="/calendario"
        >
          <ul className="flex flex-col divide-y divide-line">
            {meetings.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <Link
                  href={item.href}
                  className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent hover:underline"
                >
                  {item.title}
                </Link>
                <span className="text-xs text-ink-subtle">{item.subtitle}</span>
                <span className="text-xs text-ink-muted tabular-nums">
                  {item.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <p className="text-xs text-ink-subtle">Hoje é {formatDate(now)}.</p>
    </>
  );
}

function Section({
  title,
  icon,
  count,
  href,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
          {icon}
          {title}
          <span className="text-xs font-normal text-ink-subtle tabular-nums">({count})</span>
        </h2>
        {href ? (
          <Link href={href} className="text-xs text-accent hover:underline">
            Ver todos
          </Link>
        ) : null}
      </div>
      <Panel className="px-4">{children}</Panel>
    </section>
  );
}

function TaskList({
  tasks,
  showAssignee = false,
}: {
  tasks: ReadonlyArray<Awaited<ReturnType<typeof listTasksDueUntil>>[number]>;
  showAssignee?: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {tasks.map((task) => (
        <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
          <Link
            href={`/projetos/${task.project.id}?aba=tarefas`}
            className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent hover:underline"
          >
            {task.title}
          </Link>
          <span className="text-xs text-ink-subtle">{task.project.name}</span>
          {showAssignee ? (
            <span className="text-xs text-ink-subtle">
              {task.assignee?.name ?? "Sem responsável"}
            </span>
          ) : null}
          <DeadlineBadge deadline={task.deadline} />
        </li>
      ))}
    </ul>
  );
}
