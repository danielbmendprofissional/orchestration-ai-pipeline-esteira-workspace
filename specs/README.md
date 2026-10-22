# Specs — Esteira

Cada fatia é `specs/feature/<área>/NN-nome.md` (fonte de verdade) + uma issue-mãe no `esteira-workspace` apontando pro arquivo. Formato: o mesmo do Valuto — `## Contexto necessário` no topo, depois Ideia · Dados · Backend · Frontend · Infra · Testes, critérios em EARS. Seção que não se aplica é dita "N/A" explicitamente.

## Fases

1. **Bootstrap + limpeza** — back: 00 (adequação do ambiente), B1, B2, B3, M0 · front: F0, F0.5.
2. **Definição do design** — D0.
3. **Features** — A1 → E1 → E5, cada uma com spec → tickets → TDD → review.

A arquitetura do backend para o modelo novo (agregados, orquestração com o GitLab, tempo real) é decidida antes da M0 — ver ADRs a partir da 0009.

## Ordem planejada (ainda não escritas — nascem via `/grill-with-docs` → `/to-spec`)

| # | Fatia | Repositório | Quem executa | Depende de |
|---|---|---|---|---|
| B1 | Paginação `X-*` (ADR-0002) | api | `pi` (`backend`, `tests`, `review`) | — |
| B2 | Result pattern + Problem Details (ADR-0003) | api | `pi` | — |
| B3 | Sessão BFF: login/callback/refresh/logout/`me` (ADR-0004) | api + infra | `pi` + agent `local-environment-config` (realm, Redis) | B2 |
| F0 | Bootstrap do frontend (ADR-0005/0006) | frontend | **Claude Code** (decisão de infra: runner, preset, nginx, CI) | — |
| F0.5 | Shell + sessão compartilhada + interceptors + guards | frontend | `pi` (`front`, `ui`, `tests`, `security`, `review`) | F0, B3 (ponta a ponta) |
| D0 | Design system real (`/impeccable init`, preset PrimeNG + Tailwind) | frontend | Claude Code + skills de design | F0 |
| M0 | Limpeza do modelo herdado do sistema legado (sai GMUD/BD/VERSAO/DAST próprio/`POST /api/artefato`; migration base nova) | api | `pi` (`data`, `backend`, `tests`, `review`) | B2 |
| A1 | Cadastro: Aplicação → Projetos → Ambientes → Destinos, política de severidade, papéis — [`aplicacoes/01-cadastro-aplicacao.md`](feature/aplicacoes/01-cadastro-aplicacao.md) | api + frontend | `pi` | B1, B2, B3, F0.5, M0 |
| E1 | Entrega + Fluxo + linha do tempo (tela única da Entrega) + `esteira-abrir`/`gate`/`resultado` em modo **gatekeeper** (tags ainda cortadas à mão) | api + frontend + template | `pi` + mudanças no template (`docs/mudancas-template.md` 1–3) | A1 |
| E2 | Análises (da Candidata / do Deploy), achados, Exceções | api + frontend | `pi` | E1 |
| E3 | Aprovações (AET-1, candidata, AAN, AET-2, Publicar) + caixa de pendências + e-mail | api + frontend + infra | `pi` + agent `local-environment-config` (SMTP) | E2 |
| E4 | Orquestração pelo bot: cortar rc, promover, sincronizar, cancelar, rollback | api + frontend + template | `pi` + template (4.0, 4.1, 7) | E3 |
| E5 | Notas de entrega | api + frontend + template | `pi` + template (5.1) | E4 |

B1, B2 e F0 podem rodar em paralelo (sessões `pi` separadas no Alethe). A ordem E1 → E5 vem do discovery de 2026-10-21/22: até E4 a Esteira só **valida** (gatekeeper), daí em diante **executa** — template e Esteira testáveis ponta a ponta já na E1.
