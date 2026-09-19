import { AlertTriangle, CalendarClock } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { describeDeadline, formatDate } from "@/lib/dates";
import type { EnumOption } from "@/lib/domain/enums";

/**
 * Etiquetas derivadas dos enums e dos prazos. Ficam juntas porque aparecem em
 * praticamente toda tela e precisam ser idênticas em todas elas: o mesmo
 * status não pode ser cinza na lista e azul na página do projeto.
 */

/** Etiqueta de um valor de enum, com o tom já definido em lib/domain/enums. */
export function EnumBadge<T extends string>({
  option,
  className,
}: {
  option: EnumOption<T>;
  className?: string;
}) {
  return (
    <Badge tone={option.tone} className={className}>
      {option.label}
    </Badge>
  );
}

/**
 * Prazo com a leitura pronta: "Faltam 12 dias" ou "Atrasado há 3 dias".
 * A cor reforça, mas o texto sozinho já diz tudo - ninguém precisa enxergar
 * a diferença entre vermelho e âmbar para entender.
 */
export function DeadlineBadge({
  deadline,
  startDate,
  className,
}: {
  deadline: Date | null;
  startDate?: Date | null;
  className?: string;
}) {
  if (!deadline) {
    return <span className={cn("text-xs text-ink-subtle", className)}>Sem prazo</span>;
  }

  const info = describeDeadline(deadline, startDate);
  const tone: Tone = info.isOverdue
    ? "negative"
    : info.daysLeft <= 3
      ? "warning"
      : "neutral";

  return (
    <Badge tone={tone} className={className} title={`Prazo: ${formatDate(deadline)}`}>
      {info.isOverdue ? (
        <AlertTriangle className="size-3" aria-hidden />
      ) : (
        <CalendarClock className="size-3" aria-hidden />
      )}
      {info.label}
    </Badge>
  );
}

/** Valor em destaque com rótulo pequeno acima. Usado nas fichas de detalhe. */
export function FieldValue({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-ink">{children}</dd>
    </div>
  );
}

/** Lista de pares rótulo/valor, em grade responsiva. */
export function FieldList({
  children,
  columns = 3,
  className,
}: {
  children: React.ReactNode;
  columns?: 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4",
        columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </dl>
  );
}
