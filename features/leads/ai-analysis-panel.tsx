import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Panel } from "@/components/ui/feedback";
import type { StoredAiAnalysis } from "@/types/ai";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function List({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-ink">{title}</p>
      <ul className="mt-1.5 flex flex-col gap-1 text-sm text-ink-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-ink-subtle">
              ·
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AiAnalysisPanel({ analysis }: { analysis: StoredAiAnalysis }) {
  const tokens = analysis.inputTokens + analysis.outputTokens;

  return (
    <Panel className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-ink">{analysis.summary}</p>
        {analysis.isCurrent ? null : (
          <Badge tone="warning">Dados mudaram depois desta análise</Badge>
        )}
      </div>

      <List title="Problemas encontrados" items={analysis.problems} />
      <List title="Oportunidades" items={analysis.opportunities} />
      <List title="Serviços que podemos oferecer" items={analysis.services} />

      <div className="border-t border-line pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-ink">Abordagem comercial sugerida</p>
          <CopyButton value={analysis.approach} label="Copiar abordagem" />
        </div>
        <p className="mt-1.5 text-sm text-ink-muted">{analysis.approach}</p>
      </div>

      <p className="text-xs text-ink-subtle">
        {dateFormatter.format(analysis.createdAt)} · {analysis.model}
        {tokens > 0 ? ` · ${tokens} tokens` : ""}
        {analysis.costUsd !== null && analysis.costUsd > 0
          ? ` · ~US$ ${analysis.costUsd.toFixed(4)}`
          : ""}
      </p>
    </Panel>
  );
}
