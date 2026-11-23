# 02 — Review e aprovação da Fatia

risco: alto   <!-- permissão por papel (quem aprova e reprova), decisão que manda mergear código na `main`, migração de banco (tabela nova) e texto livre do humano que vai para o GitLab -->
base: workspace@19556f9 · esteira-api@86f94c2 · esteira-frontend@b5fe57d · 2026-11-23
flag: sim   <!-- Features:P2 -->
preview: features/fatias — rota `/fatias`

## Contexto necessário
- CONTEXT-MAP.md (Fatia, Review da Fatia, Papéis, Ação do bot)
- docs/adr/0010-acoes-do-bot.md (Ação do bot: pedida → executando → confirmada | falhou, chave de idempotência, mesma transação), 0021-esteira-autoridade-do-processo.md ("Fatia antes do Fluxo", Reprovar e Aprovar o review), 0022-fatias-aprovadas-e-fluxo-por-selecao.md (review leve; aprovar só mergeia, flag desligado), 0024-painel-de-fatias.md ("Cada linha"), 0025-refinamentos-nomes-fatia-sem-flag-e-travas.md (Fatia `api + frontend`: API primeiro; preview em `esteira-nao-prod`; a Esteira fora do esquema)
- docs/adr/0002-paginacao.md, 0003-erros.md, 0004-autenticacao-bff.md, 0014-identificadores.md, 0019-feature-flags-e-liberacao.md
- docs/agents/padrao-api.md (permissões, flags, erros) e padrao-frontend.md (camadas, flags, preview)
- docs/design/prototipos/prototipo-painel-fatias.html (botões Abrir review, Reprovar, Aprovar e quem pode cada um) e README.md · esteira-frontend/DESIGN.md
- specs/feature/painel/01-painel-de-fatias.md (a P1: instantâneo, estados, gaveta, `IGitLab` só de leitura, flag `Features:P1`) · specs/feature/aplicacoes/01-cadastro-aplicacao.md (autorização por Aplicação, auditoria)
- docs/mudancas-infra.md (item 2: token do bot) · esteira-api/docs/PENDENCIAS.md · esteira-frontend/docs/PENDENCIAS.md

## Ideia
No Painel de Fatias, quem tem papel para isso **decide** a Fatia que está **Em revisão**: **Abrir review**, **Aprovar** (mergear na `main`, flag desligado) ou **Reprovar** (comentar e fechar a MR, com o comentário do humano). A Esteira grava a decisão (quem, quando, comentário) e o pedido da **Ação do bot** correspondente, na mesma transação, e mostra o estado na linha e na gaveta.

**Corte com a P2b (decidido no `/fatia`):** a P2 **registra**, a P2b **executa**. Nada aqui escreve no GitLab: a `IGitLab` continua só de leitura e o token continua `read_api`. Quem comenta, fecha, mergeia e dá o play do `review-<fatia>` é o executor da P2b, que consome as Ações pedidas, muda o estado delas por um serviço que a P2 já entrega e testa. Por isso `Features:P2` nasce desligado e **só liga junto com a P2b**; ponta a ponta, só depois dela.

Decididas no `/fatia`:
- **Aprovar** vale com a Fatia Em revisão, **todas as MRs abertas dela com CI verde** e papel de Aprovador técnico ou MOR. Não exige review aberto (review é sob demanda, ADR-0022). **Reprovar** vale com MR aberta e qualquer CI, exige comentário.
- **Fatia `api + frontend`:** uma Ação por MR aberta. A Ação do front só começa depois da Ação da API confirmada (API primeiro, ADR-0025). Reprovar fecha as duas.
- **Link do review:** o estado vem da Ação; o link do preview é montado da configuração `Review:UrlModelo` com o código da Fatia, só para Fatia que toca o front, e só com a Ação confirmada. Sem webhook (é a T1).

Fora desta fatia: executar qualquer Ação no GitLab, reabrir a MR depois da correção e **reexecutar** Ação falhada (P2b); `preview`/`fechar-fatia` no template (P2b); webhook e tempo real (T1); aprovar a MR de **hotfix** (E3c, com a regra "quem pediu o hotfix não aprova", ADR-0027); caixa de seleção e Abrir Entrega (E1a); estado do flag por Ambiente (E7). Os repositórios da própria Esteira ficam fora do esquema (ADR-0025).

## Dados
Uma tabela nova, migration sobre a P1, **expand-only**. Schema `esteira`, ids como na ADR-0014 (`long` interno + GUID público).

| Entidade | Campos | Regras |
|---|---|---|
| `AcaoBot` | `AplicacaoId`, `FatiaCodigo`, `ProjetoId` (o Projeto cadastrado cujo repositório tem a MR), `MrIid`, `Tipo` (`abrir-review` \| `aprovar` \| `reprovar`), `Estado` (`pedida` \| `executando` \| `confirmada` \| `falhou` \| `cancelada`), `ChaveIdempotencia` (única), `DependeDeAcaoId` (nulo, só a Ação do front de uma Fatia `api + frontend`), `PedidaPorPessoaId`, `Comentario` (`text?`, só `reprovar`, até 2000), `PedidaEm`, `AtualizadaEm`, `CodigoErro` (`text?`) | Chave = `<aplicação>:<fatia>:<tipo>:<projeto>:<mr>:<tentativa>`; duas decisões iguais em sequência (duplo clique) caem na mesma chave. Transições válidas: pedida → executando → confirmada \| falhou; pedida → cancelada; nunca volta |

A decisão e o pedido da Ação são **a mesma linha**: o `RegistroAuditoria` (A1) guarda quem, quando e o antes/depois de cada pedido. O comentário do Reprovar fica na `AcaoBot`. Nada do GitLab é copiado para o banco; o instantâneo continua só no Redis.

## Backend
Rotas sob `/api/v1`, com sessão, rota por `PublicId`, erros ADR-0003. Código em `Esteira.Application/Fatias/Decisoes/` (comandos e regras), entidade em `Esteira.Domain`, mensagem de outbox `AcaoBotPedida` (MassTransit, M0). Reaproveita o instantâneo e a derivação de estado da P1.

| Rota | Quem pode | O quê |
|---|---|---|
| `POST /aplicacoes/{id}/fatias/{codigo}/review` | Membro, Aprovador técnico ou MOR | pede a Ação `abrir-review` (uma, na MR mais antiga aberta de cada repositório); 202 com as Ações criadas |
| `POST /aplicacoes/{id}/fatias/{codigo}/aprovar` | Aprovador técnico ou MOR | pede uma Ação `aprovar` por MR aberta; 202 |
| `POST /aplicacoes/{id}/fatias/{codigo}/reprovar` | Aprovador técnico ou MOR | `{ comentario }` (1–2000 caracteres, texto); pede uma Ação `reprovar` por MR aberta; 202 |

- **Papéis:** `OperacaoAplicacao` ganha `AbrirReview` (Membro, Aprovador técnico, MOR) e `DecidirFatia` (Aprovador técnico, MOR). Analista, Aprovador de negócio e Publicador **não** decidem a menos que também tenham um dos papéis acima. Sem papel na Aplicação (e sem MOR): 404, nunca 403. Com papel mas sem a operação: 403 `acesso.papel-insuficiente`.
- **Estado fresco antes de gravar:** o comando **relê a Aplicação no GitLab sem usar o guardado de 60 s** (a mesma leitura da P1, sem o limite de 10 s do botão Atualizar, que vale só para a rota pública) e decide sobre esse estado; GitLab fora ou sem token: `gitlab.indisponivel` / `gitlab.bot-nao-configurado` e nada é gravado.
- **Regras de recusa:** Fatia que não está Em revisão ou sem MR aberta (`fatia.sem-mr-aberta`, 409); decisão (`aprovar` ou `reprovar`) já pedida e ainda não confirmada nem falhada (`fatia.decisao-em-andamento`, 409); `abrir-review` com Ação de review ainda viva ou confirmada na MR (`fatia.review-ja-pedido`, 409); aprovar com alguma MR aberta sem pipeline `success` (`fatia.ci-nao-verde`, 409, lista as MRs); reprovar sem comentário ou com mais de 2000 caracteres (`fatia.comentario-invalido`, 400); código de Fatia que não existe no mapa (`fatia.nao-encontrada`, 404).
- **Ordem da API primeiro:** na Fatia `api + frontend` a Ação do front nasce com `DependeDeAcaoId` apontando para a da API e só pode passar a `executando` quando a da API estiver `confirmada`; se a da API `falhou`, a do front vira `cancelada`.
- **Serviço para o executor (P2b):** `RegistrarProgressoDaAcao(acaoId, estado, codigoErro?)` aplica as transições acima, grava auditoria e, ao ir para `confirmada` ou `falhou`, **descarta o instantâneo da Aplicação** (a próxima leitura mostra o merge ou o fechamento). Fica coberto por teste aqui, sem consumer.
- **Outbox:** cada Ação pedida publica `AcaoBotPedida` na mesma transação; a P2 não registra consumer.
- **Painel (`GET /fatias`) e gaveta (`GET /aplicacoes/{id}/fatias/{codigo}`)** ganham, por Fatia: `acoes` (`podeAbrirReview`, `podeAprovar`, `podeReprovar`, cada um com o motivo quando não pode: papel, sem MR aberta, CI não verde, decisão em andamento), `review` (`nenhum` \| `pedido` \| `aberto` \| `falhou`, mais `link`), `decisao` (`nenhuma` \| `aprovando` \| `reprovando` \| `falhou`). A gaveta traz também a lista das Ações (tipo, estado, quem, quando, código de erro). Tudo vem das permissões e do estado, nunca de dado do GitLab.
- **Link do review:** `Review:UrlModelo` (ex.: `https://{fatia}.preview.<domínio>`, `https`, com `{fatia}`); o link só aparece com a Ação `abrir-review` `confirmada`, Fatia Em revisão e que toca o front; o código vai em minúsculo. Configuração ausente ou inválida = sem link, sem erro. Fatia só de API mostra "review aberto" sem link.
- **Flag `Features:P2`:** desligado ou ausente, as três rotas respondem 404 e os campos novos vêm vazios (mecanismo da A1). Depende de `Features:P1` ligado para o Painel existir.
- **Texto de terceiros e do humano:** o comentário é gravado e devolvido como texto, nunca como HTML, e **não vai para log**; o token do bot continua fora de resposta, log e erro.
- **Chaves de configuração novas:** `Features:P2`, `Review:UrlModelo`.

## Frontend
Mesma feature `features/fatias/` (api service · domain service · pages · components; spartan/ui; pt-BR; tipos gerados do OpenAPI, rodar `generate:api-types` depois da API). Segue o protótipo `prototipo-painel-fatias.html` e o `DESIGN.md`. Item de menu e rota continuam sob `P1`; os botões e a gaveta nova sob `data.feature: 'P2'`.

- **Na linha (aba Em andamento, estado Em revisão):** **Abrir review** (ou o link "review aberto" quando há `link`; "review pedido…" quando `pedido`), **Reprovar** (perigo, à esquerda) e **Aprovar** (principal), como no protótipo. Botão sem permissão ou sem condição fica desativado com o motivo no `title` (texto vem do campo `motivo` da API; sem texto explicativo ao lado). Com `decisao` ≠ `nenhuma` os dois ficam desativados e a linha mostra "aprovação pedida", "reprovação pedida" ou "falhou, reexecutar na P2b".
- **Aprovar** abre um diálogo de confirmação que diz o que vai acontecer ("mergeia na `main` com o flag `Features:<Fatia>` desligado; a API primeiro") e lista as MRs. **Reprovar** abre um diálogo com o campo **Comentário** (obrigatório, contador de 2000 caracteres, "será postado na MR com o seu nome"). **O protótipo não tem esses dois diálogos:** o agente `ui` os desenha com os componentes do spartan/ui e as regras do `DESIGN.md` e o humano valida na MR.
- **Depois do clique:** o front pede a ação, mostra o 202 como estado na linha e recarrega a lista uma vez; sem tempo real (T1), o humano usa **Atualizar** para ver o merge ou o fechamento.
- **Gaveta:** seção **Ações do bot** com tipo, estado (ícone e texto), quem pediu, quando e o código do erro; edição nunca aqui.
- **Erros de negócio** (`fatia.ci-nao-verde`, `fatia.decisao-em-andamento`, `fatia.sem-mr-aberta`, `gitlab.indisponivel`) aparecem no próprio diálogo ou no aviso do bloco, com o texto da API, e a lista se atualiza.
- Texto vindo da API é mostrado como texto (interpolação do Angular), nunca `innerHTML`, inclusive o comentário.
- **Preview:** a sessão falsa do `/fatias` (MOR) e os dados falsos ganham Fatias Em revisão com CI verde, com CI vermelho, com review pedido e aberto (com link), com `decisao` em andamento e uma `api + frontend`; tudo tipado pelos tipos gerados.

## Infra
- `Features__P2` no Ambiente e `P2` no `features.json` do front; nasce desligado em produção e **só liga com a P2b**.
- `Review__UrlModelo` no Ambiente (valor definido junto com a P2b, quando o endereço do preview existir).
- Nenhuma mudança de token: o escopo `api` do bot entra com a P2b (`docs/mudancas-infra.md`, item 2).

## Critérios (EARS)
1. Quando um Membro, Aprovador técnico ou MOR pede **Abrir review** de uma Fatia Em revisão, a Esteira deve gravar uma Ação `abrir-review` em `pedida` por repositório com MR aberta, auditar o pedido e publicar `AcaoBotPedida` no outbox na mesma transação, respondendo 202.
2. Quando um Aprovador técnico ou MOR pede **Aprovar** de uma Fatia Em revisão com todas as MRs abertas em CI verde, a Esteira deve gravar uma Ação `aprovar` em `pedida` por MR aberta, auditar e publicar no outbox na mesma transação, sem escrever no GitLab.
3. Se alguma MR aberta da Fatia não tiver pipeline `success`, a Esteira deve recusar o Aprovar (`fatia.ci-nao-verde`), listando as MRs, e não gravar nada.
4. Quando um Aprovador técnico ou MOR pede **Reprovar** com comentário de 1 a 2000 caracteres, a Esteira deve gravar uma Ação `reprovar` em `pedida` por MR aberta, com o comentário, o autor e o horário; sem comentário ou acima do limite, deve recusar (`fatia.comentario-invalido`).
5. Se a Fatia não estiver Em revisão ou não tiver MR aberta, a Esteira deve recusar qualquer das três decisões (`fatia.sem-mr-aberta`); se o código não existir no mapa, recusar (`fatia.nao-encontrada`).
6. Enquanto houver Ação `aprovar` ou `reprovar` da Fatia em `pedida` ou `executando`, a Esteira deve recusar nova decisão (`fatia.decisao-em-andamento`); enquanto houver `abrir-review` viva ou `confirmada` na MR, recusar outro (`fatia.review-ja-pedido`).
7. Quando o mesmo pedido chega duas vezes seguidas (duplo clique), a Esteira não deve criar a segunda Ação (mesma chave de idempotência) e deve devolver o estado da primeira.
8. Quando uma decisão é pedida, a Esteira deve reler a Aplicação no GitLab sem usar o instantâneo guardado e decidir sobre esse estado; com o GitLab fora ou sem token, recusar (`gitlab.indisponivel` / `gitlab.bot-nao-configurado`) sem gravar.
9. Se a pessoa não tem papel na Aplicação e não é MOR, a Esteira deve responder 404; se tem papel mas não a operação (Abrir review: Membro, Aprovador técnico, MOR; Aprovar e Reprovar: Aprovador técnico, MOR), responder 403 `acesso.papel-insuficiente`.
10. Enquanto a Fatia `api + frontend` tiver duas MRs abertas, a Esteira deve criar a Ação do front dependente da da API e só permitir que ela passe a `executando` com a da API `confirmada`; se a da API `falhar`, a do front deve virar `cancelada`. Reprovar deve criar uma Ação por MR sem dependência.
11. Quando o executor registra o progresso de uma Ação, a Esteira deve aplicar só transições válidas (pedida → executando → confirmada \| falhou; pedida → cancelada), auditar, e rejeitar qualquer outra; ao ir para `confirmada` ou `falhou`, deve descartar o instantâneo da Aplicação.
12. Quando o Painel ou a gaveta são pedidos, a Esteira deve devolver por Fatia as permissões `podeAbrirReview`, `podeAprovar` e `podeReprovar` com o motivo de cada recusa, o estado do `review` e o da `decisao`, calculados do papel da pessoa e do estado da Fatia.
13. Quando a Ação `abrir-review` está `confirmada`, a Fatia toca o front e `Review:UrlModelo` é válido, a Esteira deve devolver o link do preview montado só do código da Fatia; sem uma dessas condições, não devolver link e não falhar.
14. Quando a gaveta é pedida, a Esteira deve listar as Ações da Fatia (tipo, estado, quem, quando, código de erro), sem o texto do comentário fora da própria Ação de Reprovar e sem nenhum dado do GitLab além do já lido pela P1.
15. Se o comentário do Reprovar ou qualquer texto vindo do GitLab trouxer HTML ou marcação, a Esteira não deve devolvê-lo como HTML nem gravá-lo em log, e o front deve mostrá-lo como texto.
16. Enquanto `Features:P2` estiver ausente ou desligado, a Esteira não deve responder as três rotas (404), os campos novos devem vir vazios e o front não deve mostrar botão nem seção de Ações.
17. A P2 não deve fazer nenhuma chamada de escrita ao GitLab: a porta `IGitLab` continua só de leitura.
18. Quando uma Fatia Em revisão é mostrada a quem pode decidir, o front deve oferecer **Abrir review**, **Reprovar** e **Aprovar**, desativando com o motivo no `title` o que a pessoa não pode; **Reprovar** deve exigir o comentário num diálogo e **Aprovar** deve pedir confirmação listando as MRs.
19. Quando a decisão é aceita (202) ou recusada com erro de negócio, o front deve mostrar o estado na linha ou o erro no diálogo e atualizar a lista, sem oferecer nova decisão enquanto `decisao` ≠ `nenhuma`.

## Testes
Todo teste leva a marca `P2` (`docs/agents/orchestration.md`, "Marca da fatia nos testes"). Os testes da P1 que afirmam "nenhum botão de ação" (critério 19 da P1) passam a valer com `Features:P2` desligado e ganham a marca `P2` também.
- **Domain/Application** (xUnit, NSubstitute para `IGitLab`): um teste por critério 1–11 e 13–15; transições da `AcaoBot` em tabela (11); regras de recusa por estado da Fatia, CI e papel (3, 5, 6, 9); dependência API → front (10); derivação de `podeAbrirReview`/`podeAprovar`/`podeReprovar` e do `review`/`decisao` (12).
- **Integração** (Testcontainers + PostgreSQL, Redis, RabbitMQ/outbox): migration e unicidade da chave de idempotência (7), decisão, auditoria e linha de outbox na mesma transação (1, 2, 4), serviço de progresso descarta o instantâneo (11), releitura sem o guardado (8), duplo clique concorrente cria uma Ação só (7).
- **API** (sessão simulada, `IGitLab` falso): 404 sem papel, 403 sem operação, 202 e corpo das três rotas, flag desligado (9, 16), contrato OpenAPI das rotas e campos novos, e que `IGitLab` não tem método de escrita (17).
- **Frontend** (Vitest + Testing Library): linha e gaveta (botões, motivo no `title`, estados de review e decisão, link do review, seção Ações), diálogos de Aprovar e Reprovar (comentário obrigatório e contador), erros de negócio no diálogo, comentário com marcação mostrado como texto (15), flag desligado sem botão (16, 18, 19).
- **E2E** (Playwright, API simulada, tag `@P2`): MOR abre o Painel, abre review de uma Fatia (vê "review pedido" e depois o link), reprova com comentário, aprova uma `api + frontend` com CI verde e vê "aprovação pedida"; Aprovar desativado com CI vermelho; Membro vê Abrir review e não vê decidir; axe-core sem violação AA nos diálogos e na gaveta.

## Checklist de entrega (fora dos critérios)
- [ ] `docs/mudancas-infra.md`, item 2: corrigir "`api` a partir da P2" para "a partir da P2b" (a P2 não escreve no GitLab); a spec da P1 já diz P2b.
- [ ] `docs/design/prototipos/`: acrescentar os diálogos de Aprovar e Reprovar ao `prototipo-painel-fatias.html` (ou registrar no README que o desenho deles nasce no `ui`, com o humano validando na MR).
- [ ] `esteira-frontend/docs/PENDENCIAS.md`: a pendência do build `preview` ("quando a P2 ligar o preview") passa a apontar para a P2b.
