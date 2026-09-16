# Prospecta

Plataforma de prospecção e captação de leads B2B: encontra empresas **reais** por
segmento e cidade no OpenStreetMap, lê o site oficial quando ele existe, calcula
um Lead Score de 0 a 100 e guarda tudo no banco para não repetir consultas.

Nenhuma API paga, nenhuma chave obrigatória e nenhum dado inventado: o que a
fonte não informa fica `null`.

Stack: Next.js 16 (App Router) · TypeScript · Prisma 7 · PostgreSQL (Supabase) ·
Tailwind CSS 4 · Zod · Lucide.

## Como rodar

1. Instale as dependências: `npm install`
2. Suba o banco local: `npm run db:local`
3. Aplique o schema: `npm run db:deploy`
4. Suba o projeto: `npm run dev` e abra http://localhost:3000

Copie `.env.example` para `.env` e ajuste o banco. As variáveis de leads já
têm padrões que funcionam sem conta em serviço nenhum.

### Banco

- **Local (recomendado para uso pessoal)**: `npm run db:local` sobe um Postgres
  na sua maquina - sem conta, sem Docker. O `.env` já vem apontado para ele.
  Deixe rodando enquanto usar a aplicação.
- **Supabase**: troque `DATABASE_URL` pela URL do *pooler* e `DIRECT_URL` pela
  conexão direta.

### Fonte de leads

`LEAD_PROVIDER="openstreetmap"` - a única fonte desta versão. Não existe Google
Places nem provider fictício no fluxo da aplicação.

```
segmento ("barbearia") -> etiquetas OSM (lib/leads/category-mapper.ts)
cidade/UF              -> área do município via Nominatim (cache em LocationCache)
Overpass API           -> estabelecimentos dentro da área (node, way e relation)
                       -> normalização -> deduplicação -> crawler do site oficial
                       -> Lead Score -> banco
```

- **Cache**: `Search.cacheKey` usa o nicho mapeado, então "barbearia",
  "Barbearias" e "barber shop" dividem o mesmo cache por `LEAD_CACHE_TTL_HOURS`.
  Cache vencido é devolvido na hora e atualizado em segundo plano.
- **Overpass**: consulta limitada por área, etiquetas, quantidade e timeout;
  429/502/503/504/timeout tentam o `OVERPASS_FALLBACK_URL`, até
  `OVERPASS_MAX_ATTEMPTS`.
- **Nominatim**: só a cidade é geocodificada (nunca cada empresa), no máximo uma
  chamada a cada `NOMINATIM_MIN_INTERVAL_MS`, com User-Agent identificável.
- **Crawler**: visita a home e até `WEBSITE_CRAWLER_MAX_PAGES - 1` páginas de
  contato/sobre, com concorrência limitada e proteção contra SSRF (só http/https,
  portas 80/443, IP verificado na conexão, redirects revalidados, limite de bytes).
- **"Sem site"**: ausência do dado no OSM vira `NOT_PROVIDED` ("Site não
  informado"), nunca "não tem site". WhatsApp só é "Confirmado" com link
  wa.me/api.whatsapp.com ou etiqueta explícita; celular sozinho é "Possível".

### API

```bash
curl -X POST http://localhost:3000/api/leads/search   -H "Content-Type: application/json"   -d '{"query":"barbearia","city":"Osasco","state":"SP","limit":50,"hasPhone":true,"websiteStatus":"not_checked","minScore":30}'
```

Filtros opcionais: `hasPhone`, `hasWhatsapp` (WhatsApp confirmado), `hasInstagram`,
`hasEmail`, `websiteStatus` (`found` | `not_found` | `not_checked`), `minScore`.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | TypeScript sem emitir arquivos |
| `npm run lint` | ESLint |
| `npm test` | Testes (runner nativo do Node, sem dependências) |
| `npm run db:local` | Sobe o Postgres local do Prisma |
| `npm run db:migrate` | Cria e aplica migration (desenvolvimento) |
| `npm run db:deploy` | Aplica migrations (produção) |
| `npm run db:studio` | Prisma Studio |

### IA

`AI_PROVIDER=none` (padrão) desliga a funcionalidade e o botão nem aparece.
`mock` devolve uma análise fictícia sem custo. `anthropic` usa a API da
Anthropic com `ANTHROPIC_API_KEY`; o modelo (`AI_MODEL`) e o nível de esforço
(`AI_EFFORT`, de `low` a `max`) são configuraveis - `low` e o padrão porque
analisar um lead e uma tarefa pequena.

## Funcionalidades

**Busca e base de leads**
- Busca por segmento, cidade e UF, com quantidade máxima e filtros de status do
  site, telefone, WhatsApp, Instagram, e-mail e score mínimo.
- Tabela com empresa, segmento, localização, telefone, WhatsApp, site,
  Instagram, e-mail, score, fonte, status e ações (copiar, abrir WhatsApp,
  Instagram, site e localização no OpenStreetMap).
- Origem de cada contato (OpenStreetMap ou site oficial) e etiquetas originais
  (`rawData`) guardadas no lead.
- Lead Score de 0 a 100 com os motivos gravados junto ao lead.
- Mapa dos leads (Leaflet + OpenStreetMap), com os mesmos filtros da tabela.
- CRM: novo, qualificado, contatado, respondeu, interessado, proposta enviada,
  cliente, descartado e inválido; favoritos e histórico de atividades.

**Trabalho com os leads**
- Listas de prospecção para agrupar leads por campanha ou região.
- "Ler site oficial" sob demanda: procura e-mail, telefone, WhatsApp e redes no
  próprio site.
- Análise de site: HTTPS, viewport, title, meta description, favicon,
  formulário, telefone, WhatsApp, Google Analytics e Meta Pixel.
- Exportação CSV respeitando os filtros da tela.

**IA (opcional, desligada por padrão)**
- "Analisar oportunidade" gera problemas, oportunidades, serviços e abordagem
  comercial a partir de um JSON compacto do lead. Nunca cria dados do lead.
- Cada análise guarda o hash da entrada: repetir sem mudança não gasta token.

## Organizacao

```
app/(dashboard)     paginas do painel (Server Components)
app/api             route handlers (busca de leads e exportacao CSV)
components/ui       primitivos visuais reaproveitaveis
components/layout   navegacao
features/           UI por dominio (leads, busca, listas, mapa)
lib/                normalizacao, http, erros, logger, validacao, configuracao
lib/leads/          busca de leads: fontes, category mapper, crawler, dedupe, score
tests/              testes (node --test)
server/             config, banco, repositorios, providers, ai, services, actions
types/              contratos compartilhados
prisma/             schema e migrations
```

Regras de arquitetura:

- Componentes React nunca falam com Prisma nem com providers - passam por
  `server/repositories` e `server/services`.
- Toda entrada vinda do navegador e validada com Zod (`lib/validation.ts`).
- Nenhuma chave de API chega ao cliente: segredos só existem em `server/`.

## Consultas externas

```
filtros -> cache de pesquisa (TTL) -> Nominatim (cache) -> Overpass -> normaliza
        -> deduplica -> lê sites -> score -> persiste -> exibe
```

- Deduplicação por id OSM, telefone, domínio, nome + endereço e nome +
  coordenadas próximas; telefone e domínio só contam entre pontos próximos,
  para não juntar unidades diferentes de uma rede.
- Site lido há menos de `ENRICHMENT_TTL_HOURS` não é baixado de novo.
- `ApiUsage` registra cada busca; o dashboard mostra quanto veio do cache.
- Leads antigos gerados pelo provider fictício ("mock") nunca aparecem.
