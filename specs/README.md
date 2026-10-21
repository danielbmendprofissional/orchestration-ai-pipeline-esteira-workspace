# Specs — Esteira

Cada fatia é `specs/feature/<área>/NN-nome.md` (fonte de verdade) + uma issue-mãe no `esteira-workspace` apontando pro arquivo. Formato: o mesmo do Valuto — `## Contexto necessário` no topo, depois Ideia · Dados · Backend · Frontend · Infra · Testes, critérios em EARS. Seção que não se aplica é dita "N/A" explicitamente.

## Ordem planejada (ainda não escritas — nascem via `/grill-with-docs` → `/to-spec`)

| # | Fatia | Repositório | Quem executa | Depende de |
|---|---|---|---|---|
| B1 | Paginação `X-*` (ADR-0002) | api | `pi` (`backend`, `tests`, `review`) | — |
| B2 | Result pattern + Problem Details (ADR-0003) | api | `pi` | — |
| B3 | Sessão BFF: login/callback/refresh/logout/`me` (ADR-0004) | api + infra | `pi` + agent `local-environment-config` (realm, Redis) | B2 |
| F0 | Bootstrap do frontend (ADR-0005/0006) | frontend | **Claude Code** (decisão de infra: runner, preset, nginx, CI) | — |
| F0.5 | Shell + sessão compartilhada + interceptors + guards | frontend | `pi` (`front`, `ui`, `tests`, `security`, `review`) | F0, B3 (ponta a ponta) |
| D0 | Design system real (`/impeccable init`, preset PrimeNG + Tailwind) | frontend | Claude Code + skills de design | F0 |
| F1 | Lista de fluxos + criar fluxo | api + frontend | `pi` | B1, B2, F0.5 |
| F2 | Detalhe do fluxo: steps-bar + rotas por etapa + avançar etapa | frontend | `pi` | F1 |
| F3 | Deploys do ambiente: cards de severidade + análises + modal de artefatos | frontend | `pi` | F2 |
| A1 | Cadastro de aplicações + variáveis GitLab (ADR-0007) | api + frontend | discovery primeiro | B2 |

B1, B2 e F0 podem rodar em paralelo (sessões `pi` separadas no Alethe).
