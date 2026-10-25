# Specs — Esteira

Cada fatia é `specs/feature/<área>/NN-nome.md` (fonte de verdade) + uma issue-mãe no `esteira-workspace` apontando pro arquivo. Formato: o mesmo do Valuto — `## Contexto necessário` no topo, depois Ideia · Dados · Backend · Frontend · Infra · Testes, critérios em EARS. Seção que não se aplica é dita "N/A" explicitamente.

## Fases

1. **Bootstrap + limpeza** — back: 00 (adequação do ambiente) → M0 (esqueleto) → B2 → B1 → B3 · front: F0 → F0.5. B2/B1 vêm depois da M0 para serem aplicadas sobre o esqueleto, não sobre handlers que a M0 apaga; B1 depois da B2 porque a lista paginada nasce como `Result`.
   - Status de cada fatia: coluna **Status** da tabela abaixo (a fatia 00 não tem linha: fundação, já em `dev` da `esteira-api`). Mantida pelo `/fatia` a partir do git.
2. **Definição do design** — D0.
3. **Features** — A1 → E1 → E5, cada uma com spec → tickets → TDD → review.

A arquitetura do backend para o modelo novo (agregados, orquestração com o GitLab, tempo real) é decidida antes da M0 — ver ADRs a partir da 0009.

## Mapa de fatias

O discovery e as decisões já estão feitos (`docs/adr/` e `CONTEXT-MAP.md`). A **spec de cada fatia** é escrita só quando chega a vez dela, porque cita o código que a anterior deixou em `dev`: `/fatia <código>` (ou `/to-spec`) lê as ADRs e o código e só pergunta o que nenhum deles responde — o `/grill-with-docs` separado só entra se a fatia ainda for ideia solta. `/proximo` diz qual é a próxima e o que ela cobre.

| Status | # | Fatia | Repositório | Quem executa | Depende de | Toca em (estimado) |
|---|---|---|---|---|---|---|
| feito | B1 | Paginação `X-*` (ADR-0002) — [`base/03-paginacao.md`](feature/base/03-paginacao.md) · #3 | api | `/implement-task` (`backend`, `review`) | M0, B2 | api:comum (paginação) |
| feito | B2 | Result pattern + Problem Details (ADR-0003) — [`base/02-result-e-problem-details.md`](feature/base/02-result-e-problem-details.md) · #2 | api | `/implement-task` (`backend`, `review`) | M0 | api:comum (Result, erros) |
| — | B3 | Sessão BFF: login/callback/refresh/logout/`me` (ADR-0004) — [`base/04-sessao-bff.md`](feature/base/04-sessao-bff.md) · #12 | api + infra | `/implement-task` + agent `local-environment-config` (realm, Redis) | B2 | api:sessão · infra:keycloak,redis |
| feito | F0 | Bootstrap do frontend (ADR-0005/0006) | frontend | **Claude Code** (decisão de infra: runner, tema, nginx, CI) | — | front:bootstrap, ci |
| — | F0.5 | Shell + sessão compartilhada + interceptors + guards | frontend | `/implement-task` (`front`, `ui`, `security`, `review`) | F0, B3 (ponta a ponta) | front:shell, sessão |
| feito | D0 | Design system real (`/impeccable init`, tokens no `styles.css` para Tailwind + spartan, ADR-0015) | frontend | Claude Code + skills de design | F0 | front:design (tokens, tema) |
| feito | M0 | Esqueleto: remove as features do sistema legado, IDs `long`+GUID, outbox com tabela, migration base — [`base/01-esqueleto-do-modelo.md`](feature/base/01-esqueleto-do-modelo.md) | api | `/implement-task` (`data`, `backend`, `review`) | 00 | api:domínio, db |
| — | A1 | Cadastro: Aplicação → Projetos → Ambientes → Destinos, política de severidade, papéis — [`aplicacoes/01-cadastro-aplicacao.md`](feature/aplicacoes/01-cadastro-aplicacao.md) | api + frontend | `/implement-task` | B1, B2, B3, F0.5, M0 | api:domínio · front:cadastro |
| — | E1 | Entrega + Fluxo + linha do tempo (tela única da Entrega) + `esteira-abrir`/`gate`/`resultado` em modo **gatekeeper** (tags ainda cortadas à mão) | api + frontend + template | `/implement-task` + mudanças no template (`docs/mudancas-template.md` 1–3) | A1 | api:domínio · front:entrega · template-ci |
| — | E2 | Análises (da Candidata / do Deploy), achados, Exceções | api + frontend | `/implement-task` | E1 | api:domínio · front:análises |
| — | E3 | Aprovações (AET-1, candidata, AAN, AET-2, Publicar) + caixa de pendências + e-mail | api + frontend + infra | `/implement-task` + agent `local-environment-config` (SMTP) | E2 | api:domínio · front:aprovações · infra:smtp |
| — | E4 | Orquestração pelo bot: cortar rc, promover, sincronizar, cancelar, rollback | api + frontend + template | `/implement-task` + template (4.0, 4.1, 7) | E3 | api:orquestração · front:entrega · template-ci |
| — | E5 | Notas de entrega | api + frontend + template | `/implement-task` + template (5.1) | E4 | api:notas · front:entrega · template-ci |

B2 (depois da M0, seguida da B1) e F0 podem rodar em paralelo (sessões do Claude Code separadas no Alethe).

**Paralelismo:** duas fatias só rodam juntas se "Depende de" não as liga **e** "Toca em" não cruza (a coluna é estimativa — confira ao escrever a spec e corrija aqui). Cada uma num painel próprio, em área isolada (`node .claude/scripts/worktree-fatia.mjs B2 <slug>`); o board de issues por label `em-execucao` mostra o que está rodando. `/proximo` lista as que podem rodar agora.

A ordem E1 → E5 vem do discovery de 2026-10-21/22: até E4 a Esteira só **valida** (gatekeeper), daí em diante **executa** — template e Esteira testáveis ponta a ponta já na E1.
