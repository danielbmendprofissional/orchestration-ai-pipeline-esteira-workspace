# 01 — Painel de Fatias

risco: alto   <!-- permissão por papel (quem vê o quê), token do bot do GitLab (segredo) em produção, texto de terceiros (GitLab) mostrado na tela e migração de banco (coluna nova na Aplicação) -->
base: workspace@7f67008 · esteira-api@81b7088 · esteira-frontend@f31020a · 2026-11-22
flag: sim   <!-- Features:P1 -->
preview: features/fatias — rota `/fatias`

## Contexto necessário
- CONTEXT-MAP.md (Fatia, Entrega, Fluxo, Aplicação, Projeto, Papéis, Hotfix)
- docs/adr/0024-painel-de-fatias.md (estados, abas, linha, gaveta), 0025-refinamentos-nomes-fatia-sem-flag-e-travas.md (nomes dos estados, Fatia `api + frontend`), 0022-fatias-aprovadas-e-fluxo-por-selecao.md, 0021-esteira-autoridade-do-processo.md, 0027-hotfix-pedido-e-origem-da-correcao.md (leitor de hotfix)
- docs/adr/0002-paginacao.md, 0003-erros.md, 0004-autenticacao-bff.md, 0008-esteira-decide-e-orquestra.md, 0014-identificadores.md, 0019-feature-flags-e-liberacao.md
- docs/contrato-leitura-esteira.md (o que se lê e como; esta fatia acrescenta a peça de hotfix e as fixtures) · docs/agents/orchestration.md ("Nomes", "Marca da fatia nos testes") · docs/agents/issue-tracker.md ("Tickets de uma spec")
- docs/agents/padrao-api.md (permissões, flags, paginação, erros) e padrao-frontend.md (camadas, flags, preview, config em runtime)
- docs/design/prototipos/prototipo-painel-fatias.html e README.md (telas aprovadas e "Decididas na D1") · esteira-frontend/DESIGN.md
- docs/mudancas-infra.md (item 2: token do bot, `read_api` até a P1)
- specs/feature/aplicacoes/01-cadastro-aplicacao.md (a A1: `IGitLab`, autorização por Aplicação, auditoria, flag) · esteira-api/docs/PENDENCIAS.md · esteira-frontend/docs/PENDENCIAS.md

## Ideia
O **Painel de Fatias** é a tela em que o humano **acompanha a implementação**: lista, por Aplicação, as Fatias do mapa com o estado de cada uma, deduzido do que a Esteira **lê** no GitLab (mapa, spec, issue-mãe, bloco de execução, MR). Ninguém marca estado à mão. Cada linha abre uma gaveta com os links do GitLab e as tasks.

Decididas no grill desta fatia:
- **Onde a Esteira lê:** o cadastro da Aplicação ganha o campo **Workspace** (um projeto do grupo, escolhido da lista, opcional). O workspace não é Projeto: não tem Fluxo nem deploy. Aplicação sem workspace aparece no Painel com o aviso "cadastre o workspace" e um link para o cadastro.
- **Frescor:** a API monta a lista de uma Aplicação uma vez e a guarda no Redis por 60 segundos; o botão **Atualizar** descarta o guardado. Nada vai para o banco ("sem cópia", princípio 2 do contrato). O tempo real por webhook é a T1.
- **Só o que dá para ler hoje:** estados Planejada, Com spec, Em execução, Em revisão (com "em correção") e Pronta para Entrega; abas **Em andamento**, **Prontas para Entrega** e **Todas**. As abas Em Entrega, Aguardando liberação, Limpeza pendente e Liberadas chegam com as fatias que criam o estado delas (E1, E7b, E8). Tela só de leitura.
- **Leitor de hotfix:** a API lê os pedidos de hotfix (ADR-0027) e o contrato de leitura ganha essa peça. A tela dos pedidos é da E3c.

Fora desta fatia: caixa de seleção e **Abrir Entrega** (E1a), **Abrir review**, **Aprovar** e **Reprovar** (P2, P2b), o estado do flag por Ambiente na gaveta (E7), o link "ver na auditoria" (X1), tempo real (T1), tela de Pedir hotfix e do bloco "Hotfixes pedidos" (E3c). O smoke contra o GitLab real espera o token do bot (item 2 de `docs/mudancas-infra.md`): a fatia roda com `IGitLab` falso e fixtures. Os repositórios da própria Esteira ficam fora do esquema (ADR-0025): o Painel mostra as Aplicações que a Esteira gerencia, não ela mesma.

## Dados
Uma coluna nova na Aplicação, migration sobre a A1, **expand-only**; nenhuma tabela nova.

| Entidade | Campo novo | Regras |
|---|---|---|
| `Aplicacao` | `WorkspaceGitLabId` (`long?`), `WorkspaceGitLabCaminho` (`text?`) | Os dois nulos ou os dois preenchidos. O projeto pertence ao grupo da Aplicação e **não** é um Projeto cadastrado dela. Alteração grava `RegistroAuditoria` (antes/depois) |

O resto é **lido e guardado só no Redis** (chave com `Redis:KeyPrefix`): o instantâneo da lista de cada Aplicação (60 s, mais uma cópia de 24 h para servir "dados de HH:MM" quando o GitLab cai) e o cabeçalho de cada spec (10 min).

## Backend
Rotas sob `/api/v1`, todas com sessão. Paginação ADR-0002 (`?sort=&order=`, headers `X-*`; a lista vem do instantâneo, então a paginação é em memória), erros ADR-0003. Rota recebe `PublicId`. Código em `Esteira.Application/Fatias/` (leitor e derivação), porta `IGitLab` em `Application/Interfaces/Integracoes` e adaptador em `Esteira.AcL/GitLab`.

| Rota | Quem pode | O quê |
|---|---|---|
| `PUT /aplicacoes/{id}/workspace` | analista ou MOR | `{ projetoGitLabId }` (ou `null` para limpar). Valida (ver Critérios) e audita. O detalhe da Aplicação (`GET /aplicacoes/{id}`) passa a devolver `workspace` |
| `GET /fatias` | papel na Aplicação ou MOR | lista paginada. Filtros: `?aplicacoes=<id>,<id>` (padrão: todas as visíveis), `?aba=andamento\|prontas\|todas`, `?fatia=` (código ou texto), `?projeto=api\|frontend`. Devolve `avisos` por Aplicação (sem workspace, bot não configurado, GitLab fora) e `geradoEm` |
| `POST /aplicacoes/{id}/fatias/atualizar` | papel na Aplicação ou MOR | descarta o instantâneo; 204. No máximo uma por Aplicação a cada 10 s (`painel.atualizacao-recente`, 429) |
| `GET /aplicacoes/{id}/fatias/{codigo}` | papel na Aplicação ou MOR | a gaveta: links, tasks, MRs, branch (ver abaixo) |
| `GET /aplicacoes/{id}/hotfixes` | papel na Aplicação ou MOR | os pedidos de hotfix e o estado de cada um (consumido pela E3c) |

- **Flag `Features:P1`:** desligado ou ausente, todas as rotas acima respondem 404 (mecanismo da A1).
- **Leitura do GitLab** (só `GET`, token `read_api`, `IGitLab` ampliada com `ListarIssues`, `ListarMergeRequests` e `ObterProjeto`; `ObterArquivo` já existe). Por Aplicação, o instantâneo faz: o mapa (`specs/README.md` na `main` do workspace), as issues do workspace com título `<código> — …` (abertas e fechadas, em páginas de 100), as MRs com alvo `main` de cada Projeto de código (por página, casando o título `<código> — …`) e o cabeçalho de cada spec linkada no mapa (até 8 leituras em paralelo). Uma Aplicação com falha **não derruba** as outras.
- **Instantâneo com uma leitura só:** quem chega com o guardado vencido refaz a leitura; chegadas simultâneas esperam a mesma (trava `SET NX` no Redis), sem repetir as chamadas ao GitLab.
- **Leitor tolerante** (contrato, princípio 3): linha desconhecida ignorada; peça ausente = "não disponível"; coluna `Status` com valor desconhecido mostrada como texto; spec sem `risco:`/`flag:`/`base:` ou mãe sem bloco de execução = marca **"formato anterior ao padrão"**. Nunca lança por formato quebrado. As fixtures reais (mapa, bloco, título de mãe, filha, commit, copiados de casos reais como a B2) ficam em `esteira-api/tests`, e o parser tem teste contra cada uma.
- **Estado da Fatia** (derivado, nunca gravado):

| Estado | Quando |
|---|---|
| Planejada | linha no mapa, sem link de spec e sem issue-mãe |
| Com spec | spec e mãe existem, mãe sem `em-execucao`, sem MR |
| Em execução | mãe com label `em-execucao` e sem MR aberta |
| Em revisão | há MR aberta em algum repositório da Fatia. "Em correção" quando a MR foi fechada sem merge (reprovação) e a Fatia ainda não foi mergeada |
| Pronta para Entrega | MR mergeada na `main` em **todos** os repositórios da Fatia (a da API primeiro, se `api + frontend`), ou Status `feito` no mapa |

  Os repositórios da Fatia vêm da coluna `Repositório` do mapa. Progresso em texto: "3 de 5 tasks" (bloco de execução) em execução; "CI verde, aguardando você", "CI vermelho" ou "CI rodando" (pipeline da MR) em revisão. As abas: **Em andamento** = Com spec, Em execução, Em revisão; **Prontas para Entrega**; **Todas** (inclui Planejada).
- **Gaveta:** spec, issue-mãe e filhas, branch `feature/<fatia>-<slug>` e MR de cada repositório, commit de cada task (o `sha` do bloco; task sem `sha` mostra o link da branch), lista de tasks com o executor. **Todo link é montado de ids e caminhos que a Esteira já tem** (grupo e projetos do cadastro, número de issue, `sha`, `iid` da MR) sobre `GitLab:Url`; nunca se usa URL vinda do GitLab. Fatia que toca dois repositórios traz dois conjuntos de links.
- **Hotfix** (ADR-0027): o pedido é uma issue do workspace com título `Hotfix: <motivo>` e label `ready-for-human`. Estado: **Aguardando a correção** (sem MR aberta nem mergeada que cite a issue), **MR aberta** (MR com origem `hotfix/*` que cita a issue) e **Pronto para Entrega** (MR mergeada na `main`; a Entrega ainda não existe nesta fatia). MR `hotfix/*` fechada sem merge volta a Aguardando a correção.
- **Texto de terceiros:** títulos, labels e motivos vindos do GitLab são só dado. A API corta o tamanho (título 200 caracteres) e nunca os devolve como HTML; o token nunca entra em resposta, log ou erro.
- **Acesso:** o mesmo serviço de autorização da A1 (papéis da pessoa + `EhMor`). Sem papel na Aplicação, ela não aparece e rota por id devolve 404, nunca 403.
- Chaves de configuração: `GitLab:Url` e `GitLab:Bots:<grupo>:Token` (já da A1), `Features:P1` e `Painel:ValidadeSegundos` (padrão 60).

## Frontend
Feature `features/fatias/` (padrao-frontend: api service · domain service · pages · components; spartan/ui; texto pt-BR; tipos gerados do OpenAPI, rodar `generate:api-types` depois da API). Rota `/fatias` com `data.menu` "Painel de Fatias" e `data.feature: 'P1'` (flag desligado esconde menu e rota). Segue o protótipo `prototipo-painel-fatias.html` e `DESIGN.md`.

- **Painel:** abas **Em andamento**, **Prontas para Entrega** e **Todas** logo abaixo do cabeçalho do bloco; linha com `<código> — <título>`, Projeto (API, front ou os dois), risco, badge de estado (ícone e texto, sem barra; neutro, azul e âmbar como decidido na D1) e o progresso em texto. "formato anterior ao padrão" aparece como marca pequena.
- **Filtros:** Aplicação (seletor com busca e várias escolhas, Recentes, contagem, 8 por vez; nunca um `select` com a lista inteira), Fatia e Projeto. Paginação com janela (`1 2 … 5 6 7 … 59 60`), "Ir para" e "Por página".
- **Atualizar** no canto do bloco, com "dados de HH:MM". Aviso por Aplicação: sem workspace (com link para a aba de dados da Aplicação), bot não configurado, GitLab fora (mostra o último guardado, ou o erro com "tentar de novo").
- **Gaveta** lateral (clique na linha): links, tasks e MRs como acima; edição nunca aqui.
- **Só leitura:** nenhuma caixa de seleção nem botão de ação (Abrir Entrega, Abrir review, Aprovar, Reprovar chegam em E1a e P2).
- **Cadastro da Aplicação:** a aba de dados ganha o campo **Workspace** (seletor da lista de projetos do grupo, já existente na A1, sem os Projetos cadastrados), editável por quem `podeEditarCadastro`.
- Texto vindo da API é mostrado como texto (interpolação do Angular), nunca `innerHTML`.
- **Preview:** sessão falsa (MOR) e dados falsos de 2 Aplicações com Fatias em todos os estados desta fatia (inclusive 300 linhas para a paginação), tipados pelos tipos gerados.

## Infra
- Token do bot do GitLab, `read_api`: item 2 de `docs/mudancas-infra.md` (pedido já aberto; não bloqueia a implementação, só o smoke real). A partir da P2b o escopo passa a `api`.
- `Features__P1` no Ambiente e `P1` no `features.json` do front; nasce desligado em produção.
- Contrato: `docs/contrato-leitura-esteira.md` ganha a peça "Pedido de hotfix" e a nota das fixtures; a mudança é só aditiva (sem versão nova).

## Critérios (EARS)
1. Quando um analista ou MOR informa o workspace de uma Aplicação, a Esteira deve guardar o projeto escolhido (id e caminho) e registrar na auditoria o antes e o depois.
2. Se o projeto não pertencer ao grupo da Aplicação, a Esteira deve recusar (`aplicacao.workspace-fora-do-grupo`); se já for um Projeto cadastrado, recusar (`aplicacao.workspace-e-projeto`).
3. Enquanto a Aplicação não tiver workspace, a Esteira deve listá-la com o aviso "sem workspace" e nenhuma Fatia, sem erro.
4. Quando o Painel é pedido, a Esteira deve devolver uma Fatia por linha do mapa do workspace, na ordem do mapa, com código, título, repositórios, risco da spec e estado.
5. Se uma linha, spec ou issue estiver em formato desconhecido ou antigo, a Esteira deve mostrar o que conseguir com a marca "formato anterior ao padrão" e nunca falhar a lista; valor desconhecido de `Status` é devolvido como texto.
6. Enquanto a linha do mapa não tiver link de spec nem issue-mãe, o estado deve ser **Planejada**; com spec e mãe e sem `em-execucao` nem MR, **Com spec**.
7. Enquanto a mãe tiver o label `em-execucao` e não houver MR aberta, o estado deve ser **Em execução**, com o progresso "N de M tasks" lido do bloco de execução.
8. Enquanto houver MR aberta em algum repositório da Fatia, o estado deve ser **Em revisão**, com o progresso pelo pipeline da MR ("CI verde, aguardando você", "CI vermelho" ou "CI rodando"); MR fechada sem merge, com a Fatia não mergeada, deve mostrar "em correção".
9. Quando as MRs de todos os repositórios da Fatia estão mergeadas na `main`, ou o `Status` do mapa é `feito`, o estado deve ser **Pronta para Entrega**; Fatia `api + frontend` com só uma MR mergeada não deve ser Pronta.
10. Quando a aba é pedida, a Esteira deve filtrar: **Em andamento** (Com spec, Em execução, Em revisão), **Prontas para Entrega** ou **Todas**; também por `?fatia=`, `?projeto=` e `?aplicacoes=`, paginando com os headers `X-*`.
11. Enquanto a pessoa não tiver papel na Aplicação e não for MOR, a Esteira não deve listá-la nem devolver sua gaveta ou hotfixes (404, não 403); id de Aplicação inacessível em `?aplicacoes=` é ignorado.
12. Quando a gaveta é pedida, a Esteira deve devolver os links da spec, da mãe e das filhas, da branch e da MR de cada repositório e o commit de cada task, montados só de ids e caminhos conhecidos; task sem `sha` deve apontar para a branch.
13. Quando a lista é pedida dentro de 60 segundos da última leitura da Aplicação, a Esteira deve responder do guardado sem consultar o GitLab; chegadas simultâneas com o guardado vencido devem produzir uma única leitura.
14. Quando **Atualizar** é acionado, a Esteira deve descartar o guardado e ler de novo; uma segunda atualização da mesma Aplicação em menos de 10 s deve ser recusada (`painel.atualizacao-recente`).
15. Se o GitLab estiver indisponível, a Esteira deve devolver o último guardado marcado "dados de HH:MM"; sem guardado, devolver o aviso da Aplicação (`gitlab.indisponivel`); sem token para o grupo, `gitlab.bot-nao-configurado`. Uma Aplicação com falha não deve esconder as outras.
16. Quando os pedidos de hotfix são lidos, a Esteira deve classificar cada issue `Hotfix: <motivo>` como **Aguardando a correção**, **MR aberta** (MR `hotfix/*` que cita a issue) ou **Pronto para Entrega** (MR mergeada na `main`); MR fechada sem merge volta a **Aguardando a correção**.
17. Se um texto vindo do GitLab traz HTML ou marcação, a Esteira não deve devolvê-lo como HTML e o front deve mostrá-lo como texto; o token do bot nunca deve aparecer em resposta, log ou mensagem de erro.
18. Enquanto `Features:P1` estiver ausente ou desligado, a Esteira não deve responder as rotas (404) e o front não deve mostrar o item de menu nem abrir `/fatias`.
19. O Painel não deve oferecer nenhuma ação de escrita (seleção, abrir Entrega, review, aprovar, reprovar) e a Esteira não deve fazer nenhuma chamada de escrita ao GitLab.

## Testes
Todo teste leva a marca `P1` (`docs/agents/orchestration.md`, "Marca da fatia nos testes").
- **Domain/Application** (xUnit, NSubstitute para `IGitLab`): um teste por critério 1–10, 12, 16 e 17, com as **fixtures reais** do contrato (mapa, bloco de execução, título de mãe, filha, commit) e casos de formato antigo/quebrado (5); a derivação de estado em tabela (6–9).
- **Integração** (Testcontainers + PostgreSQL, Redis): migration e unicidade/coerência do workspace (1, 2), auditoria na mesma transação, instantâneo de 60 s, trava de leitura única e limite de atualização (13, 14), servir o guardado com o GitLab fora (15); adaptador `IGitLab` contra `HttpMessageHandler` falso (paginação, 404, 401, token fora do log).
- **API** (sessão simulada): autorização por papel e MOR e 404 sem papel (11), flag desligado (18), Aplicação com falha isolada (3, 15), contrato OpenAPI das rotas novas, nenhuma rota de escrita (19).
- **Frontend** (Vitest + Testing Library): domain service e página (abas, filtros, paginação com janela, aviso por Aplicação, "dados de HH:MM", Atualizar); texto com marcação mostrado como texto (17); sem botão de ação (19); flag desligado esconde menu e rota (18); campo Workspace no cadastro.
- **E2E** (Playwright, API simulada, tag `@P1`): MOR abre o Painel com 300 Fatias, troca de aba, filtra por Aplicação e Projeto, pagina, abre a gaveta e clica **Atualizar**; usuário só-membro de uma Aplicação não vê as outras; axe-core sem violação AA no Painel e na gaveta.

## Checklist de entrega (fora dos critérios)
- [ ] `docs/contrato-leitura-esteira.md`: peça "Pedido de hotfix" (título, label, branch e como a MR cita a issue) e referência às fixtures.
- [ ] Item 2 de `docs/mudancas-infra.md` segue como pedido; sem mudança nele.
