import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/feedback";
import { addMonths, endOfMonth } from "@/lib/dates";
import { optionalParam } from "@/lib/search-params";
import {
  CalendarLegend,
  MonthCalendar,
  resolveMonth,
} from "@/features/calendar/month-calendar";
import { NewEventButton } from "@/features/calendar/new-event-button";
import { requireUser } from "@/server/auth/dal";
import { listCalendarItems } from "@/server/repositories/calendar-repository";
import { listClientOptions } from "@/server/repositories/client-repository";
import { listProjectOptions } from "@/server/repositories/project-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Calendário" };

/** "2026-09" - formato usado na navegação entre meses. */
function monthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendario">) {
  await requireUser();

  const month = resolveMonth(optionalParam(await searchParams, "mes"));

  const [items, projects, clients] = await Promise.all([
    listCalendarItems(month, endOfMonth(month)),
    listProjectOptions(),
    listClientOptions(),
  ]);

  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  const monthLabel = month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader
        title="Calendário"
        description="Prazos, pagamentos e compromissos no mesmo lugar."
        actions={<NewEventButton projects={projects} clients={clients} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/calendario?mes=${monthParam(previous)}`}
            aria-label="Mês anterior"
            className={buttonClasses("ghost", "sm")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <span className="min-w-40 text-center text-sm font-medium text-ink capitalize">
            {monthLabel}
          </span>
          <Link
            href={`/calendario?mes=${monthParam(next)}`}
            aria-label="Próximo mês"
            className={buttonClasses("ghost", "sm")}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
          <Link href="/calendario" className={buttonClasses("ghost", "sm")}>
            Hoje
          </Link>
        </div>

        <CalendarLegend />
      </div>

      <MonthCalendar month={month} items={items} />

      <p className="text-xs text-ink-subtle">
        Prazos de projeto, prazos de tarefa e vencimentos de parcela aparecem sozinhos, direto da
        origem. Só reuniões e entregas precisam ser criadas à mão.
      </p>
    </>
  );
}
