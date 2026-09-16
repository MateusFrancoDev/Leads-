import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { describeConfig } from "@/server/config";
import { listImportedCnpjCities } from "@/server/repositories/cnpj-repository";
import { leadSourceLabel } from "@/types/lead";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Configurações" };

/**
 * Configuração em modo leitura. Tudo aqui vem do .env - a página existe para
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

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

async function loadImportedCities() {
  try {
    return await listImportedCnpjCities();
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const config = describeConfig();
  const importedCities = await loadImportedCities();

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Tudo e definido no arquivo .env na raiz do projeto. Reinicie o servidor depois de alterar."
      />

      <Section title="Banco de dados" description="PostgreSQL via Prisma.">
        <Row
          label="Conexão"
          value={
            <StatusBadge
              ok={config.database.configured}
              okLabel="Configurada"
              offLabel="DATABASE_URL vazia"
            />
          }
          hint="DATABASE_URL (aplicação) e DIRECT_URL (migrations)"
        />
        <Row
          label="Conexões simultâneas"
          value={config.database.poolMax}
          hint="DB_POOL_MAX - poolers derrubam conexões acima do limite"
        />
      </Section>

      <Section
        title="Fontes de leads"
        description="Empresas reais do OpenStreetMap e da Receita Federal. Gratuito, sem chave de API e sem cartão."
      >
        <Row
          label="Fontes ativas"
          value={config.leads.sources.map((source) => leadSourceLabel(source)).join(", ") || "Nenhuma"}
          hint="OPENSTREETMAP_ENABLED e CNPJ_ENABLED"
        />
        <Row
          label="Situação"
          value={
            <StatusBadge
              ok={config.leads.configured}
              okLabel="Pronto para buscar"
              offLabel="Todas as fontes desligadas"
            />
          }
        />
        <Row
          label="Overpass API"
          value={
            <span className="flex flex-col items-end gap-0.5 break-all text-xs">
              {config.leads.overpassEndpoints.map((url, index) => (
                <span key={url}>
                  {index === 0 ? "principal: " : "fallback: "}
                  {url}
                </span>
              ))}
            </span>
          }
          hint="OVERPASS_API_URL e OVERPASS_FALLBACK_URL"
        />
        <Row
          label="Timeout e tentativas do Overpass"
          value={`${config.leads.overpassTimeoutMs} ms · ${config.leads.overpassMaxAttempts}x`}
          hint="OVERPASS_TIMEOUT_MS e OVERPASS_MAX_ATTEMPTS"
        />
        <Row
          label="Nominatim"
          value={<span className="break-all text-xs">{config.leads.nominatimUrl}</span>}
          hint={`NOMINATIM_API_URL - no máximo 1 consulta a cada ${config.leads.nominatimMinIntervalMs} ms`}
        />
        <Row
          label="Máximo pedido à fonte por pesquisa"
          value={config.leads.maxResultsPerSearch}
          hint="MAX_RESULTS_PER_SEARCH"
        />
      </Section>

      <Section
        title="Receita Federal (Dados Abertos do CNPJ)"
        description="Empresas ativas das cidades importadas, com CNAE, endereço e contato declarado. Atualize uma vez por mês."
      >
        <Row
          label="Situação"
          value={<StatusBadge ok={config.leads.cnpjEnabled} okLabel="Ligada" offLabel="Desligada" />}
          hint="CNPJ_ENABLED"
        />
        <Row
          label="Arquivos baixados em"
          value={<span className="break-all font-mono text-xs">{config.leads.cnpjDataDir}</span>}
          hint="CNPJ_DATA_DIR - cerca de 7 GB por mês"
        />
        <Row
          label="Cidades importadas"
          value={
            importedCities === null ? (
              <Badge tone="warning">Não foi possível ler</Badge>
            ) : importedCities.length === 0 ? (
              <Badge tone="warning">Nenhuma</Badge>
            ) : (
              <span className="flex flex-col items-end gap-0.5 text-xs">
                {importedCities.map((city) => (
                  <span key={`${city.state}|${city.cityName}`}>
                    {city.cityName}/{city.state} · {city.rows.toLocaleString("pt-BR")} empresas · base{" "}
                    {city.datasetMonth} · {dateFormatter.format(city.importedAt)}
                  </span>
                ))}
              </span>
            )
          }
          hint='npm run cnpj:import -- --uf SP --cidades "Osasco, Barueri"'
        />
      </Section>

      <Section
        title="Leitura de sites oficiais"
        description="Completa e-mail, telefone, WhatsApp e redes a partir do site da própria empresa."
      >
        <Row
          label="Situação"
          value={<StatusBadge ok={config.crawler.enabled} okLabel="Ligada" offLabel="Desligada" />}
          hint="WEBSITE_CRAWLER_ENABLED"
        />
        <Row label="Páginas por site" value={config.crawler.maxPages} hint="WEBSITE_CRAWLER_MAX_PAGES" />
        <Row
          label="Sites lidos ao mesmo tempo"
          value={config.crawler.concurrency}
          hint="WEBSITE_CRAWLER_CONCURRENCY"
        />
        <Row
          label="Sites lidos por pesquisa"
          value={config.crawler.maxSitesPerSearch}
          hint="WEBSITE_CRAWLER_MAX_SITES_PER_SEARCH"
        />
        <Row
          label="Timeout por página"
          value={`${config.crawler.timeoutMs} ms`}
          hint="WEBSITE_CRAWLER_TIMEOUT_MS"
        />
        <Row
          label="Tamanho máximo por página"
          value={`${Math.round(config.crawler.maxResponseBytes / 1000)} KB`}
          hint="WEBSITE_CRAWLER_MAX_RESPONSE_BYTES"
        />
      </Section>

      <Section
        title="Inteligência artificial"
        description="Análise de oportunidade sob demanda. Desligada não aparece na tela do lead."
      >
        <Row label="Provider" value={config.ai.provider} hint="AI_PROVIDER" />
        <Row
          label="Situação"
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
          label="Nível de esforço"
          value={config.ai.effort}
          hint="AI_EFFORT - menor gasta menos tokens"
        />
      </Section>

      <Section
        title="Limites e cache"
        description="Os números que evitam abuso dos serviços públicos. Todos vem do .env."
      >
        <Row
          label="Validade do cache de pesquisas"
          value={`${config.limits.searchCacheHours} h`}
          hint="LEAD_CACHE_TTL_HOURS - pesquisa equivalente dentro do prazo é respondida pelo banco"
        />
        <Row
          label="Releitura do site oficial"
          value={`${config.limits.enrichmentTtlHours} h`}
          hint="ENRICHMENT_TTL_HOURS - site lido há menos tempo não é baixado de novo"
        />
        <Row
          label="Reanálise de site"
          value={`${config.limits.websiteAnalysisTtlHours} h`}
          hint="WEBSITE_ANALYSIS_TTL_HOURS"
        />
        <Row
          label="Gravações simultâneas no banco"
          value={config.limits.concurrency}
          hint="EXTERNAL_CONCURRENCY"
        />
        <Row
          label="Timeout do Nominatim"
          value={`${config.limits.timeoutMs} ms`}
          hint="EXTERNAL_TIMEOUT_MS"
        />
        <Row
          label="Máximo de linhas por exportação"
          value={config.limits.maxExportRows}
          hint="MAX_EXPORT_ROWS"
        />
      </Section>
    </>
  );
}
