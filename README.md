# Prospecta

Plataforma de prospeccao e captacao de leads B2B: encontra empresas por nicho e
regiao, classifica quem tem ou nao tem site, calcula um Lead Score de 0 a 100 e
guarda tudo no banco para nao repetir chamadas de API.

Stack: Next.js 16 (App Router) · TypeScript · Prisma 7 · PostgreSQL (Supabase) ·
Tailwind CSS 4 · Zod · Lucide.

## Como rodar

1. Instale as dependencias: `npm install`
2. Suba o banco local: `npm run db:local`
3. Aplique o schema: `npm run db:deploy`
4. Suba o projeto: `npm run dev` e abra http://localhost:3000

O `.env` ja vem preenchido para uso local com dados ficticios
(`LEAD_PROVIDER=mock`). Para dados reais e IA, veja `.env.example`.

### Banco

- **Local (recomendado para uso pessoal)**: `npm run db:local` sobe um Postgres
  na sua maquina - sem conta, sem Docker. O `.env` ja vem apontado para ele.
  Deixe rodando enquanto usar a aplicacao.
- **Supabase**: troque `DATABASE_URL` pela URL do *pooler* e `DIRECT_URL` pela
  conexao direta.

### Fonte de leads

Tres fontes, trocadas so pela variavel `LEAD_PROVIDER`:

| Valor | Custo | Nota/avaliacoes | Observacao |
| --- | --- | --- | --- |
| `mock` | zero | ficticias | dados inventados, para desenvolver a interface |
| `openstreetmap` | **zero, sem chave e sem cartao** | **nao existem** | cobertura menor; exige informar a cidade |
| `google_places` | por requisicao | sim | precisa de `GOOGLE_PLACES_API_KEY` e billing ativo |

No OpenStreetMap os filtros de nota e de numero de avaliacoes ficam sem efeito -
a fonte nao tem esse dado. O sinal de "sem site", que e o mais valioso, funciona.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de producao |
| `npm run typecheck` | TypeScript sem emitir arquivos |
| `npm run lint` | ESLint |
| `npm run db:local` | Sobe o Postgres local do Prisma |
| `npm run db:migrate` | Cria e aplica migration (desenvolvimento) |
| `npm run db:deploy` | Aplica migrations (producao) |
| `npm run db:studio` | Prisma Studio |

### IA

`AI_PROVIDER=none` (padrao) desliga a funcionalidade e o botao nem aparece.
`mock` devolve uma analise ficticia sem custo. `anthropic` usa a API da
Anthropic com `ANTHROPIC_API_KEY`; o modelo (`AI_MODEL`) e o nivel de esforco
(`AI_EFFORT`, de `low` a `max`) sao configuraveis - `low` e o padrao porque
analisar um lead e uma tarefa pequena.

## Funcionalidades

**Busca e base de leads**
- Busca por nicho, palavra-chave, cidade, estado, bairro e raio.
- Filtros de qualificacao: com/sem site, telefone, WhatsApp, Instagram, e-mail,
  nota minima, faixa de avaliacoes, score minimo e status.
- Lead Score de 0 a 100 com os motivos gravados junto ao lead.
- Mapa dos leads (Leaflet + OpenStreetMap): sem chave de API e sem cobranca,
  com os mesmos filtros da tabela e cor por faixa de score.
- CRM basico: status do lead, favoritos e historico de atividades.

**Trabalho com os leads**
- Listas de prospeccao para agrupar leads por campanha ou regiao.
- Enriquecimento sob demanda: procura e-mail e redes sociais, primeiro no
  proprio site (gratuito) e so depois no provider (pago).
- Analise de site: HTTPS, viewport, title, meta description, favicon,
  formulario, telefone, WhatsApp, Google Analytics e Meta Pixel; site fora do
  ar vira oportunidade e o score e recalculado.
- Exportacao CSV respeitando os filtros da tela.
- Anotacoes por lead e historico de atividades.

**IA (opcional, desligada por padrao)**
- "Analisar oportunidade" gera, sob demanda: problemas encontrados,
  oportunidades, servicos que podemos oferecer e uma abordagem comercial.
- A entrada enviada ao modelo e um JSON compacto do lead mais os problemas ja
  extraidos do site - nunca o HTML da pagina.
- A resposta e estruturada e validada por schema, nao texto livre.
- Cada analise guarda o hash da entrada: repetir a acao sem nenhuma mudanca
  nos dados nao gasta um unico token.

## Organizacao

```
app/(dashboard)     paginas do painel (Server Components)
app/api             route handlers (exportacao CSV)
components/ui       primitivos visuais reaproveitaveis
components/layout   navegacao
features/           UI por dominio (leads, busca, listas, mapa)
lib/                normalizacao, http, erros, logger, validacao, configuracao
server/             config, banco, repositorios, providers, ai, services, actions
types/              contratos compartilhados
prisma/             schema e migrations
```

Regras de arquitetura:

- Componentes React nunca falam com Prisma nem com providers - passam por
  `server/repositories` e `server/services`.
- Toda entrada vinda do navegador e validada com Zod (`lib/validation.ts`).
- Nenhuma chave de API chega ao cliente: segredos so existem em `server/`.

## Economia de API

O fluxo de busca sempre verifica o banco antes de gastar requisicao:

```
filtros -> normaliza -> cache de pesquisa (TTL) -> provider -> normaliza
        -> deduplica -> persiste -> score -> exibe
```

- `Search.cacheKey` guarda cada pesquisa; dentro do TTL (`SEARCH_CACHE_TTL_HOURS`,
  padrao 24h) a mesma consulta e respondida pelo banco.
- Leads sao deduplicados por `provider + externalId` e por `dedupeKey`
  (nome + telefone + cidade normalizados).
- Detalhes e enriquecimento so rodam sob demanda, nunca em massa.
- Chamadas externas tem timeout, retry so para erro transitorio e limite de
  concorrencia (`EXTERNAL_*`).
- `ApiUsage` registra provider, operacao e numero de requisicoes para acompanhar
  o custo; o dashboard mostra quanto do total foi respondido pelo cache.
- Enriquecimento e analise de site respeitam os proprios TTLs: repetir a acao
  logo em seguida nao baixa nem consulta nada de novo.
- A analise de IA e cacheada por hash da entrada (inclui provider e modelo), e
  o custo estimado de cada chamada fica em `ApiUsage` e no dashboard.
- `DB_POOL_MAX` limita as conexoes simultaneas ao banco: poolers derrubam
  conexoes quando uma unica pagina abre consultas demais em paralelo.
