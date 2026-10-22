# ADR-0016 — Banco: um schema `esteira`, roles da infra

Status: Aceito · 2026-10-22

Todas as tabelas da Esteira — inclusive o outbox/inbox do MassTransit e o `__EFMigrationsHistory` — ficam no schema **`esteira`**, nunca no `public`. As roles são as que a infra compartilhada já entrega no modo padrão (`postgres.roles: "infra"`): `esteira_owner` cria o schema e roda as migrations; `esteira_app` só faz SELECT/INSERT/UPDATE/DELETE em runtime, sem DDL. Os privilégios do `esteira_app` no schema novo vêm do `ALTER DEFAULT PRIVILEGES` que a infra já aplica pra qualquer schema criado pelo owner — nada a pedir à infra.

## Considered Options

- **Ficar no `public`**: funciona, mas mistura com o que extensões e ferramentas criam por padrão e torna um eventual segundo contexto uma migração de dados.
- **Schema + par de roles por módulo** (modelo do Valuto: `vp_owner_<módulo>`/`vp_usu_<módulo>`, `roles: "project"` + script inicial próprio): só se paga com vários contextos isolados. A Esteira tem um contexto (ADR-0009); seria cerimônia sem ganho.

## Consequences

- Os contextos ligam ao Postgres só por `EsteiraPostgres.UsarPostgres` (`Esteira.Data`), que fixa o schema do histórico de migrations; `HasDefaultSchema` nos dois contextos.
- Ambientes (`ai-infra` = só dev local; hml/prd no Kubernetes da AWS, provisionados à mão pelo humano) recebem o mesmo banco com as mesmas duas roles por ambiente — o schema vem das migrations, igual em todos.
- Se um dia surgir um segundo contexto, ele ganha schema próprio e uma ADR nova decide se ganha roles próprias.
