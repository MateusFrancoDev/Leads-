import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel } from "@/components/ui/feedback";
import { EnumBadge } from "@/components/ui/indicators";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { CLIENT_STATUS } from "@/lib/domain/enums";
import { formatMoney } from "@/lib/money";
import { clientFiltersSchema } from "@/lib/schemas/crm";
import { ClientFilters } from "@/features/clients/client-filters";
import { requireUser } from "@/server/auth/dal";
import { listClients } from "@/server/repositories/client-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  await requireUser();

  // `.catch()` nos campos do schema faz filtro inválido virar o padrão,
  // em vez de quebrar a página com um link antigo.
  const filters = clientFiltersSchema.parse(await searchParams);
  const clients = await listClients(filters);

  const hasFilters = Boolean(filters.q || filters.status);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Quem contrata a empresa, do primeiro contato ao projeto entregue."
        actions={
          <Link href="/clientes/novo" className={buttonClasses("primary", "sm")}>
            <Plus className="size-3.5" aria-hidden />
            Novo cliente
          </Link>
        }
      />

      <ClientFilters filters={filters} />

      {clients.length === 0 ? (
        <Panel>
          <EmptyState
            title={hasFilters ? "Nenhum cliente com esses filtros" : "Nenhum cliente cadastrado ainda"}
            description={
              hasFilters
                ? "Ajuste a busca ou o status para ver outros clientes."
                : "Cadastre o primeiro cliente para começar a registrar projetos, pagamentos e prazos."
            }
            action={
              hasFilters ? (
                <Link href="/clientes" className={buttonClasses("secondary", "sm")}>
                  Limpar filtros
                </Link>
              ) : (
                <Link href="/clientes/novo" className={buttonClasses("primary", "sm")}>
                  Cadastrar primeiro cliente
                </Link>
              )
            }
          />
        </Panel>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Status</Th>
                <Th>Contato</Th>
                <Th>Cidade</Th>
                <Th align="right">Projetos</Th>
                <Th align="right">Faturado</Th>
                <Th align="right">Recebido</Th>
                <Th>Desde</Th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <Tr key={client.id}>
                  <Td>
                    <Link
                      href={`/clientes/${client.id}`}
                      className="font-medium text-ink hover:text-accent hover:underline"
                    >
                      {client.name}
                    </Link>
                    {client.company ? (
                      <p className="text-xs text-ink-subtle">{client.company}</p>
                    ) : null}
                  </Td>
                  <Td>
                    <EnumBadge option={CLIENT_STATUS[client.status]} />
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-muted">
                      {client.whatsapp ?? client.phone ?? client.email ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-muted">
                      {client.city ? `${client.city}${client.state ? `/${client.state}` : ""}` : "—"}
                    </span>
                  </Td>
                  <Td align="right">{client.projectCount}</Td>
                  <Td align="right">{formatMoney(client.totalCents)}</Td>
                  <Td align="right">
                    <span className={client.receivedCents > 0 ? "text-positive" : undefined}>
                      {formatMoney(client.receivedCents)}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-muted">{formatDate(client.createdAt)}</span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {clients.length > 0 ? (
        <p className="text-xs text-ink-subtle">
          {clients.length} cliente{clients.length === 1 ? "" : "s"}.
        </p>
      ) : null}
    </>
  );
}
