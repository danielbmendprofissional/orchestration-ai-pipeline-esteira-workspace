# ADR-0014 — Identificadores: `long` interno, GUID público

Status: Aceito · 2026-10-22 · Fecha o "IDs opacos" da ADR-0005

Toda entidade tem dois identificadores: **`Id` (`long`, identity)** para chave primária, chave estrangeira e join — compacto e rápido no índice — e **`PublicId` (GUID v7, único)** para tudo que sai da API: URL, contrato com o front e com a pipeline, eventos. O `long` nunca aparece fora do backend; o GUID nunca é usado em join.

## Consequences

- `EntityBase` passa de `int Id` para `long Id` + `Guid PublicId` (gerado no domínio, ordenável por ser v7). Cabe na M0, que recomeça as migrations.
- Rotas recebem GUID; o repositório resolve para o `long` uma vez na entrada.
