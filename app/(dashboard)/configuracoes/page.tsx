import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { describeConfig } from "@/server/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Configuracoes" };

/**
 * Configuracao em modo leitura. Tudo aqui vem do .env - a pagina existe para
 * conferir o que esta ligado e quanto custa, nunca para expor chave nenhuma.
 */

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line px-4 py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <div>
        <dt className="text-sm text-ink">{label}</dt>
        {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
      </div>
      <dd className="text-sm tabular-nums text-ink-muted">{value}</dd>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        <p className="text-xs text-ink-muted">{description}</p>
      </div>
      <Panel className="overflow-hidden">
        <dl>{children}</dl>
      </Panel>
    </section>
  );
}

function StatusBadge({ ok, okLabel, offLabel }: { ok: boolean; okLabel: string; offLabel: string }) {
  return <Badge tone={ok ? "positive" : "warning"}>{ok ? okLabel : offLabel}</Badge>;
}

export default function SettingsPage() {
  const config = describeConfig();

  return (
    <>
      <PageHeader
        title="Configuracoes"
        description="Tudo e definido no arquivo .env na raiz do projeto. Reinicie o servidor depois de alterar."
      />

      <Section title="Banco de dados" description="PostgreSQL via Prisma.">
        <Row
          label="Conexao"
          value={
            <StatusBadge
              ok={config.database.configured}
              okLabel="Configurada"
              offLabel="DATABASE_URL vazia"
            />
          }
          hint="DATABASE_URL (aplicacao) e DIRECT_URL (migrations)"
        />
        <Row
          label="Conexoes simultaneas"
          value={config.database.poolMax}
          hint="DB_POOL_MAX - poolers derrubam conexoes acima do limite"
        />
      </Section>

      <Section
        title="Fonte de leads"
        description="De onde vem as empresas. Trocar o provider nao muda mais nada na aplicacao."
      >
        <Row
          label="Provider ativo"
          value={config.leads.provider}
          hint="LEAD_PROVIDER - google_places (pago), openstreetmap (gratuito) ou mock"
        />
        <Row
          label="Situacao"
          value={
            <StatusBadge
              ok={config.leads.configured}
              okLabel="Pronto para buscar"
              offLabel="Falta GOOGLE_PLACES_API_KEY"
            />
          }
        />
        <Row
          label="Maximo de leads por pesquisa"
          value={config.leads.maxResultsPerSearch}
          hint="MAX_RESULTS_PER_SEARCH"
        />
      </Section>

      <Section
        title="Inteligencia artificial"
        description="Analise de oportunidade sob demanda. Desligada nao aparece na tela do lead."
      >
        <Row label="Provider" value={config.ai.provider} hint="AI_PROVIDER" />
        <Row
          label="Situacao"
          value={
            config.ai.provider === "none" ? (
              <Badge>Desligada</Badge>
            ) : (
              <StatusBadge
                ok={config.ai.configured}
                okLabel="Pronta para analisar"
                offLabel="Falta ANTHROPIC_API_KEY"
              />
            )
          }
        />
        <Row label="Modelo" value={config.ai.model} hint="AI_MODEL" />
        <Row
          label="Nivel de esforco"
          value={config.ai.effort}
          hint="AI_EFFORT - menor gasta menos tokens"
        />
      </Section>

      <Section
        title="Limites e cache"
        description="Os numeros que seguram o custo. Todos vem do .env."
      >
        <Row
          label="Validade do cache de pesquisas"
          value={`${config.limits.searchCacheHours} h`}
          hint="SEARCH_CACHE_TTL_HOURS - repetir a busca dentro do prazo nao chama a API"
        />
        <Row
          label="Reenriquecimento"
          value={`${config.limits.enrichmentTtlHours} h`}
          hint="ENRICHMENT_TTL_HOURS"
        />
        <Row
          label="Reanalise de site"
          value={`${config.limits.websiteAnalysisTtlHours} h`}
          hint="WEBSITE_ANALYSIS_TTL_HOURS"
        />
        <Row
          label="Requisicoes externas simultaneas"
          value={config.limits.concurrency}
          hint="EXTERNAL_CONCURRENCY"
        />
        <Row
          label="Timeout de chamadas externas"
          value={`${config.limits.timeoutMs} ms`}
          hint="EXTERNAL_TIMEOUT_MS"
        />
        <Row
          label="Maximo de linhas por exportacao"
          value={config.limits.maxExportRows}
          hint="MAX_EXPORT_ROWS"
        />
      </Section>
    </>
  );
}
