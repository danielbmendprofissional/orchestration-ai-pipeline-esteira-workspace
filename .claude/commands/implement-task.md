---
description: Leva uma fatia da spec até a MR aberta — tasks com TDD, commit por task, /code-review, correção dos achados, push e MR pra dev
argument-hint: "[B2 | B2.5 | #issue] [— instrução extra]"
---
Argumento: `$ARGUMENTS`. Rode sempre da **raiz do workspace**. O que vier depois de `—` é instrução extra do humano (ex.: `B2 — corrigir: <achado>`).

| Argumento | O que roda |
|---|---|
| `B2` (código da fatia) | a fatia inteira: as filhas que faltam, review e MR |
| `B2.5` | só essa filha (título começa com `B2.5 —`), depois review e MR se ela era a última |
| `#8` / `#2` | o mesmo, pelo número da issue (filha → a mãe é o `Part of`) |
| vazio | a primeira fatia do `specs/README.md` não feita, com issue-mãe, cujo "Depende de" está todo feito; diga qual escolheu e por quê |

Nomes (`docs/agents/orchestration.md`, "Nomes"): mãe `B2 — <título>`, filhas `B2.N — <título>`, branch `feature/b2-<slug>`, commit `<tipo>: <o que fez> (B2.N · workspace#<filha>)`, MR `B2 — <título>`.

## Modo da sessão

`echo "$ANTHROPIC_BASE_URL"`: **vazio = modo Claude** (assinatura); **preenchido = modo pago/free** (OmniRoute). O modo muda só quem implementa:

| | Modo Claude | Modo pago/free |
|---|---|---|
| Quem implementa a task | **você**, direto, com TDD | o subagente executor (`data`/`backend`/`front`/`ui`), com o `$TASK` |
| `review` por task | não (o `/code-review` do passo 3 revisa tudo) | sim, subagente `review` antes de cada commit |
| Subagente executor no modo Claude | só se a task for grande demais pro contexto da sessão | — |

## 0. Preparar (uma vez por execução)

1. **Reconciliar:** feche as fatias já mergeadas (`docs/agents/orchestration.md`, "Fechar a fatia"). É rápido e nunca bloqueia.
2. **Resolver a fatia:** `B2` → linha do `specs/README.md` (link da spec e `#<mãe>`); sem `#` no mapa → `glab issue list -R <grupo>/<projeto>-workspace --search "B2 —"`. Leia a mãe e as filhas (Child items: `docs/agents/issue-tracker.md`, "Tickets de uma spec") uma vez cada; a spec inteira e o `## Contexto necessário` dela, uma vez.
3. **Branch** em cada repositório que as filhas tocam (`backend` → `<projeto>-api`, `frontend` → `<projeto>-frontend`): `git -C <repo> branch --list "feature/b2-*"` existe → `switch`; senão `fetch origin` + `switch -c feature/b2-<slug> origin/dev` (`<slug>` = nome do arquivo da spec sem o `NN-`). Working tree sujo **num repositório que a fatia toca** → pare. O resto (workspace, outros repositórios) não é seu: não comite nem altere nada lá. Nunca `dev`/`qa`/`hml`/`main`.
4. **Cabeçalho** — antes de qualquer alteração, imprima:
   ```
   Fatia B2 — <título> (workspace#2) · spec <caminho>
   Branch feature/b2-<slug> em <repo(s)>
   Filhas: B2.1 #4 ✔ · B2.2 #5 ✔ · B2.3 #6 ✔ · B2.4 #7 ✔ · B2.5 #8 → agora
   MR: <link, se já existe> · Fora do escopo: tudo que não é filha de #2
   ```
   Filha feita = commit com `workspace#<n>)` alcançável pela branch: `git -C <repo> log <branch> --oneline --grep "workspace#<n>)"`.
5. **Painel na mãe** — o mesmo estado, no GitLab, pro humano acompanhar sem o terminal. Na descrição da mãe, o bloco entre `<!-- execucao -->` e `<!-- /execucao -->` (crie no fim se não existir; nunca mexa no resto da descrição):
   ```markdown
   <!-- execucao -->
   ### Execução
   - [x] B2.1 #4 — `0b4bd79`
   - [ ] B2.4 #7 — em andamento
   - [ ] B2.5 #8
   - [ ] Review
   - [ ] MR
   <!-- /execucao -->
   ```
   Atualizar = ler a descrição (`glab issue view <mãe> -R <grupo>/<projeto>-workspace -F json`), trocar só o bloco e gravar (`glab issue update <mãe> -R … --description "<descrição inteira>"`). Atualize a cada mudança de estado dos passos 1–5. A lista de issues do GitLab mostra a contagem do checklist ("3 of 7").
6. **MR já aberta para a branch** (`glab mr list -R <grupo>/<repo> --source-branch <branch>`): os comentários não resolvidos dela (`glab api projects/:id/merge_requests/<iid>/discussions`) são correções pedidas pelo humano. Cada um vira uma correção no passo 1 (commit `fix: … (B2.N · workspace#<filha>)`), e no passo 4 você responde o comentário com o sha.

## 1. Por task (na ordem do `Blocked by`, só as não feitas)

Pare se a filha não tiver `ready-for-agent` ou tiver bloqueador que não está feito nem fechado.

Ao começar a filha: `glab issue update <filha> -R <grupo>/<projeto>-workspace --label em-andamento` (label não existe no projeto → `glab label create -R … --name em-andamento --color "#e9a23b"` antes) e, no painel, a linha dela vira `— em andamento`.

Escopo da task: o trecho da spec que é dela (checklist/critérios EARS), o que **não** tocar (o que é das outras filhas) e os arquivos onde a mudança deve cair. No modo pago/free, isso vira o `$TASK` autocontido do executor (com os 2–4 arquivos de contexto e o comando de teste) — passe-o inteiro.

**Testes — o custo de tempo está aqui** (a suite de integração sobe containers):
- Durante a task, rode **só os testes da task**, com filtro (`dotnet test <projeto de teste> --filter <classe>`, `npx vitest run <arquivo>`). Vermelho primeiro, depois verde.
- A **suite completa roda uma vez por task**, por você, logo antes do commit. Subagente nunca roda a suite completa.

**TDD obrigatório, nesta ordem, por critério da task (modo Claude e executores):**
1. Escreva o teste do critério.
2. Rode e **veja falhar pelo motivo certo** (o comportamento não existe ainda — não erro de compilação de outra coisa).
3. Só então escreva o código de produção, até o teste ficar verde. O teste vermelho fica congelado: só a implementação muda.

Escreveu código de produção antes de ver o teste vermelho? **Desfaça esse código** (só o que você criou nesta task), volte ao passo 1. Teste escrito depois do código não conta — ele nunca provou que testa algo. No relatório da task, cite cada teste e a falha vermelha que você viu antes do verde.

Demais regras — as mesmas dos executores em `.claude/agents/`: só o escopo da task, nada de "Não toque".

`tests` (subagente) só se a task juntar duas ou mais camadas; `security` só se tocar auth, sessão, segredo, permissão ou dependência nova — nos dois modos.

## 2. Conferir e comitar (por task)

- `git -C <repo> diff --stat` e `status -s`: arquivo fora do escopo, de outra filha, ou teste existente apagado → corrija (ou reabra o executor com o motivo).
- Modo pago/free: `review` FAIL → reabra o executor uma vez com os achados; FAIL de novo → pare (spec ou contrato ambíguo).
- Suite completa verde → commit `<tipo>: <o que fez> (B2.N · workspace#<filha>)`, e na filha: `glab issue note <filha> -R <grupo>/<projeto>-workspace -m "Feita em <branch> (<repo>): <sha>"`, `--unlabel em-andamento` e, no painel, `- [x] B2.N #<filha> — \`<sha>\``. **Sem push** aqui.

## 3. Review (automático, quando não sobra filha)

Só se houver commit novo desde a última prova (`.code-review-ok.json`). Rode a skill `code-review` (Skill tool) **sem perguntar o ponto fixo**: em cada repositório da fatia, ponto fixo `origin/dev`, diff `git -C <repo> diff origin/dev...<branch>`, spec = o arquivo da fatia. Painel: `- [ ] Review — rodada <n>` enquanto roda, `FAIL, corrigindo <k> achados` no FAIL, `- [x] Review — PASS na rodada <n>` no PASS.

- **PASS** → passo 4.
- **FAIL** → corrija você mesmo, sem devolver ao humano: cada achado vai pra filha dona do arquivo/commit, com TDD quando é comportamento, commit `fix: <achado> (B2.N · workspace#<filha>)`; rode o review de novo. **No máximo 2 rodadas de correção.** Achado de padrão marcado como julgamento (smell) que você decide não corrigir → vai na descrição da MR com o motivo.
- FAIL na 3ª rodada → **pare** (passo 5): quase sempre é spec ambígua ou achado com o qual você discorda, e isso é decisão humana.

## 4. Entrega

Em cada repositório da fatia (`docs/agents/orchestration.md`, "Entrega"): prova `.code-review-ok.json` + commit, `git -C <repo> push -u origin <branch>`, e — sem o gate do template-ci (`grep -q verify-code-review <repo>/.gitlab-ci.yml` falha) — a MR pra `dev`, título `B2 — <título da mãe>`, descrição no formato de lá. MR já aberta: só o push (ela se atualiza) e a resposta em cada comentário tratado. Na mãe: `glab issue note <mãe> -m "MR pronta pra revisão: <link>"` e, no painel, `- [x] MR — <link>`.

## 5. Encerrar — sempre com este relatório

```
B2 — PRONTA PARA SUA REVISÃO          (ou: B2 — PAROU: precisa de você)
MR: <link> (dev ← feature/b2-<slug>)   · filhas B2.1–B2.5 ✔ · review PASS na rodada <n>
Suposições: <as que você fez e o humano deve conferir>
Você agora: <a próxima ação humana, concreta>
```

"Você agora", conforme o caso: **pronta** → abrir a MR, testar (comandos do "Como testar"), aprovar e mergear — ou comentar na MR e rodar `/implement-task B2` de novo; **parou** → o motivo e a decisão exata que falta (ex.: "o critério 3 da spec diz X e o código legado Y: qual vale?"). Ao parar, registre o mesmo texto na mãe (`glab issue note`), troque a linha do painel onde parou por `⚠ parou: <motivo em uma frase>` e tire o `em-andamento` da filha. Termine com uma notificação (ferramenta `PushNotification`, quando a sessão tiver) com a primeira linha do relatório.
