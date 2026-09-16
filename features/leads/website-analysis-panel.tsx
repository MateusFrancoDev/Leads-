import { Check, Minus, X } from "lucide-react";
import { Panel } from "@/components/ui/feedback";
import type { StoredWebsiteAnalysis } from "@/server/repositories/lead-repository";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

/** Cada item traz ícone + texto: o estado nunca depende só da cor. */
function CheckItem({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) {
    return (
      <li className="flex items-center gap-2 text-ink-subtle">
        <Minus className="size-3.5 shrink-0" aria-hidden />
        <span>{label}</span>
        <span className="sr-only">não verificado</span>
      </li>
    );
  }
  return (
    <li className={value ? "flex items-center gap-2 text-ink-muted" : "flex items-center gap-2 text-negative"}>
      {value ? (
        <Check className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <X className="size-3.5 shrink-0" aria-hidden />
      )}
      <span>{label}</span>
      <span className="sr-only">{value ? "presente" : "ausente"}</span>
    </li>
  );
}

export function WebsiteAnalysisPanel({ analysis }: { analysis: StoredWebsiteAnalysis }) {
  return (
    <Panel className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-ink-subtle">
          Analisado em {dateFormatter.format(analysis.checkedAt)}
          {analysis.httpStatus ? ` · HTTP ${analysis.httpStatus}` : ""}
          {analysis.responseTimeMs ? ` · ${analysis.responseTimeMs} ms` : ""}
        </p>
      </div>

      {analysis.title ? (
        <div>
          <p className="text-sm text-ink">{analysis.title}</p>
          {analysis.description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{analysis.description}</p>
          ) : null}
        </div>
      ) : null}

      <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
        <CheckItem label="HTTPS" value={analysis.hasHttps} />
        <CheckItem label="Adaptado ao celular (viewport)" value={analysis.hasViewport} />
        <CheckItem label="Title" value={analysis.hasTitle} />
        <CheckItem label="Meta description" value={analysis.hasDescription} />
        <CheckItem label="Favicon" value={analysis.hasFavicon} />
        <CheckItem label="Formulário de contato" value={analysis.hasContactForm} />
        <CheckItem label="Telefone clicável" value={analysis.hasPhone} />
        <CheckItem label="Botão de WhatsApp" value={analysis.hasWhatsapp} />
        <CheckItem label="Google Analytics" value={analysis.hasAnalytics} />
        <CheckItem label="Meta Pixel" value={analysis.hasMetaPixel} />
      </ul>

      {analysis.issues.length > 0 ? (
        <div className="border-t border-line pt-3">
          <p className="text-xs font-medium text-ink">
            Oportunidades de melhoria ({analysis.issues.length})
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-ink-muted">
            {analysis.issues.map((issue) => (
              <li key={issue} className="flex gap-2">
                <span aria-hidden className="text-ink-subtle">
                  ·
                </span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
