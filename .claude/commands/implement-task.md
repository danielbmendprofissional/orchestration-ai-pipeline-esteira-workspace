---
description: Executa uma spec (ou uma task) — prepara issue e branch, implementa task a task com TDD, roda a suite uma vez por task e comita na branch de feature
argument-hint: "[#issue-mãe | #filha]"
---
Argumento: `$ARGUMENTS` — `#<filha>`, `#<issue-mãe>` (faz as filhas em ordem) ou vazio. **Vazio:** leia só a tabela de `specs/README.md` e pegue a primeira fatia não feita, com issue-mãe, cujo "Depende de" está todo feito; diga qual escolheu e por quê.

## Modo da sessão

`echo "$ANTHROPIC_BASE_URL"` no terminal: **vazio = modo Claude** (assinatura); **preenchido = modo pago/free** (OmniRoute). O modo muda só quem implementa e quando há review por task:

| | Modo Claude | Modo pago/free |
|---|---|---|
| Quem implementa a task | **você**, direto, com TDD | o subagente executor (`data`/`backend`/`front`/`ui`), com o `$TASK` |
| `review` por task | não (o `/code-review` no fim da spec revisa tudo) | sim, subagente `review` antes de cada commit |
| Subagente executor no modo Claude | só se a task for grande demais pro contexto da sessão | — |

## 0. Preparar (uma vez por spec)

1. `glab issue view <mãe> -R <grupo>/<projeto>-workspace` (grupo no `git remote -v`). As filhas são as Tasks em "Child items" da mãe (`docs/agents/issue-tracker.md`, "Tickets de uma spec"); leia cada uma uma vez.
2. Leia a spec inteira e os arquivos do `## Contexto necessário` dela, uma vez.
3. Branch: uma por spec, `feature/<mãe>-<slug>`, em cada repositório que as filhas tocam (`backend` → `<projeto>-api`, `frontend` → `<projeto>-frontend`). Existe → `git -C <repo> switch`; senão `git -C <repo> fetch origin` e `git -C <repo> switch -c <branch> origin/dev`. Working tree sujo **num repositório que a spec toca** → pare e pergunte; o resto (workspace, outros repositórios) não é seu: não comite nem altere nada lá. Nunca `dev`/`qa`/`hml`/`main`.

## 1. Por task (na ordem do `Blocked by`)

Pare e diga por quê se a filha não tiver `ready-for-agent` ou tiver bloqueador não resolvido (resolvido = fechado ou já comitado nesta branch: `git -C <repo> log origin/dev..<branch> --grep "workspace#<n>"`).

Escopo da task: o trecho da spec que é dela (checklist/critérios EARS), o que **não** tocar (o que é das outras filhas) e os arquivos onde a mudança deve cair. No modo pago/free, isso vira o `$TASK` autocontido do executor (com os 2–4 arquivos de contexto e o comando de teste) — passe-o inteiro.

**Testes — o custo de tempo está aqui** (a suite de integração sobe containers):
- Durante a task, rode **só os testes da task**, com filtro (`dotnet test <projeto de teste> --filter <classe>`, `npx vitest run <arquivo>`). Vermelho primeiro, depois verde.
- A **suite completa roda uma vez por task**, por você, logo antes do commit. Subagente nunca roda a suite completa.

Regras da implementação (modo Claude) — as mesmas dos executores em `.claude/agents/`: TDD, teste vermelho congelado (só a implementação muda até ficar verde), só o escopo da task, nada de "Não toque".

`tests` (subagente) só se a task juntar duas ou mais camadas; `security` só se tocar auth, sessão, segredo, permissão ou dependência nova — nos dois modos.

## 2. Conferir e comitar

- `git -C <repo> diff --stat` e `status -s`: arquivo fora do escopo, de outra filha, ou teste existente apagado → corrija (ou reabra o executor com o motivo).
- Modo pago/free: `review` FAIL → reabra o executor uma vez com os achados; FAIL de novo → pare e reporte (spec ou contrato ambíguo).
- Suite completa verde → commit na branch: `<tipo>: <o que fez> (workspace#<n>)`. **Sem push** — push e MR vêm do `/code-review`.

## 3. Encerrar

Sem filha restante: branch(es), commits, suposições registradas, e "Pronto para `/code-review`" (na mesma sessão ou numa nova).
