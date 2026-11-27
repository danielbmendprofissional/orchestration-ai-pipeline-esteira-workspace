# 01 — Tempo real: webhook do GitLab e SSE para a tela

risco: alto   <!-- rota pública sem sessão (webhook) autenticada por segredo compartilhado; segredo novo; escrita no GitLab (cria hook); tabela nova; stream autenticado por pessoa com controle de acesso por Aplicação -->
base: workspace@0a78d47 · esteira-api@5ed7443 · esteira-frontend@168f0f4 · 2026-11-27
flag: sim   <!-- `Features:T1`: o front só abre o SSE com o flag ligado; desligado, o Painel segue como na P2b (Atualizar + recarga única depois do 202) -->
preview: features/fatias — rota `/fatias`

## Contexto necessário
- CONTEXT-MAP.md (Aplicação, Projeto, Fatia, Ação do bot; o diagrama "GitLab ──webhook de pipeline──► esteira-api")
- docs/adr/0011-tempo-real-sse.md (SSE, Redis pub/sub com `Redis:KeyPrefix`, polling enquanto a conexão cai), 0010-acoes-do-bot.md (a confirmação chega pelo webhook), 0008-esteira-decide-e-orquestra.md (bot por grupo), 0021-esteira-autoridade-do-processo.md (webhook como rastro de merge fora da Esteira), 0004-autenticacao-bff.md (cookie de sessão), 0003-erros.md, 0014-identificadores.md, 0019-feature-flags-e-liberacao.md
- docs/agents/padrao-api.md (erros, identificadores, flags) · docs/agents/padrao-frontend.md (camadas, flag no front) · docs/agents/infra-local.md (Redis: chaves e canais `<projeto>:*`; `SCAN`/`KEYS` negados)
- docs/mudancas-infra.md (item 2, token do bot com escopo `api`; esta fatia pede o item 5)
- specs/feature/painel/03-acoes-do-bot-na-mr.md (Ação do bot, executor, `ConsultaDePipelines` que esta fatia complementa) · specs/feature/painel/01-painel-de-fatias.md (guardado de 60 s no Redis) · specs/feature/aplicacoes/01-cadastro-aplicacao.md (cadastro de Projeto)
- esteira-api/docs/PENDENCIAS.md ("T1: webhook no lugar da consulta") · esteira-frontend/docs/PENDENCIAS.md

## Ideia
O que muda no GitLab chega à tela sem o humano apertar **Atualizar**. Esta fatia entrega o encanamento ponta a ponta e dois consumidores que já existem: a **Ação do bot** `abrir-review` (confirmada ou falhada pelo webhook, e não mais só pela consulta periódica da P2b) e o **Painel de Fatias** (estado da MR, da pipeline e das Ações).

Pontas: o GitLab chama `POST /api/webhooks/gitlab` (segredo único); a API traduz o evento, conclui a Ação quando for o caso, apaga o guardado do Painel e publica no **Redis pub/sub**; cada instância da API entrega aos navegadores por **SSE** em `GET /api/v1/eventos`; o front recarrega só o que mudou e, se a conexão cai, volta a consultar por tempo (ADR-0011). O registro do hook em cada repositório é uma **Ação do bot** (outbox), disparada pelo cadastro do Projeto.

Fica de **fora** (e em qual fatia entra):
- Estado de **Etapa e do Fluxo** na tela da Entrega, linha do tempo e faixa por Fluxo → **E1b**. A T1 só publica `pipeline.atualizada` com o status bruto, sem persistir nem interpretar Etapa.
- Orquestração (SHA, `fluxo/<id>`, promoção, Superado) → **E4**; resultado de agente e Achado → **E2**; deploy por Destino → **E4**.
- O registro auditável "merge fora da Esteira, por <pessoa>" (ADR-0021) → **X1** (auditoria). A T1 só publica o evento `fatias.mudaram`.
- Canal de tempo real do `/implement-task` ("o que a IA está codando agora") → adiado pela ADR-0024.
- O hook por Projeto **Angular/preview** não muda: o `abrir-review` continua criando a pipeline do `preview` (P2b); a T1 só troca como ela é confirmada.
- A `ConsultaDePipelines` **não é removida**: fica como rede de segurança (hook perdido, fora do ar), com intervalo padrão de 60 s.

## Dados
Migration **expand-only** (tabela nova), schema `esteira`. Id (long) e PublicId (Guid v7).

- `WebhookProjeto`: `ProjetoId` (único), `GitLabHookId` (long, nulo até registrar), `Estado` (`pendente`, `registrado`, `falhou`), `CodigoErro` (nulo), `AtualizadaEm`. Uma linha por Projeto; a Ação é a própria linha (a reexecução volta a `pendente`). O segredo **nunca** é gravado no banco.
- Sem tabela de eventos: o fluxo ao vivo é só Redis (ADR-0011); histórico é da X1.

## Backend
Em `Esteira.Api` (rotas), `Esteira.Application/Eventos` (tradução, publicação, registro do hook), `Esteira.Infra.Cache` (pub/sub), `Esteira.AcL` (hooks do GitLab), `Esteira.Messaging` (consumer do registro).

- **Webhook** `POST /api/webhooks/gitlab` (`[AllowAnonymous]`, **terceira superfície**, fora de `/api/v1` e de `/api/pipeline/v2`): lê só os cabeçalhos `X-Gitlab-Token` e `X-Gitlab-Event` antes de tocar o corpo. O token é comparado em **tempo constante** com `GitLab:Webhook:Secret`; ausente ou diferente → `401 webhook.token-invalido`, sem consultar banco nem Redis. Corpo com mais de 1 MB → `413`. Eventos tratados: `Pipeline Hook` e `Merge Request Hook`; qualquer outro → `200` ignorado.
- **Reconhecer o Projeto:** pelo `project.path_with_namespace` do corpo contra os Projetos ativos cadastrados. Projeto não cadastrado → `200` sem efeito (mesma resposta de "tratado"), para o hook não servir de sonda de cadastro.
- **`Pipeline Hook`:** publica `pipeline.atualizada` (`projetoId`, `pipelineId`, `status`, `ref`, `sha`). Se o `pipelineId` é o da Ação `abrir-review` em `executando`, conclui a Ação com o mesmo caminho da consulta (`ConclusaoDaAcaoBot`): `success` confirma, `failed`/`canceled` falha em `preview.pipeline-falhou`. Status intermediário não conclui.
- **`Merge Request Hook`:** apaga o guardado do Painel da Aplicação do Projeto (para a próxima leitura ser fresca) e publica `fatias.mudaram` (`aplicacaoId`, `fatiaCodigo` quando a branch é `feature/<fatia>-*`).
- **Ação do bot muda de estado** (qualquer caminho: webhook, consulta, executor): publica `acao.atualizada` (`aplicacaoId`, `fatiaCodigo`, `acaoId`, `estado`) depois do commit.
- **Concorrência:** `ConclusaoDaAcaoBot` já decide pelo estado atual; webhook e consulta periódica podem chegar juntos. A segunda conclusão é no-op (nunca 500, nunca transição inválida). O registro do hook tem índice único por `ProjetoId`.
- **Registro do hook:** `CadastrarProjeto` (A1) grava `WebhookProjeto` `pendente` e publica a mensagem no outbox na **mesma transação**. O consumer cria o hook no GitLab (token do bot do grupo) com a URL pública `Webhook:UrlPublica`, o segredo e os eventos `pipeline` e `merge_requests`, `enable_ssl_verification` ligado. **Idempotente:** lista os hooks do Projeto; achando um com a mesma URL, atualiza (`PUT`) e grava o `GitLabHookId`; senão cria. Falha → `falhou` com `CodigoErro` (`webhook.gitlab-indisponivel`, `webhook.bot-nao-configurado`, `webhook.sem-permissao`). Um **serviço de partida** enfileira o registro dos Projetos ativos sem linha (os já cadastrados antes da T1). `POST /api/v1/projetos/{id}/webhook/reexecutar` (Sessão, só MOR) volta `falhou` a `pendente` e enfileira; em estado diferente de `falhou` → `409 webhook.nao-reexecutavel`.
- **SSE** `GET /api/v1/eventos` (Sessão): `text/event-stream`, `Cache-Control: no-store`, `X-Accel-Buffering: no`. Ao abrir, calcula as Aplicações que a pessoa pode ver (a mesma regra do Painel, `AcessoAplicacao`) e entrega só os eventos delas. Linha de comentário `: ping` a cada 15 s (mantém Ingress e nginx abertos). A conexão **encerra sozinha em 5 min** (o navegador reconecta e a autorização é recalculada). No máximo **6 conexões por pessoa**; a 7ª → `429 eventos.limite-conexoes`. Sem replay (Redis pub/sub perde evento): o front recarrega uma vez ao reconectar.
- **Fan-out:** cada instância mantém **uma** assinatura do canal `<Redis:KeyPrefix>eventos` e distribui em memória aos streams abertos. Mensagem malformada ou de Aplicação desconhecida é descartada com log sem corpo. O evento carrega **só identificadores e estado** (GUIDs públicos, código da Fatia, status), nunca comentário, título de MR, nem texto do GitLab; quem precisa do detalhe reconsulta a rota autorizada.
- **Segurança:** o segredo e o token do bot nunca vão a log, corpo de erro, evento nem banco; o corpo do webhook não é logado. O front nunca recebe o segredo. `GitLab:Webhook:Secret` e `Webhook:UrlPublica` entram só pelo contrato de configuração. Concorrência: N/A além do descrito acima (o webhook não grava agregado novo).

## Frontend
Em `core/tempo-real` (infra) e `features/fatias` (consumo). Camadas do `padrao-frontend.md`: o serviço de API fala `EventSource` e URL; o serviço de estado guarda signals.

- **`TempoRealService`:** abre `EventSource('/api/v1/eventos')` só com `Features:T1` ligado e com sessão. Estados `conectando | ao-vivo | reconectando | consultando`. Queda → `reconectando` com recuo (1, 2, 5, 10, 30 s) e, passados 10 s sem reconexão, `consultando`: o Painel recarrega a cada 30 s até voltar. Reconectou → recarrega uma vez. Fecha ao sair da área autenticada e aborta no logout. `429` → não insiste, fica `consultando`.
- **Painel (`features/fatias`):** a lista recarrega sozinha quando chega `acao.atualizada`, `fatias.mudaram` ou `pipeline.atualizada` de uma Aplicação em tela; eventos em rajada viram **uma** recarga (debounce de 1 s). A gaveta aberta mostra o novo estado da MR, da pipeline e das Ações sem fechar. A recarga **não** descarta o guardado (o back já o apagou no `Merge Request Hook`) e **não** conta no limite do botão **Atualizar**.
- **Indicador:** no componente `atualizar-fatias`, texto curto ao lado do botão — "Ao vivo", "Reconectando…" ou "Atualização a cada 30 s" —, com `aria-live="polite"` só na troca de estado. O botão **Atualizar** continua funcionando.
- **Registro do hook:** na tela do Projeto (A1), o estado do webhook (`registrado`, `pendente`, `falhou` com o código traduzido) e, para MOR, **Reexecutar** quando `falhou`. Sem chamar o GitLab a partir do front.
- **Preview:** o `TempoRealService` do preview emite eventos falsos (tipados pelo contrato OpenAPI) por um botão de desenvolvimento, para a rota `/fatias` mostrar "Ao vivo" e a recarga.
- **Testes marcados** com `[T1]` (Vitest) e `@T1` (Playwright + axe nas telas tocadas).

## Infra
Pedidos novos em `docs/mudancas-infra.md`, item 5 (a abrir nesta fatia): chaves `GitLab:Webhook:Secret` (segredo, user-secrets/Secret, rotacionável) e `Webhook:UrlPublica` (URL da API que o GitLab alcança). Confirmar, no `verify` da infra, que o usuário Redis do projeto pode `PUBLISH` e `SUBSCRIBE` em canais `<projeto>:*`; se não puder, vira pedido no mesmo item. Ingress e nginx da API: sem buffering para `/api/v1/eventos` (o cabeçalho `X-Accel-Buffering: no` cobre o nginx; timeout de leitura acima de 60 s). A rota `/api/webhooks/gitlab` precisa ser alcançável pelo GitLab (DNS/Ingress são do ambiente, fora do mapa). Sem o item 2 com escopo `api`, o registro do hook fica `falhou` (`webhook.bot-nao-configurado`).

## Critérios (EARS)
1. Quando o `Pipeline Hook` chega com o token certo e o `pipelineId` é o da Ação `abrir-review` em `executando`, a Esteira deve confirmar a Ação se o status é `success` e falhá-la (`preview.pipeline-falhou`) se é `failed` ou `canceled`.
2. Se o cabeçalho `X-Gitlab-Token` falta ou difere de `GitLab:Webhook:Secret`, a Esteira deve responder 401 (`webhook.token-invalido`) sem consultar banco nem Redis, e o segredo não pode aparecer em log nem em resposta.
3. Se o webhook vem de um Projeto não cadastrado, de evento que a Esteira não trata, ou com status intermediário de pipeline, a Esteira deve responder 200 sem efeito; corpo acima de 1 MB deve receber 413.
4. Quando o `Merge Request Hook` chega, a Esteira deve apagar o guardado do Painel da Aplicação do Projeto e publicar `fatias.mudaram`; a leitura seguinte do Painel deve refletir o estado novo sem esperar os 60 s.
5. Quando uma Ação muda de estado por qualquer caminho, a Esteira deve publicar `acao.atualizada` depois do commit e nunca antes dele.
6. Se o webhook e a consulta periódica concluem a mesma Ação ao mesmo tempo, a Esteira deve aplicar uma conclusão e tratar a outra como no-op, nunca com 500 nem transição inválida.
7. Quando um Projeto é cadastrado, a Esteira deve gravar `WebhookProjeto` `pendente` e a mensagem do registro na mesma transação, e o consumer deve criar o hook no GitLab com a URL pública, o segredo e os eventos de pipeline e MR, gravando o `GitLabHookId` e passando a `registrado`.
8. Se já existe hook com a mesma URL no Projeto, o registro deve atualizá-lo em vez de criar outro; repetir o registro deve resultar em um só hook.
9. Se o GitLab recusa, está fora ou o bot não está configurado, o registro deve ficar `falhou` com o código (`webhook.gitlab-indisponivel`, `webhook.bot-nao-configurado`, `webhook.sem-permissao`), sem derrubar o cadastro do Projeto; só o MOR pode reexecutar, e fora de `falhou` deve receber 409 (`webhook.nao-reexecutavel`).
10. Quando a API sobe, a Esteira deve enfileirar o registro dos Projetos ativos sem `WebhookProjeto`, sem duplicar os que já têm.
11. Quando uma pessoa autenticada abre `GET /api/v1/eventos`, a Esteira deve entregar apenas eventos das Aplicações que ela pode ver, com `: ping` a cada 15 s e encerrando a conexão em 5 min; sem sessão deve responder 401.
12. Se a mesma pessoa já tem 6 conexões abertas, a Esteira deve recusar a 7ª (`eventos.limite-conexoes`, 429).
13. Enquanto houver mais de uma instância da API, um evento publicado em uma deve chegar aos navegadores ligados em qualquer outra, por uma única assinatura do canal em cada instância.
14. O evento publicado não deve conter comentário, título, descrição nem qualquer texto vindo do GitLab ou digitado por humano, só identificadores públicos, código da Fatia e estado; evento malformado ou de Aplicação desconhecida deve ser descartado.
15. Com `Features:T1` ligado e sessão ativa, quando chega um evento de uma Aplicação em tela, o Painel deve recarregar uma vez (rajada em 1 s vira uma recarga) e a gaveta aberta deve mostrar o estado novo; com o flag desligado, o front não deve abrir o SSE.
16. Se a conexão SSE cai, o front deve tentar reconectar com recuo e, passados 10 s, recarregar o Painel a cada 30 s; ao reconectar, deve recarregar uma vez e voltar a "Ao vivo"; em 429 deve ficar em "Atualização a cada 30 s" sem insistir.
17. O Painel deve mostrar o indicador "Ao vivo", "Reconectando…" ou "Atualização a cada 30 s" e anunciá-lo só quando o estado muda; a tela do Projeto deve mostrar o estado do webhook e o botão Reexecutar para MOR quando `falhou`.

## Testes
Toda classe de teste leva a marca `T1` (`[Trait("Fatia","T1")]`, `describe('[T1] …')`, `@T1`).
- **Domain** (`Esteira.Domain.Tests`): transições de `WebhookProjeto` (`pendente → registrado | falhou`, `falhou → pendente`, nunca outra) (9).
- **Application** (`Esteira.Application.Tests`, portas falsas): tradução de `Pipeline Hook` e `Merge Request Hook` em evento, conclusão da Ação por status (1, 3), invalidação do guardado (4), publicação depois do commit (5), conclusão dupla no-op (6), registro idempotente com lista de hooks falsa (7, 8, 9), serviço de partida (10), conteúdo do evento sem texto livre (14).
- **Integration** (`Esteira.Integration.Tests`, PostgreSQL, RabbitMQ e Redis reais, com a ACL do projeto): índice único de `WebhookProjeto`, cadastro + mensagem na mesma transação (7), `PUBLISH`/`SUBSCRIBE` com `Redis:KeyPrefix` entre dois hosts (13), conclusão simultânea por webhook e consulta (6).
- **API/HTTP** (host de teste, GitLab falso): webhook 401 sem tocar banco (2), 200 sem efeito e 413 (3), SSE com sessão falsa filtrado por Aplicação, `: ping` e encerramento em 5 min com relógio falso (11), limite de 6 conexões (12), segredo ausente de log e resposta (2), reexecutar só MOR (9).
- **Front** (Vitest): `TempoRealService` com `EventSource` falso: estados, recuo, polling de 30 s, 429, flag desligado (15, 16); `FatiasService` com debounce e recarga única (15); indicador e tela do Projeto (17).
- **E2E + axe** (Playwright, preview estático, rota `/fatias`): botão de desenvolvimento emite evento, o Painel recarrega e o indicador muda, sem violação de acessibilidade (15, 17).
