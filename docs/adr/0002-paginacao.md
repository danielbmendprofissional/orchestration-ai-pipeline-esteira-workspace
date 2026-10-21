# ADR-0002 — Paginação via headers `X-*` (igual ao Valuto ADR-010)

Status: Aceito · 2026-10-21 · Substitui o header único `Pagination` (JSON) herdado do sistema legado

## Decisão

- **Request:** `X-Page` (1-based) e `X-Page-Size`. Ordenação e filtros por query string: `?sort=<campo>&order=asc|desc&<filtro>=...`.
- **Response:** body é o **array naked** (`FluxoDeploySummary[]`), paginação só nos headers `X-Total-Count`, `X-Total-Pages`, `X-Page`, `X-Page-Size`.
- CORS expõe os quatro headers de resposta.
- Frontend: um helper em `core/http/` lê/escreve esses headers; nenhuma page conhece header.

## Impacto

- `esteira-api`: trocar `PaginacaoHttpExtensions`/`PaginacaoResultFilter` (hoje lêem/escrevem o header `Pagination` em JSON) e `WithExposedHeaders`. Mudança de contrato — vira spec de backend antes do frontend consumir listas.
- Ordenação por query string é extensão em relação ao Valuto (lá não havia lista ordenável); documentado aqui pra não virar convenção implícita.
