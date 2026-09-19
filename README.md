# Lummit

Sistema interno da empresa: clientes, projetos, tarefas, financeiro, arquivos,
anotações, prazos, calendário e histórico de quem fez o quê — tudo em um lugar só.

É um sistema privado. Não existe cadastro público: os usuários são criados no
terminal e todas as páginas exigem login.

Stack: Next.js 16 (App Router) · TypeScript · Prisma 7 · PostgreSQL ·
Tailwind CSS 4 · Zod · Lucide. Sem biblioteca de gráficos, de drag-and-drop, de
modal ou de autenticação — tudo isso é feito com o que o navegador e o Node já têm.

## Como rodar

1. Instale as dependências: `npm install`
2. Copie `.env.example` para `.env` e ajuste o banco
3. Aplique o schema: `npm run db:deploy`
4. Crie o seu usuário: `npm run user:create`
5. Suba o projeto: `npm run dev` e abra http://localhost:3000

### Banco

- **Local**: `npm run db:local` sobe um Postgres na sua máquina — sem conta e sem
  Docker. Deixe rodando enquanto usar a aplicação.
- **Supabase**: `DATABASE_URL` recebe a URL do *pooler* e `DIRECT_URL` a conexão
  direta (as migrations usam a direta).

### Usuários

```bash
npm run user:create
```

Pergunta nome, e-mail, cargo e senha no terminal e grava só o hash no banco.
Nenhuma senha fica em código nem em arquivo de configuração. Cargos:
administrador, sócio e funcionário.

A senha aparece como asteriscos enquanto é digitada. Nome, e-mail e cargo também
podem vir por argumento; a senha continua sendo perguntada, para não entrar no
histórico do terminal:

```bash
npm run user:create -- --nome "Mateus Franco" --email mateus@empresa.com --cargo admin
```

## Como a autenticação funciona

- **Senha**: hash `scrypt` do `node:crypto`, com sal aleatório e os parâmetros de
  custo gravados junto — dá para endurecer o custo depois sem invalidar as senhas
  existentes (`server/auth/password.ts`).
- **Sessão**: guardada no banco. O navegador recebe um token aleatório de 32
  bytes em cookie `HttpOnly`; o banco guarda só o SHA-256 dele. Sair do sistema
  apaga a linha, então a sessão realmente termina — coisa que um JWT assinado não
  faria (`server/auth/session.ts`).
- **Proteção**: `proxy.ts` desvia quem não tem cookie para `/login`, mas ele é
  conforto de navegação, não segurança. A barreira de verdade é `requireUser()`,
  chamado em toda página e em todo Server Action, junto dos dados
  (`server/auth/dal.ts`).
- **Arquivos**: ficam em `storage/`, fora de `public/`. O download passa por
  `/api/arquivos/[id]`, que confere a sessão antes de devolver os bytes.

## Módulo de Leads

A captação automática de leads (OpenStreetMap, Dados Abertos do CNPJ,
enriquecimento de sites, análise por IA, listas de prospecção, mapa) continua
inteira no projeto, sob `/leads/*`. Ela fica desligada por padrão:

```
LEADS_MODULE_ENABLED="false"   # menu mostra "Em breve" e as rotas não abrem
LEADS_MODULE_ENABLED="true"    # módulo volta inteiro, sem alterar código
```

A documentação desse módulo está em [`docs/leads.md`](docs/leads.md).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | TypeScript sem emitir arquivos |
| `npm run lint` | ESLint |
| `npm test` | Testes (runner nativo do Node, sem dependências) |
| `npm run user:create` | Cria um usuário do sistema |
| `npm run db:local` | Sobe o Postgres local do Prisma |
| `npm run db:migrate` | Cria e aplica migration (desenvolvimento) |
| `npm run db:deploy` | Aplica migrations (produção) |
| `npm run db:studio` | Prisma Studio |
| `npm run cnpj:import` | Importa Dados Abertos do CNPJ (módulo de leads) |

## Funcionalidades

**Painel e rotina**
- Dashboard com clientes, projetos ativos, atrasados e concluídos, valor vendido,
  recebido, a receber, custos, lucro, margem, tarefas pendentes e pagamentos
  atrasados.
- Gráficos de faturamento por mês, receita x custos, lucro por mês, projetos
  concluídos por mês, projetos por tipo de serviço e rankings de cliente.
- Ações rápidas: novo cliente, novo projeto, nova tarefa, registrar pagamento e
  registrar despesa, sem sair da tela.
- Próximos prazos em 7, 15 e 30 dias.
- Página **Hoje**: só o que vence hoje ou nos próximos sete dias — tarefas suas e
  dos outros, pagamentos atrasados e a vencer, entregas próximas e compromissos.

**Clientes**
- Cadastro com contato, WhatsApp, Instagram, site, CPF/CNPJ, cidade e status
  (lead, em negociação, ativo, projeto concluído, inativo).
- Ficha do cliente com total faturado, recebido, a receber, custos, lucro, margem
  e quantidade de projetos, mais abas de projetos, anotações, arquivos e histórico.
- Depois de cadastrar, o caminho natural é "Criar primeiro projeto".

**Projetos**
- Três formas de ver a mesma lista: cards, tabela e Kanban com arrastar e soltar.
- Abas por projeto: visão geral, tarefas, financeiro, briefing, contrato,
  arquivos, anotações, timeline e edição.
- Prazo calculado sozinho: quantos dias faltam, há quantos dias está atrasado, há
  quantos dias está em andamento e quanto do prazo já foi usado.
- Progresso em atalhos (0/25/50/75/100%) ou valor livre; concluir crava 100%.

**Financeiro**
- Várias parcelas por projeto, com forma de pagamento, vencimento e recebimento.
- Custos por categoria (domínio, hospedagem, API, freelancer, licença...).
- Lucro e margem por projeto, por cliente, por mês e no geral.
- "Atrasado" nunca é gravado: é derivado do vencimento, então nenhum job precisa
  rodar para manter o banco correto.

**Tarefas**
- Kanban (a fazer, em andamento, em revisão, concluído) com arrastar e soltar, e
  um seletor de coluna em cada cartão que funciona no celular e no teclado.
- Responsável por tarefa e atalho "Minhas tarefas".

**Arquivos, anotações e histórico**
- Arquivos por projeto e por cliente, com categoria (briefing, contrato, design,
  logo, conteúdo, desenvolvimento, financeiro, entrega).
- Anotações com autor e data, da mais recente para a mais antiga.
- Timeline automática por projeto e histórico geral: toda ação vira uma linha com
  quem fez, o quê e quando.

**Calendário e busca**
- Calendário mensal com prazos de projeto, prazos de tarefa, vencimentos de
  parcela e compromissos criados à mão. Prazos são lidos direto da origem, então
  nunca ficam dessincronizados.
- Busca global por cliente, empresa, projeto, tarefa, telefone, WhatsApp e e-mail.

## Organização

```
app/(app)/          páginas autenticadas (Server Components)
app/(app)/leads/    módulo de captação de leads, ligado por variável de ambiente
app/login/          única página pública
app/api/            route handlers (download de arquivos, API de leads)
components/ui/      primitivos visuais reaproveitáveis
components/charts/  gráficos em SVG, escritos à mão
components/layout/  navegação, busca global e menu do usuário
features/           UI por domínio (clientes, projetos, tarefas, financeiro...)
lib/                dinheiro, datas, enums, erros, validação, configuração
lib/schemas/        schemas Zod de tudo que entra na aplicação
server/auth/        senha, sessão e camada de acesso autenticado
server/repositories/ acesso ao banco
server/services/    regras que não são só leitura (arquivos, histórico)
server/actions/     Server Actions
tests/              testes (node --test)
prisma/             schema e migrations
```

Regras de arquitetura:

- Componentes React nunca falam com Prisma — passam por `server/repositories` e
  `server/services`.
- Toda página e todo Server Action começa por `requireUser()`. Proteger o layout
  não protege o dado; quem protege é a consulta.
- Toda entrada vinda do navegador é validada com Zod antes de tocar no banco.
- Dinheiro é sempre **centavos** (`Int`). Inteiro não erra centavo em soma e não
  exige a biblioteca `decimal.js` que o tipo `Decimal` do Prisma puxaria.
- Nenhuma chave de API chega ao cliente: segredos só existem em `server/`.
