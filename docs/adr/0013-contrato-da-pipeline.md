# ADR-0013 — Contrato da pipeline versionado e separado do contrato do front

Status: Aceito · 2026-10-22

A API tem dois clientes com ritmos diferentes: o front muda junto com ela; as pipelines fixam uma versão do template por meses. As rotas da pipeline ficam em **`/api/pipeline/v1/...`**, com documento OpenAPI próprio e versão explícita, autenticadas por `id_token` do GitLab (ADR-0008). A Esteira aceita a versão atual e a anterior ao mesmo tempo; mudança incompatível vira `v2`. As rotas do front ficam em `/api/v1/...`, autenticadas por sessão (ADR-0004).
