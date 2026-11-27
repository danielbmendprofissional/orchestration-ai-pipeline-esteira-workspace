# 02 — Tela da Entrega: Etapas por Fluxo, estados e ao vivo

risco: alto   <!-- altera o `esteira-abrir` (caminho que autoriza publicar), grava estado novo vindo do webhook público, migração de banco nova e leitura autorizada por Aplicação -->
base: workspace@0a78d47 · esteira-api@f7785c7 · esteira-frontend@9bf7ea9 · 2026-11-27
flag: sim   <!-- `Features:E1b`: desligado, a rota `/entregas/:id` nem casa e o `esteira-abrir` e o webhook seguem como antes, sem gravar Etapa -->
preview: features/entregas — rota `/entregas/<id de exemplo>`

## Contexto necessário
- CONTEXT-MAP.md (Entrega, Fluxo, Etapa, Artefato, Atalho, Papéis)
- docs/adr/0023-etapas-do-fluxo.md (etapas, "Estados" da Etapa e da Entrega, ordem do estado mais urgente), 0022-fatias-aprovadas-e-fluxo-por-selecao.md, 0011-tempo-real-sse.md, 0013-contrato-da-pipeline.md, 0021-esteira-autoridade-do-processo.md, 0025-refinamentos-nomes-fatia-sem-flag-e-travas.md, 0003-erros.md, 0014-identificadores.md, 0019-feature-flags-e-liberacao.md
- docs/agents/padrao-api.md (erros, identificadores, flags, permissões) · docs/agents/padrao-frontend.md (camadas, flag no front) · esteira-api/CLAUDE.md · esteira-frontend/DESIGN.md
- docs/design/prototipos/prototipo-entrega.html e README.md (Etapas, faixa por Fluxo, pills de estado; **só a parte de leitura**) · docs/design/principios.md
- specs/feature/entrega/01-entrega-e-fluxo.md (agregados, `esteira-abrir`) · specs/feature/tempo-real/01-webhook-e-sse.md (webhook, `pipeline.atualizada`, SSE, `TempoRealService`)
- `../template-ci/docs/contrato-pipeline-v2.md` (`pipeline_id` já vai no corpo do `esteira-abrir`)
- esteira-api/docs/PENDENCIAS.md · esteira-frontend/docs/PENDENCIAS.md

## Ideia
A pessoa abre uma Entrega e vê **uma faixa por Fluxo** com as Etapas **Abertura, QA, HML e PRD**, o estado de cada uma, o estado da Entrega no topo e a mudança ao vivo, sem apertar nada.

**Regra de prova (o que evita estado falso):** a Esteira **guarda** o estado de cada Etapa numa tabela e só o grava a partir de um fato que ela mesma recebeu: a Entrega aberta, uma chamada do `esteira-abrir` (com o `pipeline_id`) ou o status daquela mesma pipeline no webhook. O que ainda não tem quem comprove (deploy confirmado, resultado de análise, aprovação) **não é inventado**: a Etapa fica onde está, e as fatias E2, E3 e E4 passam a gravá-lo pelo mesmo método de transição, sem mudar o modelo.

Fica de **fora** (e em qual fatia entra):
- Abrir a Entrega pela tela, lista paginada de Entregas e item de menu → **E1a**. A tela da E1b abre por `/entregas/:id`.
- Botões de **Aprovar, Reprovar e Atalho**, papel por Etapa e estado **Aguardando aprovação** vindo de aprovação → **E3**. **Bloqueada** (gate de segurança), análises e achados na tela → **E2**.
- **Em fila, Superado**, deploy por Destino, ocupação visível e **Concluído** do QA e do HML → **E4**. **Em rollback** e **Cancelada** → **E6**. Versão calculada (`X.Y.Z`) → **E4b**.
- **Liberação** (célula da Etapa, Liberar e Excluir Fatias) → **E7**: a célula só aparece quando houver quem a grave.
- **Linha do tempo / histórico**: não existe na tela (decisão D0: histórico só na Auditoria). A tela só traz o link "ver na auditoria", que aparece quando a **X1** existir (`Features:X1` ligado); até lá, nada.
- Notas de entrega e Conferência de escopo → fatias próprias. Hotfix → **E3c**.

## Dados
Migration **expand-only** (tabela nova), schema `esteira`. `Id` (long) e `PublicId` (Guid v7).

`EtapaFluxo`: `FluxoId`, `Etapa` (`abertura`, `qa`, `hml`, `prd`), `Estado` (`nao-iniciado`, `executando`, `aguardando-aprovacao`, `concluido`, `pulada`, `falhou`), `PipelineGitLabId` (long, nulo), `CodigoFalha` (nulo), `PuladaPor` (até 200) e `PuladaMotivo` (até 1000), ambos nulos, `UltimoEventoEm` (data do último evento aplicado), `AtualizadaEm`. Índice único `FluxoId+Etapa`; token de concorrência otimista (`xmin`). Os estados `bloqueada`, `cancelado` ficam fora até as fatias que os decidem; o enum cresce com elas.

Na migration, cada Fluxo já existente ganha as 4 linhas (`abertura` em `concluido`, as outras em `nao-iniciado`): nada é deduzido do passado.

## Backend
Em `Esteira.Domain/Entregas` (Etapa, transições, estado da Entrega), `Esteira.Application/Entregas` (leitura, aplicador de pipeline), `Esteira.Application/Eventos` (webhook e evento), `Esteira.Data` (mapeamento, migration, leitura) e `Esteira.Api` (rota). Tudo atrás de `Features:E1b` (desligado = o `esteira-abrir` e o webhook não gravam Etapa e a rota nem casa).

**`EtapaFluxo` (domínio)** é a única que muda o `Estado`, por métodos nomeados que devolvem `Result` e recusam transição fora da tabela:

| Fato | Etapa | Transição |
|---|---|---|
| `Entrega.Abrir` | `abertura` | nasce `concluido`; as outras nascem `nao-iniciado` |
| `esteira-abrir` `fluxo`+`qa` aceito | `qa` | `nao-iniciado`, `falhou`, `executando` ou `aguardando-aprovacao` → `executando`, guardando o `pipeline_id` |
| `esteira-abrir` `promocao`+`hml` aceito | `hml` | idem |
| `esteira-abrir` `promocao`+`production` aceito | `prd` | idem |
| `esteira-abrir` `fluxo`+`production` (Atalho) aceito | `qa` e `hml` → `pulada` com `PuladaPor`/`PuladaMotivo`; `prd` → `executando` | só a partir de `nao-iniciado`; uma Etapa já em outro estado fica como está |
| Webhook: status da pipeline guardada na Etapa | qa / hml | `success` → `aguardando-aprovacao`; `failed` → `falhou` (`pipeline.falhou`); `canceled` → `falhou` (`pipeline.cancelada`); `created`/`pending`/`running`/outros → sem mudança |
| Webhook: idem | prd | `success` → `concluido`; `failed`/`canceled` como acima |

Estado que a tabela não prevê é no-op com log (sem corpo), **nunca** erro para quem chamou: a Etapa é só exibição e jamais recusa o `esteira-abrir` nem o webhook. O webhook só aplica o evento se o `finished_at` dele (ou, sem ele, a hora do recebimento) for **posterior** a `UltimoEventoEm`; evento mais velho é descartado.

**`esteira-abrir`** (`AbrirPipelineHandler`): depois de aceitar a chamada (passos 1 a 8 do E1), aplica a linha da tabela acima **na mesma gravação** do SHA e da ocupação, e publica `entrega.atualizada` **depois** do commit. `atalho_por` até 200 e `atalho_motivo` até 1000 caracteres; acima disso → `422 pipeline.corpo-invalido` (mesmo código do E1). `pipeline_id` ausente ou não numérico: a Etapa fica `executando` sem id (não casa com webhook; fica assim até a próxima chamada).

**Webhook** (`TratadorDeWebhookGitLab`, `Pipeline Hook`): além do que a T1 já faz, procura a `EtapaFluxo` com **`PipelineGitLabId` = id da pipeline e Fluxo do mesmo Projeto** e aplica a tabela. Casa só por id da pipeline **e** Projeto, nunca por SHA ou ref (a mesma `main` pode ter outras pipelines no mesmo SHA). Sem Etapa correspondente: nada muda. Conflito de concorrência: relê e reaplica uma vez; segue sem erro. Publica `entrega.atualizada` depois do commit.

**Estado da Entrega** (domínio, calculado, nunca gravado): sobre as Etapas dos Fluxos, na ordem da ADR-0023, o **primeiro que valer**: `bloqueada-ou-falha` (alguma Etapa `falhou`), `aguardando-aprovacao` (alguma `aguardando-aprovacao`; a resposta traz `vezDe`: `aprovador-tecnico` para qa/hml), `em-andamento` (Situação `aberta`). Os demais estados da ADR entram com as fatias que os decidem (E3, E4, E6, E7).

**`GET /api/v1/entregas/{id}`** (Sessão, `Features:E1b`): `{ id, aplicacao{ id, nome }, abertaPor{ nome }, abertaEm, estado, vezDe, fluxos: [{ id, projeto{ id, nome }, tipoMudanca, sha, fatias: [{ codigo, comFlag }], etapas: [{ etapa, estado, codigoFalha, pulada{ por, motivo }, pipelineUrl, atualizadaEm }] }] }`. `pipelineUrl` é montada no servidor com `GitLab:Url` + caminho do Projeto + `pipeline_id` (nulo sem id). Quem pode ver: papel qualquer na Aplicação da Entrega ou MOR (`AcessoAplicacao.Pode(Ver)`); Entrega inexistente **ou** sem acesso → o mesmo `404 entrega.nao-encontrada` (não revela existência). Corpo só com dados da Esteira e o texto `PuladaPor/PuladaMotivo` informado pela pipeline (escapado no front).

**Evento** `entrega.atualizada` (`aplicacaoId`, `entregaId`, `fluxoId`, `etapa`, `estado`): só identificadores e estado, como o resto do tempo real (T1). O front recarrega a Entrega ao receber o do `entregaId` em tela.

**Concorrência:** a gravação da Etapa pelo `esteira-abrir` e pelo webhook pode chegar junta; o token (`xmin`) garante uma gravação por vez e a perdedora reaplica sobre o estado atual, sem 500 e sem regredir estado terminal por evento mais velho.

## Frontend
Em `features/entregas` (página, serviço de API, serviço de estado, componentes) e `core/tempo-real` (o tipo do evento novo e o nome em `TIPOS_DE_EVENTO`). Camadas do `padrao-frontend.md`.

- **Rota `/entregas/:id`** atrás de `featureGuard` (`Features:E1b`; flag desligado = Não encontrado). Sem item de menu (o menu "Entregas" é da E1a).
- **Página:** cabeçalho com Aplicação, aberta por e quando, e o **estado da Entrega** (ícone + texto, nunca só cor; com `vezDe` em texto quando houver). Embaixo, **uma faixa por Fluxo** com o Projeto, o tipo da mudança, o SHA curto e a barra das Etapas **Abertura → QA → HML → PRD**, cada uma com ícone e texto do estado (estilo GitHub Actions, `prototipo-entrega.html`). Clicar numa Etapa abre o painel dela: estado, link para a pipeline no GitLab (`pipelineUrl`), código da falha traduzido, e `Pulada por <nome> — <motivo>`; as Fatias do Fluxo com a marca de flag. **Sem botões de ação** nesta fatia.
- **Ao vivo:** usa o `TempoRealService` da T1: ao chegar `entrega.atualizada` do `entregaId` em tela, recarrega **uma** vez (rajada em 1 s vira uma). Em `consulta` (SSE caído, 429 ou `Features:T1` desligado) recarrega a cada 30 s e mostra "Atualização a cada 30 s"; indicador "Ao vivo" / "Reconectando…" com `aria-live="polite"` só na troca. Reconectou → recarrega uma vez.
- **"ver na auditoria"**: link para a Auditoria filtrada pela Entrega, só renderizado com `Features:X1` ligado.
- **Estados da tela:** carregando, erro (com "Tentar de novo"), 404 ("Entrega não encontrada ou sem acesso"), uma Entrega sem Fluxo não existe (domínio proíbe).
- **Preview:** a sessão falsa e dados falsos tipados pelo contrato OpenAPI, com um cenário por estado (abertura concluída e QA executando; HML aguardando aprovação; QA falhou; Atalho com QA/HML pulados e PRD concluído), e o botão de desenvolvimento da T1 emitindo `entrega.atualizada` falso.
- **Acessibilidade e responsividade:** de 2560 a 320 px (faixa vira lista vertical em ≤760 px), foco visível, leitor de tela lê "QA: executando", axe sem violação.
- **Testes marcados** com `[E1b]` (Vitest) e `@E1b` (Playwright + axe).

## Infra
Sem pedido novo: nenhuma chave nova (`GitLab:Url` e o tempo real já existem). O flag `Features:E1b` entra na configuração como os demais.

## Critérios (EARS)
1. Quando uma Entrega é aberta, a Esteira deve criar para cada Fluxo as 4 Etapas: `abertura` `concluido` e `qa`, `hml`, `prd` `nao-iniciado`.
2. Quando o `esteira-abrir` aceita `fluxo` em `qa`, `promocao` em `hml` ou `promocao` em `production`, a Esteira deve pôr a Etapa correspondente em `executando`, guardar o `pipeline_id` e publicar `entrega.atualizada` depois do commit.
3. Quando o `esteira-abrir` aceita `fluxo` em `production` (Atalho), a Esteira deve pôr `qa` e `hml` em `pulada` com quem ordenou e o motivo, e `prd` em `executando`; Etapa que já saiu de `nao-iniciado` não deve ser sobrescrita.
4. Se `atalho_por` passa de 200 ou `atalho_motivo` de 1000 caracteres, a Esteira deve recusar (`pipeline.corpo-invalido`) sem gravar nada.
5. Quando o webhook traz a pipeline guardada numa Etapa de `qa` ou `hml` com status `success`, a Esteira deve pô-la em `aguardando-aprovacao`; em `prd`, com `success`, em `concluido`.
6. Quando o webhook traz essa pipeline com `failed` ou `canceled`, a Esteira deve pôr a Etapa em `falhou` com `pipeline.falhou` ou `pipeline.cancelada`; status intermediário não deve mudar a Etapa.
7. Se o webhook traz uma pipeline que nenhuma Etapa do mesmo Projeto guardou (inclusive outra pipeline no mesmo SHA), a Esteira não deve alterar nenhuma Etapa.
8. Se o evento do webhook é mais velho que o último já aplicado à Etapa, a Esteira deve descartá-lo, sem regredir o estado.
9. Se uma transição não está na tabela (por exemplo `concluido` → `executando`), a Esteira deve manter o estado e responder normalmente ao `esteira-abrir` e ao webhook, nunca com erro por causa da Etapa.
10. Se o `esteira-abrir` e o webhook gravam a mesma Etapa ao mesmo tempo, a Esteira deve aplicar as duas em ordem, sem 500 e sem perder o `pipeline_id`.
11. Enquanto `Features:E1b` está desligado, a Esteira não deve gravar Etapa nem expor `GET /api/v1/entregas/{id}`.
12. Quando uma pessoa com papel na Aplicação (ou MOR) pede `GET /api/v1/entregas/{id}`, a Esteira deve devolver a Entrega com Fluxos, Etapas, `estado` da Entrega e `pipelineUrl`; sem sessão deve responder 401.
13. Se a Entrega não existe ou a pessoa não tem papel na Aplicação dela, a Esteira deve responder `404 entrega.nao-encontrada`, igual nos dois casos.
14. O estado da Entrega deve ser `bloqueada-ou-falha` se alguma Etapa `falhou`; senão `aguardando-aprovacao` (com `vezDe: aprovador-tecnico`) se alguma Etapa espera; senão `em-andamento`.
15. Quando uma Etapa muda, a Esteira deve publicar `entrega.atualizada` só com identificadores e estado, apenas para as pessoas com acesso à Aplicação, e nunca antes do commit.
16. Com `Features:E1b` ligado, a página deve mostrar uma faixa por Fluxo com as Etapas Abertura, QA, HML e PRD, cada uma com ícone e texto do estado, e o estado da Entrega no topo; com o flag desligado a rota deve cair em Não encontrado.
17. Quando chega `entrega.atualizada` do `entregaId` em tela, a página deve recarregar uma vez (rajada em 1 s vira uma recarga) e o painel da Etapa aberta deve mostrar o novo estado sem fechar.
18. Se o SSE cai, a página deve recarregar a cada 30 s, mostrar "Atualização a cada 30 s" e, ao reconectar, recarregar uma vez e voltar a "Ao vivo".
19. A página deve escapar `PuladaPor` e `PuladaMotivo`, não deve mostrar botão de ação e só deve mostrar "ver na auditoria" com `Features:X1` ligado.

## Testes
Todo teste leva a marca `E1b` (formato por stack em `docs/agents/orchestration.md`, "Marca da fatia nos testes").
- **Domain** (`Esteira.Domain.Tests`): tabela de transições da `EtapaFluxo`, uma linha por fato (1, 2, 3, 5, 6, 9); evento mais velho (8); estado da Entrega por combinações de Etapas (14).
- **Application** (`Esteira.Application.Tests`, portas falsas): `esteira-abrir` grava Etapa e publica depois do commit (2, 3, 4); webhook casa por pipeline e Projeto, nunca por SHA (7); flag desligado (11); leitura com acesso, 404 uniforme (12, 13); conteúdo do evento (15).
- **Integration** (`Esteira.Integration.Tests`, PostgreSQL real, schema pelas migrations): migration só cria tabela e preenche as Etapas dos Fluxos existentes (1); índice único `FluxoId+Etapa`; `esteira-abrir` e webhook simultâneos na mesma Etapa, com barreira, sem 500 (10); evento mais velho não regride (8).
- **API/HTTP** (host de teste): `GET /entregas/{id}` com sessão falsa, MOR, outra Aplicação, sem sessão (12, 13); fluxo ponta a ponta `esteira-abrir` → webhook `success` → leitura mostra `aguardando-aprovacao` (2, 5, 12); 422 do limite do Atalho (4); `pipelineUrl` sem segredo.
- **Front** (Vitest): serviço de estado com signals, recarga única por rajada, 30 s em `consulta` (17, 18); componentes da faixa e do painel por estado (16); escape do texto, ausência de botões, link da auditoria só com X1 (19).
- **E2E + axe** (Playwright, preview estático, rota `/entregas/<id>`): um cenário por estado, evento de desenvolvimento muda a Etapa, sem violação de acessibilidade (16, 17).
- **Segurança:** o `security` roda sobre a fatia inteira (`risco: alto`), com foco em 404 uniforme (enumeração), escape do texto da pipeline e em não regredir o `esteira-abrir`.
