# ADR-0013 — Contrato da pipeline versionado e separado do contrato do front

Status: Aceito · 2026-10-22 · **Decidido em 2026-11-15: v2.** O `esteira-abrir` passa a anexar o Artefato a uma Entrega já aberta e surgem modos novos (fluxo, promoção, liberação, flag, rollback, rótulo); a v1 segue aceita para os repositórios ainda não migrados. O `template-ci` v3 implementa a v2 (`template-ci/docs/contrato-pipeline-v2.md`)

A API tem dois clientes com ritmos diferentes: o front muda junto com ela; as pipelines fixam uma versão do template por meses. As rotas da pipeline ficam em **`/api/pipeline/v1/...`**, com documento OpenAPI próprio e versão explícita, autenticadas por `id_token` do GitLab (ADR-0008). A Esteira aceita a versão atual e a anterior ao mesmo tempo; mudança incompatível vira `v2`. As rotas do front ficam em `/api/v1/...`, autenticadas por sessão (ADR-0004).
