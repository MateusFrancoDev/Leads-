import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { ColumnChart } from "@/components/charts/column-chart";
import { RankingBars } from "@/components/charts/ranking-bars";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel } from "@/components/ui/feedback";
import { DeadlineBadge } from "@/components/ui/indicators";
import { Stat, StatGrid } from "@/components/ui/stat";
import { formatDate } from "@/lib/dates";
import { PROJECT_TYPE } from "@/lib/domain/enums";
import { formatMoney, formatMoneyShort, formatPercent } from "@/lib/money";
import { QuickActions } from "@/features/dashboard/quick-actions";
import { requireUser } from "@/server/auth/dal";
import { listClientOptions } from "@/server/repositories/client-repository";
import { listProjectOptions } from "@/server/repositories/project-repository";
import { listActiveUsers } from "@/server/repositories/user-repository";
import {
  readDashboardTotals,
  readMonthlySeries,
  readProjectsByType,
  readRankings,
  readUpcomingDeadlines,
} from "@/server/repositories/metrics-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();

  // Tudo do painel em paralelo: são consultas independentes.
  const [totals, series, byType, rankings, clients, projects, users] = await Promise.all([
    readDashboardTotals(),
    readMonthlySeries(6),
    readProjectsByType(),
    readRankings(5),
    listClientOptions(),
    listProjectOptions(),
    listActiveUsers(),
  ]);

  const isEmptySystem = totals.clients === 0;

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}`}
        description="Como a empresa está agora."
      />

      <QuickActions clients={clients} projects={projects} users={users} />

      {isEmptySystem ? (
        <Panel>
          <EmptyState
            title="Nenhum cliente cadastrado ainda"
            description="Comece cadastrando o primeiro cliente. Depois disso o painel passa a mostrar projetos, prazos e números."
            action={
              <Link href="/clientes/novo" className={buttonClasses("primary", "sm")}>
                Cadastrar primeiro cliente
              </Link>
            }
          />
        </Panel>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">Clientes e projetos</h2>
        <StatGrid columns={4}>
          <Stat label="Clientes" value={String(totals.clients)} href="/clientes" />
          <Stat
            label="Clientes ativos"
            value={String(totals.activeClients)}
            href="/clientes?status=ACTIVE"
          />
          <Stat label="Projetos ativos" value={String(totals.activeProjects)} href="/projetos" />
          <Stat
            label="Projetos concluídos"
            value={String(totals.completedProjects)}
            href="/projetos?status=COMPLETED"
          />
          <Stat
            label="Projetos atrasados"
            value={String(totals.overdueProjects)}
            tone={totals.overdueProjects > 0 ? "negative" : "default"}
            href="/projetos?overdue=true"
          />
          <Stat
            label="Tarefas pendentes"
            value={String(totals.pendingTasks)}
            href="/tarefas"
          />
          <Stat
            label="Pagamentos atrasados"
            value={String(totals.overduePaymentsCount)}
            hint={
              totals.overduePaymentsCents > 0 ? formatMoney(totals.overduePaymentsCents) : undefined
            }
            tone={totals.overduePaymentsCount > 0 ? "negative" : "default"}
            href="/financeiro?status=OVERDUE"
          />
          <Stat
            label="Margem de lucro"
            value={formatPercent(totals.marginPercent)}
            hint="Receita combinada menos custos"
          />
        </StatGrid>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">Dinheiro</h2>
        <StatGrid columns={4}>
          <Stat label="Valor total vendido" value={formatMoney(totals.soldCents)} />
          <Stat
            label="Valor recebido"
            value={formatMoney(totals.receivedCents)}
            tone="positive"
            href="/financeiro?status=PAID"
          />
          <Stat
            label="Valor a receber"
            value={formatMoney(totals.receivableCents)}
            tone={totals.receivableCents > 0 ? "warning" : "default"}
            href="/financeiro?status=PENDING"
          />
          <Stat label="Custos" value={formatMoney(totals.costCents)} href="/financeiro?tab=custos" />
        </StatGrid>
        <StatGrid columns={2}>
          <Stat
            label="Lucro estimado"
            value={formatMoney(totals.profitCents)}
            hint="Valor vendido menos os custos lançados"
            tone={totals.profitCents >= 0 ? "positive" : "negative"}
          />
          <Stat
            label="Ticket médio por projeto"
            value={formatMoney(
              totals.activeProjects + totals.completedProjects > 0
                ? Math.round(totals.soldCents / (totals.activeProjects + totals.completedProjects))
                : 0,
            )}
          />
        </StatGrid>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ColumnChart
          title="Faturamento por mês"
          description="Pagamentos efetivamente recebidos."
          points={series.map((point) => ({ label: point.label, value: point.revenueCents }))}
          primaryLabel="Recebido"
          format="money"
        />

        <ColumnChart
          title="Receita x custos"
          description="Entrada e saída no mesmo mês."
          points={series.map((point) => ({
            label: point.label,
            value: point.revenueCents,
            secondary: point.costCents,
          }))}
          primaryLabel="Receita"
          secondaryLabel="Custos"
          format="money"
        />

        <ColumnChart
          title="Lucro por mês"
          description="Recebido menos custos. Abaixo da linha é prejuízo."
          points={series.map((point) => ({ label: point.label, value: point.profitCents }))}
          primaryLabel="Lucro"
          format="money"
          diverging
        />

        <ColumnChart
          title="Projetos concluídos por mês"
          points={series.map((point) => ({ label: point.label, value: point.closedProjects }))}
          primaryLabel="Projetos"
          format="number"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <RankingBars
          title="Projetos por tipo de serviço"
          items={byType.map((item) => ({
            label: PROJECT_TYPE[item.type].label,
            value: item.count,
            display: `${item.count} · ${formatMoneyShort(item.valueCents)}`,
          }))}
          emptyMessage="Nenhum projeto cadastrado."
        />
        <RankingBars
          title="Clientes que mais geraram receita"
          items={rankings.topClientsByRevenue.map((item) => ({
            label: item.name,
            value: item.valueCents,
            display: formatMoneyShort(item.valueCents),
          }))}
          emptyMessage="Nenhum cliente com projeto ainda."
        />
        <RankingBars
          title="Projetos com maior lucro"
          items={rankings.topProjectsByProfit.map((item) => ({
            label: `${item.name} · ${item.client}`,
            value: item.profitCents,
            display: formatMoneyShort(item.profitCents),
          }))}
          emptyMessage="Nenhum projeto cadastrado."
        />
      </section>

      <Suspense fallback={<p className="text-sm text-ink-muted">Carregando prazos...</p>}>
        <UpcomingDeadlines />
      </Suspense>
    </>
  );
}

/** Próximos prazos em três janelas, como pedido: 7, 15 e 30 dias. */
async function UpcomingDeadlines() {
  const [next7, next15, next30] = await Promise.all([
    readUpcomingDeadlines(7),
    readUpcomingDeadlines(15),
    readUpcomingDeadlines(30),
  ]);

  // As janelas são cumulativas: cada bloco mostra só o que é novo na sua faixa.
  const ids7 = new Set(next7.map((item) => `${item.kind}:${item.id}`));
  const ids15 = new Set(next15.map((item) => `${item.kind}:${item.id}`));

  const groups = [
    { label: "Próximos 7 dias", items: next7 },
    { label: "8 a 15 dias", items: next15.filter((item) => !ids7.has(`${item.kind}:${item.id}`)) },
    { label: "16 a 30 dias", items: next30.filter((item) => !ids15.has(`${item.kind}:${item.id}`)) },
  ];

  const total = next30.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">Próximos prazos</h2>
        <Link href="/hoje" className="flex items-center gap-1 text-xs text-accent hover:underline">
          Ver o que precisa de atenção
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>

      {total === 0 ? (
        <Panel>
          <EmptyState
            title="Nenhum prazo nos próximos 30 dias"
            description="Quando um projeto ou uma tarefa tiver prazo, ele aparece aqui em ordem de vencimento."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {groups.map((group) => (
            <Panel key={group.label} className="p-4">
              <h3 className="text-sm font-medium text-ink">{group.label}</h3>
              {group.items.length === 0 ? (
                <p className="mt-2 text-xs text-ink-subtle">Nada nesta faixa.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2.5">
                  {group.items.slice(0, 8).map((item) => (
                    <li key={`${item.kind}:${item.id}`} className="flex flex-col gap-1">
                      <Link
                        href={item.href}
                        className="truncate text-sm text-ink hover:text-accent hover:underline"
                      >
                        {item.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-ink-subtle">
                          {item.kind === "project" ? "Projeto" : "Tarefa"} · {item.subtitle}
                        </span>
                        <DeadlineBadge deadline={item.deadline} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {group.items.length > 8 ? (
                <p className="mt-2 text-xs text-ink-subtle">
                  e mais {group.items.length - 8} até {formatDate(group.items.at(-1)?.deadline)}
                </p>
              ) : null}
            </Panel>
          ))}
        </div>
      )}
    </section>
  );
}
