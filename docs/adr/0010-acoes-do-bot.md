# ADR-0010 — Ações no GitLab como registros de Ação do bot, executadas via outbox

Status: Aceito · 2026-10-22 · Lista de Ações revista em 2026-11-14 (ADR-0018: trunk-based, Artefato por SHA; Esteira como autoridade do processo, com o GitLab refletindo cada decisão)

Toda ação da Esteira no GitLab é uma **Ação do bot**: um registro (pedida → executando → confirmada | falhou, com chave de idempotência) gravado **na mesma transação** da decisão que a gerou e executado depois por um consumer com retry. A confirmação chega pelo webhook do GitLab ou pelo `esteira-abrir` da pipeline disparada.

## Ações que existem hoje

- **Comentar na MR** — todo texto traz o **nome do humano** que decidiu na Esteira, porque o autor técnico no GitLab é sempre o bot.
- **Fechar a MR** — reprovação do review da Fatia, com o comentário do humano.
- **Reabrir a MR** — depois que o motivo do fechamento foi corrigido na mesma branch.
- **Mergear a MR de `feature/*` ou `hotfix/*` na `main`** — aprovação do review da Fatia. Não vale nos repositórios da própria Esteira (modo fallback da ADR-0008).
- **Disparar job (play)** — abrir o review da Fatia (`review-<fatia>`), promover o Artefato para hml e produção depois da aprovação humana, rollback (redeploy do SHA anterior) e alterar feature flag (ADR-0019; mecanismo ainda em definição).
- **Aplicar o rótulo de versão** ao Artefato na ida a produção (formato conforme a ADR-0018).

## Ações que deixaram de existir

Cortar candidata, abrir MR `release/<tag>` → `qa|hml|main` e sincronizar branches. Não há mais branch por ambiente (ADR-0018).

## Considered Options

- **Saga do MassTransit** (state machine persistida): o Fluxo já é uma máquina de estados (etapas); uma segunda, de infraestrutura, duplicaria o modelo e esconderia o estado da tela.

## Consequences

- O **outbox com tabela** (pendência antiga) sobe para a fase 1, junto da M0: sem ele, decisão gravada e Ação perdida num restart divergem.
- A tela mostra as Ações do Fluxo e da Fatia (o que o bot está fazendo, o que falhou) e permite reexecutar uma Ação falhada.
- Cada Ação é auditada com quem a originou: no GitLab o autor é sempre o bot, e o humano aparece no texto do comentário e no registro da Esteira.
