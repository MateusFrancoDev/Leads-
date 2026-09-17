/**
 * Formatação de tempo para a interface. Usa o Intl do próprio runtime - não há
 * por que trazer uma biblioteca de datas para escrever "há 3 dias".
 */

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const UNITS: { limitMs: number; divisorMs: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limitMs: 60_000, divisorMs: 1_000, unit: "second" },
  { limitMs: 3_600_000, divisorMs: 60_000, unit: "minute" },
  { limitMs: 86_400_000, divisorMs: 3_600_000, unit: "hour" },
  { limitMs: 2_592_000_000, divisorMs: 86_400_000, unit: "day" },
  { limitMs: 31_536_000_000, divisorMs: 2_592_000_000, unit: "month" },
  { limitMs: Number.POSITIVE_INFINITY, divisorMs: 31_536_000_000, unit: "year" },
];

/**
 * "há 3 dias", "há 2 meses". `now` é injetável para o resultado ser testável.
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const elapsedMs = now.getTime() - date.getTime();
  const absMs = Math.abs(elapsedMs);

  if (absMs < 45_000) return "agora há pouco";

  const { divisorMs, unit } = UNITS.find((entry) => absMs < entry.limitMs) ?? UNITS[UNITS.length - 1];
  return relative.format(-Math.round(elapsedMs / divisorMs), unit);
}
