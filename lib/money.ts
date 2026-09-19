/**
 * Dinheiro no sistema é sempre CENTAVOS (inteiro). Float erra centavo em soma
 * e o tipo Decimal do Prisma puxaria decimal.js junto - inteiro resolve os dois.
 * Este módulo é a única fronteira entre "1.500,00" digitado e 150000 gravado.
 */

/** Formata centavos como moeda brasileira: 150000 -> "R$ 1.500,00". */
export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Versão curta para gráficos e cartões: 150000 -> "R$ 1,5 mil". */
export function formatMoneyShort(cents: number): string {
  const value = cents / 100;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return formatMoney(cents);
}

/** Valor para preencher <input type="number">: 150000 -> "1500.00". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Converte o que o usuário digitou em centavos. Aceita "1500", "1500,50",
 * "1.500,50" e "1500.50"; devolve null quando não é número.
 */
export function parseMoneyToCents(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim().replace(/^R\$\s*/i, "");
  if (raw === "") return null;

  // "1.500,50" (pt-BR) tem vírgula depois do último ponto; "1500.50" não tem vírgula.
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Margem de lucro em %, arredondada. Receita zero não tem margem definida. */
export function profitMargin(revenueCents: number, costCents: number): number | null {
  if (revenueCents <= 0) return null;
  return Math.round(((revenueCents - costCents) / revenueCents) * 100);
}

/** Percentual formatado ("32%"), ou travessão quando não há base de cálculo. */
export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}
