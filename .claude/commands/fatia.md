---
description: Leva uma fatia do zero à MR com UMA aprovação sua (a spec) — spec → [você aprova] → tickets → execução → review → MR
argument-hint: "B3 [— instrução extra]"
---
Argumento: `$ARGUMENTS` (código da fatia; vazio = a próxima livre do `specs/README.md`, como no `/implement-task`). Comando de entrada único: retoma de onde a fatia está, então pode ser rodado de novo depois de qualquer parada.

## 0. Onde a fatia está

Fechar as mergeadas (`docs/agents/orchestration.md`, "Fechar a fatia"), **reconciliar a coluna Status do `specs/README.md` com o git** (fatia cujas MRs estão todas mergeadas em `dev` → `feito`; a alteração vai no commit de docs do passo 1, nunca num commit solto) e ver o estado da fatia (`/proximo`, só a parte da fatia). Se a spec da fatia já existe, rode `node .claude/scripts/check-spec-drift.mjs <spec>`: `⚠ desatualizada` (ou sem `base:`) → o passo 1 vira **revalidação** (`docs/agents/spec-format.md`, "Spec que já existe"), não spec nova do zero. Comece no primeiro passo ainda não feito:

| Estado | Começa em |
|---|---|
| sem arquivo de spec | 1 |
| spec escrita, sem mãe (aguardava aprovação) | 1 (mostrar de novo e pedir o ok) |
| mãe aberta, sem filhas | 2 |
| filhas criadas | 3 |
| filhas feitas / MR aberta | 3 (o `/implement-task` retoma) |

## 1. Spec — a única parada obrigatória

Siga `docs/agents/spec-format.md` (skill `to-spec` com o override do repositório): gate, contexto, só as perguntas que faltam, o arquivo da spec com `risco: baixo|alto` e a coluna "Toca em" conferida no mapa. Mostre a **Ideia**, o que fica fora, os critérios e o risco. Decisão em aberto que nenhuma ADR, padrão ou código cobre → um grill curto ali mesmo (o `/proximo` já avisa quando uma fatia vai precisar); o `/grill-with-docs` separado só quando a fatia ainda é ideia solta, fora do mapa. **Pare e peça o ok.** Ajustes que você pedir voltam aqui; nada além da spec existe até o ok (nem issue, nem ticket) — é por isso que retrabalho de spec não custa ticket.

Com o ok: grave a base (`check-spec-drift.mjs --stamp <spec>`), abra a mãe e linke no mapa, como no `spec-format.md`.

## 2. Tickets — automáticos, sem segunda leitura

Siga `docs/agents/issue-tracker.md` ("Tickets de uma spec"): uma Task filha por fatia de trabalho, `Blocked by` na ordem, `ready-for-agent`, e em cada descrição `Cobre: <critérios da spec>`. Depois:

`node .claude/scripts/check-tickets.mjs <fatia> <arquivo da spec> <grupo>/<projeto>-workspace`

- `OK` → siga pro 3 sem mostrar os tickets.
- `FALHA` → corrija os tickets uma vez e rode de novo; falhou outra vez → **pare** e mostre o que falta (spec ambígua).
- `risco: alto` → **pare** aqui e mostre os tickets (título + `Cobre:`) pra você ler antes de executar.

## 3. Execução

Leia `.claude/commands/implement-task.md` e siga-o inteiro a partir do passo 0, com a fatia deste comando. Termine com o relatório dele (que já traz "Você agora" e "Depois").

Isto é só o encadeamento: nenhuma regra de TDD, review, MR ou governança muda. Humano continua decidindo a spec e a MR; promoção entre ambientes segue a esteira.
