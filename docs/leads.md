# Módulo de Leads (captação automática)

Encontra empresas **reais** por segmento e cidade no OpenStreetMap e nos Dados
Abertos do CNPJ, lê o site oficial quando ele existe, calcula um Lead Score de 0 a
100 e guarda tudo no banco para não repetir consultas.

Nenhuma API paga, nenhuma chave obrigatória e nenhum dado inventado: o que a
fonte não informa fica `null`.

> **Este módulo está desligado.** Ele continua inteiro no código e volta a
> funcionar trocando uma linha no `.env`:
>
> ```
> LEADS_MODULE_ENABLED="true"
> ```
>
> Com `"false"` (o padrão), o menu mostra apenas "Leads — Em breve" e as rotas
> `/leads/*` exibem uma tela explicando que o módulo ainda não foi liberado.
> Nenhuma consulta é feita ao banco nem às fontes externas.

## Telas

| Rota | O que é |
| --- | --- |
| `/leads/painel` | Visão geral: totais, oportunidades e buscas recentes |
| `/leads/buscar` | Busca por segmento, cidade e UF |
| `/leads` | Tabela de todos os leads, com filtros |
| `/leads/[id]` | Ficha do lead |
| `/leads/mapa` | Mapa dos leads (Leaflet + OpenStreetMap) |
| `/leads/listas` | Listas de prospecção |
| `/leads/favoritos` | Leads marcados |
| `/leads/historico` | Buscas já feitas |
| `/leads/configuracoes` | Estado das fontes, do crawler e da IA |

## Como a busca funciona

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
- **Deduplicação**: por id OSM, telefone, domínio, nome + endereço e nome +
  coordenadas próximas; telefone e domínio só contam entre pontos próximos, para
  não juntar unidades diferentes de uma rede.

## Dados Abertos do CNPJ

```bash
npm run cnpj:import -- --uf SP --cidades "Osasco, Barueri"
```

Importa empresas **ativas** das cidades escolhidas para `CnpjEstablishment`. Os
arquivos (~7 GB por mês) ficam em `CNPJ_DATA_DIR` e são reaproveitados: importar
outra cidade no mesmo mês não baixa nada de novo.

## API

```bash
curl -X POST http://localhost:3000/api/leads/search \
  -H "Content-Type: application/json" \
  -d '{"query":"barbearia","city":"Osasco","state":"SP","limit":50,"hasPhone":true,"minScore":30}'
```

Filtros opcionais: `hasPhone`, `hasWhatsapp` (WhatsApp confirmado),
`hasInstagram`, `hasEmail`, `websiteStatus`, `minScore`.

## IA (opcional, desligada por padrão)

`AI_PROVIDER=none` desliga a funcionalidade e o botão nem aparece. `mock` devolve
uma análise fictícia sem custo. `gemini` usa a API do Google com `GEMINI_API_KEY`;
`anthropic` usa a API da Anthropic com `ANTHROPIC_API_KEY`.

"Analisar oportunidade" gera problemas, oportunidades, serviços e abordagem
comercial a partir de um JSON compacto do lead — nunca cria dados do lead. Cada
análise guarda o hash da entrada: repetir sem mudança não gasta token.
