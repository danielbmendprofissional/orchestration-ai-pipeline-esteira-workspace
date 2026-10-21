# ADR-0001 — Esteira segue o padrão de workspace do ai-base

Status: Aceito · 2026-10-21

## Decisão

`ai-pipeline/esteira/` é o repositório `esteira-workspace` (GitLab `orchestration-ai/ai-pipeline/esteira/esteira-workspace`), nascido do `ai-base`. `esteira-api/` e `esteira-frontend/` são repositórios próprios dentro dele, ignorados pelo `.gitignore` do workspace. Specs, ADRs transversais e **todas as issues** (labels `backend`/`frontend`) ficam no workspace.

## Por quê

Mesmo desenho do Valuto e do `ai-base` (`docs/agents/workspace.md`): Claude Code e `pi` abrem na raiz e enxergam os dois componentes; cada componente mantém tag, esteira e promoção independentes.
