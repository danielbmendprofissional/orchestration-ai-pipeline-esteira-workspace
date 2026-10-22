# ADR-0010 — Ações no GitLab como registros de Ação do bot, executadas via outbox

Status: Aceito · 2026-10-22

Toda ação da Esteira no GitLab (cortar candidata, abrir/mergear MR, sincronizar, play de job, rollback) é uma **Ação do bot**: um registro (pedida → executando → confirmada | falhou, com chave de idempotência) gravado **na mesma transação** da decisão que a gerou e executado depois por um consumer com retry. A confirmação chega pelo webhook do GitLab ou pelo `esteira-abrir` da pipeline disparada.

## Considered Options

- **Saga do MassTransit** (state machine persistida): o Fluxo já é uma máquina de estados (etapas); uma segunda, de infraestrutura, duplicaria o modelo e esconderia o estado da tela.

## Consequences

- O **outbox com tabela** (pendência antiga) sobe para a fase 1, junto da M0: sem ele, decisão gravada e Ação perdida num restart divergem.
- A tela mostra as Ações do Fluxo (o que o bot está fazendo, o que falhou) e permite reexecutar uma Ação falhada.
- Cada Ação é auditada com quem a originou: no GitLab o autor é sempre o bot.
