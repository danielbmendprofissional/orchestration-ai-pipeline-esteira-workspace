# 02 — Teto de custo dos agentes por Aplicação

risco: baixo   <!-- uma coluna nullable (expand-only), uma rota só de MOR e um campo aditivo na resposta do `esteira-abrir`; nenhuma auth, sessão, segredo nem dependência nova -->
flag: sim   <!-- Features:X3 — gateia a rota de edição e o campo no cadastro; o campo do `esteira-abrir` é aditivo e sempre presente (como o `destinos` da E1) -->
preview: features/aplicacoes — rota `/aplicacoes/:id` (aba Cadastro)
base: workspace@c037380 · esteira-api@133597a · esteira-frontend@8a08cf3 · 2026-11-28

## Contexto necessário
- CONTEXT-MAP.md (Aplicação, Papéis)
- docs/adr/0012-agentes-no-ci.md (teto de custo por execução, por Aplicação), 0017-execucao-no-claude-code.md (runner usa Claude Code CLI via OmniRoute, nunca a assinatura), 0013-contrato-da-pipeline.md, 0019-feature-flags-e-liberacao.md, 0003-erros.md, 0016-schema-esteira.md
- docs/agents/padrao-api.md (permissões, flags, erros) e padrao-frontend.md (camadas, flags, preview)
- specs/feature/aplicacoes/01-cadastro-aplicacao.md (Aplicação, `EditarAplicacao`, auditoria, `/permissoes`) · specs/feature/entrega/01-entrega-e-fluxo.md (resposta do `esteira-abrir`)
- docs/mudancas-template.md item 8 (o `agent-runner` respeita o teto devolvido pelo `esteira-abrir`) · `../template-ci/docs/contrato-pipeline-v2.md` (tabela da resposta)
- esteira-api/docs/PENDENCIAS.md · esteira-frontend/docs/PENDENCIAS.md

## Ideia
Cada Aplicação passa a ter um **teto de custo por execução de agente do CI** (code-review, security e qa, ADR-0012), em US$. É um valor só, vale para os três agentes. O MOR o edita no Cadastro da Aplicação; a Aplicação que não definir nada usa o **padrão da Esteira** (configuração `Pipeline:TetoCustoPadraoUsd`, padrão 2.00), então a resposta do `esteira-abrir` sempre traz um número: agente do CI nunca roda sem teto.

O teto **não** limita o uso local de ninguém (`/fatia`, `/implement-task`, plano do Claude Code): só os agentes que a pipeline roda com chave de cliente do OmniRoute (ADR-0017). A Esteira guarda e devolve o número; **quem o aplica é o `agent-runner` do template** (item 8, fora do mapa). Com combo gratuito o custo real é zero e o teto é só rede de segurança.

Fica de **fora**: um teto por agente (a ADR fala de um só); o `agent-runner` e qualquer medição de gasto real (item 8 do template); o resultado dos agentes e o gate (E2); histórico de gasto.

## Dados
Migration **expand-only** no schema `esteira` (ADR-0016): uma coluna nova em `Aplicacao`.

| Coluna | Tipo | Regras |
|---|---|---|
| `TetoCustoAgentesUsd` | `numeric(6,2)` nulo | `null` = usa o padrão da Esteira. Preenchida: entre 0.10 e 50.00, duas casas. `CHECK` no banco com a mesma faixa |

`AplicacaoEntity` ganha `TetoCustoAgentesUsd` (`decimal?`, `private set`) e `DefinirTetoCusto(decimal? valor)` (`Result`: `aplicacao.teto-invalido` fora da faixa ou com mais de 2 casas; `null` restaura o padrão). Não muda `Criar` nem `Alterar`.

## Backend
Em `Esteira.Domain/Aplicacoes`, `Esteira.Application/Aplicacoes/Commands/DefinirTetoCusto`, `Esteira.Data/Aplicacoes` e `Esteira.Api`.

- **Rota** `PUT /api/v1/aplicacoes/{id}/teto-custo`, corpo `{ "tetoCustoUsd": 2.50 }`; `null` (ou campo ausente) restaura o padrão. Só **MOR** (nova `OperacaoAplicacao.EditarTetoCusto`, ou reuso de `EditarAplicacao`: só MOR). Atrás de `[FeatureFlag("X3")]` além do `A1` do controller (mesmo desenho do `P1.2`, workspace): flag ausente ou desligado → 404. Sem papel na Aplicação → 404; com papel e sem ser MOR → 403 `acesso.papel-insuficiente`. Resposta: `{ tetoCustoUsd, padraoUsd, efetivoUsd }`.
- **Detalhe da Aplicação** (`GET /aplicacoes/{id}`) ganha `tetoCusto: { tetoCustoUsd (nulo se não definido), padraoUsd, efetivoUsd }` e `/permissoes` ganha `podeEditarTetoCusto` (MOR). O front só lê.
- **Padrão da Esteira:** `IOpcoesDosAgentes.TetoCustoPadraoUsd`, lida de `Pipeline:TetoCustoPadraoUsd` a cada uso; ausente, não numérica ou fora da faixa 0.10–50.00 → 2.00 (nunca erro, nunca zero, nunca "sem teto"). Não é segredo, não entra na infra.
- **`esteira-abrir`:** a resposta ganha o campo aditivo `teto_custo_usd` (número) com o teto **efetivo** da Aplicação dona do Fluxo, em **todo** `process`/`env` suportado. Nova porta de leitura `ITetoCustoDaAplicacaoQuery` (por `AplicacaoId` da Entrega) em `Application/Entregas/Pipeline`; o handler a consulta no passo 9, junto dos Destinos. Não depende do flag `X3`: o contrato máquina-a-máquina é sempre completo, o flag só esconde a edição. O cliente v3 atual ignora campos que não conhece. O contrato do template (`contrato-pipeline-v2.md`) ganha uma linha na tabela da resposta pela issue `/issue-ai` no template-ci, no fim desta fatia.
- **Auditoria:** a alteração grava `RegistroAuditoria` (`Aplicacao`, `alterou`, antes/depois do teto) na mesma transação.
- **Concorrência:** o único caminho de escrita é `PUT teto-custo` (handler `DefinirTetoCustoHandler` → `repositorio` → `SaveChanges`). `AplicacaoEntity` tem token de concorrência; duas gravações simultâneas na mesma Aplicação resultam em uma aceita e a outra recusada com `aplicacao.conflito-de-gravacao` (409), nunca 500. O `esteira-abrir` só lê.

## Frontend
Feature `features/aplicacoes/`; sem rota nova. `isEnabled('X3')` (ausente = desligado, `public/features.json` em dev com `"X3": true`).

- **Aba Cadastro** (`aplicacao-detalhe.page.ts`): com o flag ligado, uma linha "Teto de custo dos agentes (US$ por execução)" mostra o valor efetivo e a marca "padrão da Esteira" quando não definido; botão "Alterar teto" só se `podeEditarTetoCusto`. Edição em **gaveta**, como no resto da feature: campo numérico (2 casas), botão "Usar padrão da Esteira", texto explicando que vale só para os agentes do CI e não limita o uso pessoal. Erros da API (`aplicacao.teto-invalido`, 409) aparecem no campo.
- **Camadas:** `aplicacoes-api.service.ts` (+ versão `preview`), `aplicacoes.service.ts` (estado, `definirTetoCusto`), componente `teto-custo-campo.component.ts` ao lado do `workspace-campo`. Tipos gerados do OpenAPI (`generate:api-types` depois da API).
- **Preview:** sessão falsa (MOR) e duas Aplicações, uma com teto definido e outra no padrão, tipadas pelos tipos gerados.

## Infra
N/A (configuração não secreta `Pipeline:TetoCustoPadraoUsd` e flag `Features__X3` no Ambiente, nascendo desligado em produção; nenhuma chave de contrato nova). Ao fim da fatia: issue no `template-ci` (`/issue-ai`) para documentar `teto_custo_usd` no contrato; o consumo pelo `agent-runner` é do item 8 (já listado).

## Critérios (EARS)
1. Quando um MOR define o teto de uma Aplicação com valor entre 0.10 e 50.00 com até 2 casas, a Esteira deve gravá-lo e devolver `{ tetoCustoUsd, padraoUsd, efetivoUsd }` com o efetivo igual ao definido.
2. Se o valor for menor que 0.10, maior que 50.00, tiver mais de 2 casas ou não for número, a Esteira deve recusar (`aplicacao.teto-invalido`) e não gravar nada.
3. Quando o MOR envia `null` (ou omite o campo), a Esteira deve voltar a Aplicação ao padrão da Esteira (coluna nula).
4. Se quem chama tem papel na Aplicação mas não é MOR, a Esteira deve recusar com 403 (`acesso.papel-insuficiente`); sem papel e sem ser MOR, 404.
5. Enquanto `Features:X3` estiver ausente ou desligado, a Esteira não deve responder `PUT .../teto-custo` (404) e o front não deve mostrar o campo nem o botão.
6. Quando o teto é alterado, a Esteira deve registrar quem, quando e o antes/depois na mesma transação.
7. Enquanto a Aplicação não tem teto definido, a Esteira deve usar o padrão `Pipeline:TetoCustoPadraoUsd`; se essa configuração faltar ou estiver inválida (ausente, não numérica, fora de 0.10–50.00), deve usar 2.00.
8. Quando o `esteira-abrir` responde 200, a resposta deve trazer `teto_custo_usd` com o teto efetivo da Aplicação dona do Fluxo, em `fluxo` (`qa` e `production`) e em `promocao` (`hml` e `production`), com `X3` ligado ou desligado.
9. Se o `esteira-abrir` é recusado (4xx), a resposta não deve trazer `teto_custo_usd`.
10. Quando o front pede as permissões, a Esteira deve devolver `podeEditarTetoCusto` pela mesma regra da rota de alteração, e o front só exibe a ação permitida.
11. Se duas requisições simultâneas alteram o teto da mesma Aplicação (`PUT teto-custo`), a Esteira deve aceitar uma e recusar a outra com `aplicacao.conflito-de-gravacao` (409), nunca 500.
12. Enquanto a migration é aplicada sobre dados existentes, a Esteira deve manter toda Aplicação já cadastrada com teto nulo (padrão) e nenhuma outra coluna alterada.

## Testes
Todo teste leva a marca `X3` (`docs/agents/orchestration.md`, "Marca da fatia nos testes").
- **Domain** (`Esteira.Domain.Tests`): `DefinirTetoCusto` nos limites 0.10 e 50.00, abaixo, acima, 3 casas, `null` (1, 2, 3).
- **Application** (`Esteira.Application.Tests`): `DefinirTetoCustoHandler` com papéis e auditoria (1, 3, 4, 6); `IOpcoesDosAgentes` com ausente/inválido/fora da faixa → 2.00 (7); `AbrirPipelineHandler` devolve o teto efetivo em cada combinação `process`/`env` e não o devolve em recusa (8, 9); `/permissoes` (10).
- **Integração** (`Esteira.Integration.Tests`, PostgreSQL real): `CHECK` da faixa no banco e `numeric(6,2)`; corrida de dois `PUT` com barreira → um 200 e um 409 (11); migration só adiciona a coluna e preserva Aplicações existentes (12); leitura do teto pela porta `ITetoCustoDaAplicacaoQuery`.
- **API/HTTP** (sessão simulada e emissor JWKS falso): flag desligado → 404 e ligado → 200 (5); 403 e 404 por papel (4); `esteira-abrir` ponta a ponta com `teto_custo_usd` e OpenAPI `pipeline-v2` com o campo (8).
- **Frontend** (Vitest + Testing Library, `describe('[X3] …')`): domain service e `teto-custo-campo`; campo escondido com o flag desligado e ação escondida sem permissão (5, 10); erro da API no campo (2, 11).
- **E2E** (Playwright, API simulada, `@X3`): MOR altera o teto e volta ao padrão; só-analista não vê "Alterar teto"; axe-core sem violação AA na aba Cadastro e na gaveta.
