/**
 * Datas e prazos. Tudo que a interface mostra sobre "faltam X dias" e
 * "atrasado há Y dias" sai daqui, para a mesma regra valer em toda tela.
 *
 * A contagem é feita em DIAS DE CALENDÁRIO, não em horas: um prazo para hoje
 * às 23h não pode aparecer como "faltam 0 dias" de manhã e "atrasado" à noite.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Meia-noite local da data informada. Base de toda comparação de prazo. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** Diferença em dias de calendário: negativo = `to` ficou no passado. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** "18/09/2026" */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "18/09" - para timeline e calendário, onde o ano é redundante. */
export function formatDayMonth(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** "18/09/2026 14:32" */
export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return `${formatDate(date)} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** "set/2026" - rótulo dos gráficos por mês. */
export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

/** Valor para <input type="date">, no fuso local (toISOString usaria UTC). */
export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Lê "2026-09-18" de um <input type="date"> como meia-noite LOCAL. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Situação de um prazo, já pronta para virar texto e cor na interface. */
export interface DeadlineInfo {
  /** Dias até o prazo. Negativo quando já passou. */
  daysLeft: number;
  isOverdue: boolean;
  isToday: boolean;
  /** "Faltam 12 dias", "Atrasado há 3 dias", "Vence hoje". */
  label: string;
  /** Quantos dias o trabalho já está em andamento (a partir de startDate). */
  daysRunning: number | null;
  /** Quanto do prazo total já foi consumido, de 0 a 100. */
  percentUsed: number | null;
}

export function describeDeadline(
  deadline: Date,
  startDate?: Date | null,
  now: Date = new Date(),
): DeadlineInfo {
  const daysLeft = daysBetween(now, deadline);
  const isOverdue = daysLeft < 0;
  const isToday = daysLeft === 0;

  const label = isToday
    ? "Vence hoje"
    : isOverdue
      ? `Atrasado há ${Math.abs(daysLeft)} ${plural(Math.abs(daysLeft), "dia", "dias")}`
      : `Faltam ${daysLeft} ${plural(daysLeft, "dia", "dias")}`;

  const daysRunning = startDate ? Math.max(0, daysBetween(startDate, now)) : null;

  // Só existe percentual quando há um começo: sem ele não há prazo total.
  let percentUsed: number | null = null;
  if (startDate) {
    const total = daysBetween(startDate, deadline);
    percentUsed = total <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((daysRunning ?? 0) / total) * 100)));
  }

  return { daysLeft, isOverdue, isToday, label, daysRunning, percentUsed };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** "há 3 dias", "há 2 horas", "agora" - usado na timeline e no histórico. */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} ${plural(hours, "hora", "horas")}`;
  const days = daysBetween(date, now);
  if (days < 30) return `há ${days} ${plural(days, "dia", "dias")}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${plural(months, "mês", "meses")}`;
  const years = Math.floor(days / 365);
  return `há ${years} ${plural(years, "ano", "anos")}`;
}

/** Os últimos N meses, do mais antigo ao mais recente. Base dos gráficos. */
export function lastMonths(count: number, now: Date = new Date()): Date[] {
  const current = startOfMonth(now);
  return Array.from({ length: count }, (_, index) => addMonths(current, index - (count - 1)));
}
