# Specs — Esteira

Cada fatia é `specs/feature/<área>/NN-nome.md` (fonte de verdade) + uma issue-mãe no `esteira-workspace` apontando pro arquivo. Formato: o mesmo do Valuto — `## Contexto necessário` no topo, depois Ideia · Dados · Backend · Frontend · Infra · Testes, critérios em EARS. Seção que não se aplica é dita "N/A" explicitamente.

## Fases

1. **Bootstrap + limpeza** — back: 00 (adequação do ambiente) → M0 (esqueleto) → B2 → B1 → B3 · front: F0 → F0.5. B2/B1 vêm depois da M0 para serem aplicadas sobre o esqueleto, não sobre handlers que a M0 apaga; B1 depois da B2 porque a lista paginada nasce como `Result`.
   - Status de cada fatia: coluna **Status** da tabela abaixo (a fatia 00 não tem linha: fundação, já na `main` da `esteira-api`). Mantida pelo `/fatia` a partir do git.
2. **Definição do design** — D0 (design system e telas do modelo antigo, feito) e **D1** (telas do modelo trunk-based: Painel de Fatias, Abertura por seleção, Entrega com uma faixa por Fluxo, Liberação, Aguardando liberação).
3. **Features** — A1 → P1 → P2 → E1 → E2 → E3 → E4, depois E5, E6, E7, E8 e as transversais X1, X2, O1. Cada uma com spec → tickets → TDD → review.

A arquitetura do backend para o modelo novo (agregados, orquestração com o GitLab, tempo real) é decidida antes da M0 — ver ADRs a partir da 0009. O modelo de processo (Fatia → Entrega → Fluxo → Liberação, trunk-based) está nas ADRs 0018 a 0025.

Os repositórios `esteira-api` e `esteira-frontend` ficam **fora** do esquema de Entrega e Painel de Fatias (ADR-0025): as fatias deste mapa chegam à `main` deles por MR e merge manual.

## Mapa de fatias

O discovery e as decisões já estão feitos (`docs/adr/` e `CONTEXT-MAP.md`). A **spec de cada fatia** é escrita só quando chega a vez dela, porque cita o código que a anterior deixou na `main`: `/fatia <código>` (ou `/to-spec`) lê as ADRs e o código e só pergunta o que nenhum deles responde — o `/grill-with-docs` separado só entra se a fatia ainda for ideia solta. `/proximo` diz qual é a próxima e o que ela cobre.

| Status | # | Fatia | Repositório | Quem executa | Depende de | Toca em (estimado) |
|---|---|---|---|---|---|---|
| feito | B1 | Paginação `X-*` (ADR-0002) — [`base/03-paginacao.md`](feature/base/03-paginacao.md) · #3 | api | `/implement-task` (`backend`, `review`) | M0, B2 | api:comum (paginação) |
| feito | B2 | Result pattern + Problem Details (ADR-0003) — [`base/02-result-e-problem-details.md`](feature/base/02-result-e-problem-details.md) · #2 | api | `/implement-task` (`backend`, `review`) | M0 | api:comum (Result, erros) |
| — | B3 | Sessão BFF: login/callback/refresh/logout/`me` (ADR-0004) — [`base/04-sessao-bff.md`](feature/base/04-sessao-bff.md) · #12 | api + infra | `/implement-task` + agent `local-environment-config` (realm, Redis) | B2 | api:sessão · infra:keycloak,redis |
| feito | F0 | Bootstrap do frontend (ADR-0005/0006) | frontend | **Claude Code** (decisão de infra: runner, tema, nginx, CI) | — | front:bootstrap, ci |
| — | F0.5 | Shell + sessão compartilhada + interceptors + guards | frontend | `/implement-task` (`front`, `ui`, `security`, `review`) | F0, B3 (ponta a ponta) | front:shell, sessão |
| feito | D0 | Design system real (`/impeccable init`, tokens no `styles.css` para Tailwind + spartan, ADR-0015) e protótipos do modelo antigo | frontend | Claude Code + skills de design | F0 | front:design (tokens, tema) |
| feito | M0 | Esqueleto: remove as features do sistema legado, IDs `long`+GUID, outbox com tabela, migration base — [`base/01-esqueleto-do-modelo.md`](feature/base/01-esqueleto-do-modelo.md) | api | `/implement-task` (`data`, `backend`, `review`) | 00 | api:domínio, db |
| — | A1 | Cadastro: Aplicação → Projetos → Ambientes (qa, hml, produção) → Destinos, política de severidade, papéis — [`aplicacoes/01-cadastro-aplicacao.md`](feature/aplicacoes/01-cadastro-aplicacao.md) | api + frontend | `/implement-task` | B1, B2, B3, F0.5, M0 | api:domínio · front:cadastro |
| — | D1 | Design do modelo novo (ADR-0021 a 0025): Painel de Fatias, Abertura da Entrega por seleção, Entrega com uma faixa por Fluxo, Liberação, Aguardando liberação; refaz os protótipos que partiam de issues, candidata e AET | frontend | Claude Code + skills de design (`/design-init`) | A1 | front:design (protótipos) |
| — | P1 | Painel de Fatias: leitor do contrato (mapa, spec, issues, bloco de execução), estados da Fatia, abas e gaveta (ADR-0024, `docs/contrato-leitura-esteira.md`) | api + frontend | `/implement-task` | A1, D1 | api:leitura · front:painel |
| — | P2 | Review e aprovação da Fatia: Abrir review (preview estático), Aprovar (merge na `main`, flag desligado), Reprovar (comenta e fecha a MR); Ações do bot na MR (ADR-0010, 0021, 0022) | api + frontend + template | `/implement-task` + template (`preview`, `fechar-fatia`); bot com escopo `api` (`docs/mudancas-infra.md`, item 2) | P1 | api:ações do bot · front:painel · template-ci |
| — | E1 | Entrega por seleção: Abertura (Fatias, tipo da mudança, travas), Entrega e Fluxo (um por Projeto), contrato `/api/pipeline` v2 e `esteira-abrir` (ADR-0013, 0022, 0023, 0025) | api + frontend + template | `/implement-task` + mudanças no template (`docs/mudancas-template.md` 1–3) | P2 | api:domínio · front:abertura · template-ci |
| — | E1b | Tela da Entrega: uma faixa por Fluxo, etapas, estados da etapa e da Entrega, linha do tempo | api + frontend | `/implement-task` | E1 | api:domínio · front:entrega |
| — | E2 | Análises (do Artefato / do Deploy), achados, Exceções (inclui a em lote), `esteira-gate` e `esteira-resultado` | api + frontend + template | `/implement-task` + template (`docs/mudancas-template.md` 1.1 e 6) | E1 | api:análises · front:análises · template-ci |
| — | E3 | Aprovações do qa, hml e produção (Publicador), Atalho (ordem superior) e hotfix como Entrega de tipo hotfix | api + frontend | `/implement-task` | E2 | api:aprovações · front:aprovações |
| — | E3b | Caixa "Aguardando você" + e-mail | api + frontend + infra | `/implement-task` + agent `local-environment-config` (SMTP) | E3 | api:notificações · front:caixa · infra:smtp |
| — | E4 | Orquestração do Fluxo pelo bot: deploy por Fluxo, ocupação e fila, Superado, confirmação em produção e versão `X.Y.Z` (ADR-0018, 0021, 0023) | api + template | `/implement-task` + template v3 (processos `fluxo`, `promocao`, `rotulo`) | E3b | api:orquestração · template-ci |
| — | E5 | Notas de entrega | api + frontend + template | `/implement-task` + template (5.1) | E4 | api:notas · front:entrega · template-ci |
| — | E6 | Cancelamento (reverter ou absorver) e Rollback por SHA, sem migrations | api + frontend | `/implement-task` | E4 | api:orquestração · front:entrega |
| — | E7 | Liberação e flags: liberar Fatias, controle do flag por job do GitLab (`rollout restart`), detecção de divergência, Aguardando liberação (liberar e excluir), dependência entre Projetos (ADR-0019, 0023, 0025) | api + frontend + template | `/implement-task` + template (`flag`, `liberacao`) | E4 | api:flags · front:liberação · template-ci |
| — | E8 | Fatia sem flag (pré-selecionada e travada), Excluir Fatia, issue de limpeza `<código>-L` e lembrete de dívida de 30 dias (ADR-0023, 0025) | api + frontend | `/implement-task` | E7 | api:fatias · front:painel |
| — | X1 | Auditoria: tela só de leitura e audit trail (antes/depois, bot e pipelines como autores) | api + frontend | `/implement-task` | A1 | api:auditoria · front:auditoria |
| — | X2 | Painel de indicadores da lista de Entregas | api + frontend | `/implement-task` | E4 | api:indicadores · front:entregas |
| — | O1 | Observabilidade e disponibilidade da Esteira (fail-closed: Esteira fora do ar, nada publica): health, alerta e runbook | api + infra | `/implement-task` + agent `local-environment-config` | E4 | api:observabilidade · infra |

D0 (design system) e F0.5/B3 podem rodar em paralelo. B2 (depois da M0, seguida da B1) e F0 também.

**Paralelismo:** duas fatias só rodam juntas se "Depende de" não as liga **e** "Toca em" não cruza (a coluna é estimativa — confira ao escrever a spec e corrija aqui). Cada uma num painel próprio, em área isolada (`node .claude/scripts/worktree-fatia.mjs B2 <slug>`); o board de issues por label `em-execucao` mostra o que está rodando. `/proximo` lista as que podem rodar agora.

**Ordem (ADR-0018 a 0025, trunk-based):** A1 → D1 → P1 → P2 faz a Fatia chegar à `main` pela Esteira; E1 a E3b a fazem **validar** (Entrega, análises, aprovações); a partir da E4 ela **executa** (deploy e versão pelo bot); E5 a E8 completam o ciclo (notas, cancelamento, Liberação, limpeza). Template e Esteira ficam testáveis ponta a ponta já na E1, porque a pipeline do Fluxo só roda por trigger do bot e o `esteira-abrir` recusa sem Entrega aberta.

**Fora do mapa** (repositórios compartilhados, via `pendencias-orchestration-ai.md` e `/issue-ai`): agentes no CI e `tools/agent-runner` (`docs/mudancas-template.md` 5 e 8), backup pré-publicação (4.2 e infra 3), MR referencia issue (9), tag `v3.0.0` do template, clusters k3d e NetworkPolicy.
