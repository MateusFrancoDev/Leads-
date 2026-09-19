"use client";

/**
 * Gráfico de colunas em SVG puro - uma ou duas séries agrupadas, ou uma série
 * divergente (lucro acima e prejuízo abaixo da linha do zero).
 *
 * É SVG escrito à mão em vez de biblioteca porque o que precisamos é pequeno e
 * fixo: eixo de tempo no rodapé, grade discreta, colunas finas com o topo
 * arredondado. Uma biblioteca de gráficos custaria mais em peso e configuração
 * do que estas cem linhas.
 *
 * O desenho usa coordenadas de viewBox e `preserveAspectRatio="none"` NÃO é
 * usado: as colunas escalam junto com o texto, então o gráfico continua legível
 * do celular ao monitor sem media query.
 */

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { ChartFrame, ChartTable, type SeriesMeta } from "@/components/charts/chart-frame";

/**
 * Como os valores são escritos. É um nome, e não uma função de formatação:
 * Server Component não consegue passar função para Client Component, e a
 * formatação é a mesma em todos os gráficos.
 */
export type ValueFormat = "money" | "number";

function formatValue(value: number, format: ValueFormat, compact = true): string {
  if (format === "number") return value.toLocaleString("pt-BR");
  return compact ? formatMoneyShort(value) : formatMoney(value);
}

export interface ColumnPoint {
  label: string;
  /** Valor da série principal. Pode ser negativo no modo divergente. */
  value: number;
  /** Série secundária (ex.: custos ao lado da receita). */
  secondary?: number;
}

/** Área de desenho em unidades de viewBox. */
const WIDTH = 720;
const HEIGHT = 200;
const PADDING = { top: 12, right: 8, bottom: 26, left: 8 };
const MAX_BAR_WIDTH = 24;
const GAP = 2;

export function ColumnChart({
  title,
  description,
  points,
  primaryLabel,
  secondaryLabel,
  format,
  /** Colore pelo sinal do valor em vez de pela série. Para lucro/prejuízo. */
  diverging = false,
  className,
}: {
  title: string;
  description?: string;
  points: ReadonlyArray<ColumnPoint>;
  primaryLabel: string;
  secondaryLabel?: string;
  format: ValueFormat;
  diverging?: boolean;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const hasSecondary = secondaryLabel !== undefined;
  const values = points.flatMap((point) =>
    hasSecondary ? [point.value, point.secondary ?? 0] : [point.value],
  );
  const maxValue = Math.max(0, ...values);
  const minValue = Math.min(0, ...values);
  const isEmpty = points.length === 0 || values.every((value) => value === 0);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const slot = points.length > 0 ? plotWidth / points.length : plotWidth;

  // Escala: com valores negativos o zero fica no meio proporcional.
  const span = maxValue - minValue || 1;
  const yOf = (value: number) => PADDING.top + ((maxValue - value) / span) * plotHeight;
  const zeroY = yOf(0);

  const barCount = hasSecondary ? 2 : 1;
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(4, (slot - GAP * 2) / barCount - GAP));

  const series: SeriesMeta[] = hasSecondary
    ? [
        { label: primaryLabel, color: "var(--chart-1)" },
        { label: secondaryLabel, color: "var(--chart-2)" },
      ]
    : [{ label: primaryLabel, color: "var(--chart-1)" }];

  const tableColumns = hasSecondary
    ? ["Mês", primaryLabel, secondaryLabel]
    : ["Mês", primaryLabel];

  return (
    <ChartFrame
      title={title}
      description={description}
      series={series}
      isEmpty={isEmpty}
      table={
        <ChartTable
          columns={tableColumns}
          rows={points.map((point) =>
            hasSecondary
              ? [
                  point.label,
                  formatValue(point.value, format, false),
                  formatValue(point.secondary ?? 0, format, false),
                ]
              : [point.label, formatValue(point.value, format, false)],
          )}
        />
      }
      className={className}
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-44 w-full"
          role="img"
          aria-label={`${title}. Os valores exatos estão na tabela abaixo do gráfico.`}
        >
          {/* Grade: três linhas discretas, sempre sólidas. */}
          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = PADDING.top + plotHeight * ratio;
            return (
              <line
                key={ratio}
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
            );
          })}

          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={zeroY}
            y2={zeroY}
            stroke="var(--chart-baseline)"
            strokeWidth={1}
          />

          {points.map((point, index) => {
            const slotStart = PADDING.left + slot * index;
            const groupWidth = barWidth * barCount + GAP * (barCount - 1);
            const groupStart = slotStart + (slot - groupWidth) / 2;
            const isHovered = hovered === index;

            return (
              <g key={point.label}>
                {/* Alvo de mouse do tamanho da faixa inteira: acertar uma coluna
                    fina de 8px seria frustrante. */}
                <rect
                  x={slotStart}
                  y={PADDING.top}
                  width={slot}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                />
                {isHovered ? (
                  <rect
                    x={slotStart}
                    y={PADDING.top}
                    width={slot}
                    height={plotHeight}
                    fill="var(--chart-grid)"
                    opacity={0.5}
                    pointerEvents="none"
                  />
                ) : null}

                <Column
                  x={groupStart}
                  width={barWidth}
                  value={point.value}
                  yOf={yOf}
                  zeroY={zeroY}
                  color={
                    diverging
                      ? point.value < 0
                        ? "var(--chart-negative)"
                        : "var(--chart-positive)"
                      : "var(--chart-1)"
                  }
                />

                {hasSecondary ? (
                  <Column
                    x={groupStart + barWidth + GAP}
                    width={barWidth}
                    value={point.secondary ?? 0}
                    yOf={yOf}
                    zeroY={zeroY}
                    color="var(--chart-2)"
                  />
                ) : null}

                <text
                  x={slotStart + slot / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-ink-subtle text-[11px]"
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered !== null && points[hovered] ? (
          <Tooltip
            index={hovered}
            total={points.length}
            point={points[hovered]}
            primaryLabel={primaryLabel}
            secondaryLabel={secondaryLabel}
            format={format}
          />
        ) : null}
      </div>
    </ChartFrame>
  );
}

/** Uma coluna. Topo arredondado, base reta - o valor cresce a partir do zero. */
function Column({
  x,
  width,
  value,
  yOf,
  zeroY,
  color,
}: {
  x: number;
  width: number;
  value: number;
  yOf: (value: number) => number;
  zeroY: number;
  color: string;
}) {
  if (value === 0) return null;

  const y = yOf(value);
  const height = Math.abs(zeroY - y);
  if (height < 0.5) return null;

  const radius = Math.min(4, width / 2, height);
  const top = Math.min(y, zeroY);
  const isNegative = value < 0;

  // Path à mão: só o lado que fica longe da linha de base é arredondado.
  const path = isNegative
    ? `M ${x} ${zeroY} H ${x + width} V ${top + height - radius} a ${radius} ${radius} 0 0 1 -${radius} ${radius} H ${x + radius} a ${radius} ${radius} 0 0 1 -${radius} -${radius} Z`
    : `M ${x} ${zeroY} V ${top + radius} a ${radius} ${radius} 0 0 1 ${radius} -${radius} H ${x + width - radius} a ${radius} ${radius} 0 0 1 ${radius} ${radius} V ${zeroY} Z`;

  return <path d={path} fill={color} pointerEvents="none" />;
}

function Tooltip({
  index,
  total,
  point,
  primaryLabel,
  secondaryLabel,
  format,
}: {
  index: number;
  total: number;
  point: ColumnPoint;
  primaryLabel: string;
  secondaryLabel?: string;
  format: ValueFormat;
}) {
  // Perto das bordas o balão encosta no lado de dentro, para não sair da caixa.
  const ratio = (index + 0.5) / total;
  const alignEnd = ratio > 0.65;
  const alignStart = ratio < 0.35;

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-none absolute top-0 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm",
        alignStart && "left-0",
        alignEnd && "right-0",
        !alignStart && !alignEnd && "left-1/2 -translate-x-1/2",
      )}
    >
      <p className="font-medium text-ink">{point.label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-ink-muted">
        <span aria-hidden className="size-2 rounded-[2px]" style={{ backgroundColor: "var(--chart-1)" }} />
        {primaryLabel}
        <span className="font-medium text-ink tabular-nums">
          {formatValue(point.value, format, false)}
        </span>
      </p>
      {secondaryLabel ? (
        <p className="mt-0.5 flex items-center gap-1.5 text-ink-muted">
          <span aria-hidden className="size-2 rounded-[2px]" style={{ backgroundColor: "var(--chart-2)" }} />
          {secondaryLabel}
          <span className="font-medium text-ink tabular-nums">
            {formatValue(point.secondary ?? 0, format, false)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
