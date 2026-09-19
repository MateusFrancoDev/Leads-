import Link from "next/link";
import { cn } from "@/lib/cn";
import { addDays, isSameDay, startOfDay } from "@/lib/dates";
import type { CalendarItem, CalendarItemKind } from "@/server/repositories/calendar-repository";

/**
 * Grade do mês. Server Component: navegar entre meses é um link, não estado.
 *
 * No celular a grade de sete colunas fica ilegível, então a mesma informação é
 * mostrada como lista de dias - não é a grade encolhida, é outro arranjo do
 * mesmo conteúdo.
 */

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/** Um ponto colorido por tipo de item, explicado na legenda. */
const KIND_DOT: Record<CalendarItemKind, string> = {
  project: "bg-accent",
  task: "bg-ink-subtle",
  payment: "bg-positive",
  event: "bg-warning",
};

export const KIND_LABEL: Record<CalendarItemKind, string> = {
  project: "Prazo de projeto",
  task: "Prazo de tarefa",
  payment: "Pagamento",
  event: "Compromisso",
};

export function MonthCalendar({
  month,
  items,
  today = new Date(),
}: {
  /** Primeiro dia do mês exibido. */
  month: Date;
  items: ReadonlyArray<CalendarItem>;
  today?: Date;
}) {
  // A grade começa no domingo da semana do dia 1 e vai até completar as semanas.
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const weeks = Math.ceil((lastOfMonth.getDate() + firstOfMonth.getDay()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, index) => addDays(gridStart, index));

  const itemsOn = (day: Date) => items.filter((item) => isSameDay(item.date, day));

  return (
    <>
      {/* Grade: notebook e desktop. */}
      <div className="hidden overflow-hidden rounded-lg border border-line bg-line md:block">
        <div className="grid grid-cols-7 gap-px">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="bg-surface px-2 py-1.5 text-center text-xs font-medium text-ink-subtle"
            >
              {weekday}
            </div>
          ))}

          {days.map((day) => {
            const dayItems = itemsOn(day);
            const isCurrentMonth = day.getMonth() === month.getMonth();
            const isToday = isSameDay(day, today);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-24 bg-surface p-1.5",
                  !isCurrentMonth && "bg-surface-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                    isToday
                      ? "bg-accent font-medium text-white"
                      : isCurrentMonth
                        ? "text-ink-muted"
                        : "text-ink-subtle",
                  )}
                >
                  {day.getDate()}
                </span>

                <ul className="mt-1 flex flex-col gap-0.5">
                  {dayItems.slice(0, 3).map((item) => (
                    <li key={`${item.kind}:${item.id}`}>
                      <Link
                        href={item.href}
                        title={`${KIND_LABEL[item.kind]}: ${item.title} — ${item.subtitle}`}
                        className={cn(
                          "flex items-center gap-1 rounded px-1 py-0.5 text-[11px] hover:bg-surface-muted",
                          item.isDone ? "text-ink-subtle line-through" : "text-ink-muted",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn("size-1.5 shrink-0 rounded-full", KIND_DOT[item.kind])}
                        />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </li>
                  ))}
                  {dayItems.length > 3 ? (
                    <li className="px-1 text-[11px] text-ink-subtle">
                      +{dayItems.length - 3} neste dia
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista: celular e tablet em pé. */}
      <div className="flex flex-col gap-2 md:hidden">
        {days
          .filter((day) => day.getMonth() === month.getMonth() && itemsOn(day).length > 0)
          .map((day) => (
            <section key={day.toISOString()} className="rounded-lg border border-line bg-surface p-3">
              <h3
                className={cn(
                  "text-xs font-medium",
                  isSameDay(day, today) ? "text-accent" : "text-ink-muted",
                )}
              >
                {day.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {itemsOn(day).map((item) => (
                  <li key={`${item.kind}:${item.id}`}>
                    <Link href={item.href} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", KIND_DOT[item.kind])}
                      />
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block truncate text-sm",
                            item.isDone ? "text-ink-subtle line-through" : "text-ink",
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="block truncate text-xs text-ink-subtle">
                          {KIND_LABEL[item.kind]}
                          {item.subtitle ? ` · ${item.subtitle}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

        {items.filter((item) => item.date.getMonth() === month.getMonth()).length === 0 ? (
          <p className="rounded-lg border border-line bg-surface px-4 py-8 text-center text-sm text-ink-subtle">
            Nenhum compromisso neste mês.
          </p>
        ) : null}
      </div>
    </>
  );
}

/** Legenda dos pontos. A cor sozinha nunca carrega a informação. */
export function CalendarLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {(Object.keys(KIND_LABEL) as CalendarItemKind[]).map((kind) => (
        <li key={kind} className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span aria-hidden className={cn("size-1.5 rounded-full", KIND_DOT[kind])} />
          {KIND_LABEL[kind]}
        </li>
      ))}
    </ul>
  );
}

/** Só para a página: primeiro dia do mês pedido na URL, ou o mês atual. */
export function resolveMonth(value: string | undefined, now: Date = new Date()): Date {
  const match = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (!match) return startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}
