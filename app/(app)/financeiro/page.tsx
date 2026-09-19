import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Panel } from "@/components/ui/feedback";
import { Stat, StatGrid } from "@/components/ui/stat";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { ColumnChart } from "@/components/charts/column-chart";
import { formatDate } from "@/lib/dates";
import { EXPENSE_CATEGORY, PAYMENT_METHOD } from "@/lib/domain/enums";
import { effectivePaymentStatus } from "@/lib/finance";
import { formatMoney, formatPercent } from "@/lib/money";
import { financeFiltersSchema } from "@/lib/schemas/work";
import { readParam } from "@/lib/search-params";
import { FinanceFilters } from "@/features/finance/finance-filters";
import { requireUser } from "@/server/auth/dal";
import { listClientOptions } from "@/server/repositories/client-repository";
import { listExpenses, listPayments } from "@/server/repositories/finance-repository";
import { listProjectOptions } from "@/server/repositories/project-repository";
import {
  readCurrentMonthTotals,
  readDashboardTotals,
  readMonthlySeries,
} from "@/server/repositories/metrics-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Financeiro" };

export default async function FinancePage({ searchParams }: PageProps<"/financeiro">) {
  await requireUser();

  const raw = await searchParams;
  const filters = financeFiltersSchema.parse(raw);
  const tab = readParam(raw, "tab", "recebimentos");

  const [totals, month, series, payments, expenses, clients, projects] = await Promise.all([
    readDashboardTotals(),
    readCurrentMonthTotals(),
    readMonthlySeries(6),
    listPayments(filters),
    listExpenses(filters),
    listClientOptions(),
    listProjectOptions(),
  ]);

  const filteredReceived = payments
    .filter((payment) => payment.status === "PAID")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const filteredPending = payments
    .filter((payment) => payment.status === "PENDING")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const filteredExpenses = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Quanto entrou, quanto falta entrar e quanto saiu."
      />

      <StatGrid columns={4}>
        <Stat label="Total vendido" value={formatMoney(totals.soldCents)} />
        <Stat label="Total recebido" value={formatMoney(totals.receivedCents)} tone="positive" />
        <Stat
          label="Total pendente"
          value={formatMoney(totals.receivableCents)}
          tone={totals.receivableCents > 0 ? "warning" : "default"}
        />
        <Stat
          label="Total atrasado"
          value={formatMoney(totals.overduePaymentsCents)}
          hint={`${totals.overduePaymentsCount} parcela(s)`}
          tone={totals.overduePaymentsCents > 0 ? "negative" : "default"}
        />
        <Stat label="Custos" value={formatMoney(totals.costCents)} />
        <Stat
          label="Lucro"
          value={formatMoney(totals.profitCents)}
          tone={totals.profitCents >= 0 ? "positive" : "negative"}
        />
        <Stat label="Margem" value={formatPercent(totals.marginPercent)} />
        <Stat
          label="Recebido este mês"
          value={formatMoney(month.receivedCents)}
          hint={`${month.newProjects} projeto(s) novo(s) · ${formatMoney(month.soldCents)} vendidos`}
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <ColumnChart
          title="Receita x custos"
          description="Últimos seis meses."
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
          points={series.map((point) => ({ label: point.label, value: point.profitCents }))}
          primaryLabel="Lucro"
          format="money"
          diverging
        />
      </div>

      <Tabs
        param="tab"
        defaultValue="recebimentos"
        items={[
          { value: "recebimentos", label: "Recebimentos", count: payments.length },
          { value: "custos", label: "Custos", count: expenses.length },
        ]}
      />

      <FinanceFilters filters={filters} clients={clients} projects={projects} tab={tab} />

      {tab === "custos" ? (
        expenses.length === 0 ? (
          <Panel>
            <EmptyState
              title="Nenhum custo no período"
              description="Os custos são lançados dentro de cada projeto, na aba Financeiro."
            />
          </Panel>
        ) : (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Descrição</Th>
                    <Th>Categoria</Th>
                    <Th>Projeto</Th>
                    <Th>Cliente</Th>
                    <Th>Data</Th>
                    <Th align="right">Valor</Th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <Tr key={expense.id}>
                      <Td>{expense.description}</Td>
                      <Td>
                        <span className="text-xs text-ink-muted">
                          {EXPENSE_CATEGORY[expense.category].label}
                        </span>
                      </Td>
                      <Td>
                        <Link
                          href={`/projetos/${expense.project.id}?aba=financeiro`}
                          className="text-xs text-ink-muted hover:underline"
                        >
                          {expense.project.name}
                        </Link>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-muted">{expense.project.client.name}</span>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-muted">{formatDate(expense.date)}</span>
                      </Td>
                      <Td align="right">{formatMoney(expense.amountCents)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <p className="text-xs text-ink-subtle tabular-nums">
              {expenses.length} lançamento(s) · Total {formatMoney(filteredExpenses)}
            </p>
          </>
        )
      ) : payments.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nenhum recebimento no período"
            description="As parcelas são lançadas dentro de cada projeto, na aba Financeiro."
          />
        </Panel>
      ) : (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Descrição</Th>
                  <Th>Projeto</Th>
                  <Th>Cliente</Th>
                  <Th>Forma</Th>
                  <Th>Vencimento</Th>
                  <Th>Recebido em</Th>
                  <Th>Situação</Th>
                  <Th align="right">Valor</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const status = effectivePaymentStatus(payment);
                  return (
                    <Tr key={payment.id}>
                      <Td>{payment.description ?? "Parcela"}</Td>
                      <Td>
                        <Link
                          href={`/projetos/${payment.project.id}?aba=financeiro`}
                          className="text-xs text-ink-muted hover:underline"
                        >
                          {payment.project.name}
                        </Link>
                      </Td>
                      <Td>
                        <Link
                          href={`/clientes/${payment.project.client.id}`}
                          className="text-xs text-ink-muted hover:underline"
                        >
                          {payment.project.client.name}
                        </Link>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-muted">
                          {PAYMENT_METHOD[payment.method].label}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-muted">{formatDate(payment.dueDate)}</span>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-muted">{formatDate(payment.paidAt)}</span>
                      </Td>
                      <Td>
                        <Badge
                          tone={
                            status === "PAID"
                              ? "positive"
                              : status === "OVERDUE"
                                ? "negative"
                                : status === "CANCELLED"
                                  ? "neutral"
                                  : "warning"
                          }
                        >
                          {status === "PAID"
                            ? "Recebido"
                            : status === "OVERDUE"
                              ? "Atrasado"
                              : status === "CANCELLED"
                                ? "Cancelado"
                                : "A receber"}
                        </Badge>
                      </Td>
                      <Td align="right">{formatMoney(payment.amountCents)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
          <p className="text-xs text-ink-subtle tabular-nums">
            {payments.length} parcela(s) · Recebido {formatMoney(filteredReceived)} · A receber{" "}
            {formatMoney(filteredPending)}
          </p>
        </>
      )}
    </>
  );
}
