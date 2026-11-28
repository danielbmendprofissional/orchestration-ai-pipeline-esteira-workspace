---
description: Leva uma fatia da spec até a MR aberta — tasks com TDD, commit por task, /code-review, correção dos achados, push e MR pra main
argument-hint: "[B2 | B2.5 | #issue] [— instrução extra]"
---
Argumento: `$ARGUMENTS`. Rode sempre da **raiz do workspace** (ou da área isolada da fatia, `<workspace>.wt/b2/`). O que vier depois de `—` é instrução extra do humano (ex.: `B2 — corrigir: <achado>`).

| Argumento | O que roda |
|---|---|
| `B2` (código da fatia) | a fatia inteira: as filhas que faltam, review e MR |
| `B2.5` | só essa filha (título começa com `B2.5 —`), depois review e MR se ela era a última |
| `#8` / `#2` | o mesmo, pelo número da issue (filha → a mãe é o `Part of`) |
| vazio | a próxima fatia **livre**: primeira do `specs/README.md` não feita, com issue-mãe, cujo "Depende de" está todo feito, **sem** `em-execucao` e cujo "Toca em" não cruza com o de nenhuma fatia `em-execucao`; diga qual escolheu e por quê |

Nomes (`docs/agents/orchestration.md`, "Nomes"): mãe `B2 — <título>`, filhas `B2.N — <título>`, branch `feature/b2-<slug>`, commit `<tipo>: <o que fez> (B2.N · workspace#<filha>)`, MR `B2 — <título>`.

## Modo da sessão e executor

`echo "$ANTHROPIC_BASE_URL"`: **vazio = modo Claude** (assinatura); **preenchido = modo pago/free** (OmniRoute). O modo muda só quem implementa:

| | Modo Claude | Modo pago/free |
|---|---|---|
| Quem implementa a task | **você**, direto, com TDD | o subagente executor (`data`/`backend`/`front`/`ui`), com o `$TASK` |
| `review` por task | não (o `/code-review` do passo 3 revisa tudo) | sim, subagente `review` antes de cada commit |
| Subagente executor no modo Claude | **obrigatório quando restam mais de 2 filhas** (medido na A1 da Esteira: o pai implementando tudo foi de 127 mil a 390 mil de contexto em 40 min, relendo isso a cada chamada); com 1–2 filhas, direto é aceitável. Também quando a task for grande demais pro contexto ou independente de outra (paralelo real) | — |

No modo Claude com subagente, o `review` por task continua não rodando (o `/code-review` do passo 3 revisa tudo). A sessão principal só prepara o recorte, delega, confere (`check-escopo`), comita e atualiza o painel.

**Contexto enxuto do pai:** cada resultado de comando que você lê fica na sessão e é relido a cada chamada. Comando que despeja muito (geração de tipos, build, `git diff` inteiro, listagens) vai com filtro (`| tail -40`, `| grep`, `--stat`); o relatório do executor traz só o que fugiu do esperado, o resto você lê no git e no `check-escopo`.

**Registre quem executou cada etapa**, no painel e no commit. Nome do executor: modo Claude → `pai (Claude)`; subagente → `<agente> (<modelo>)`, com o modelo pelo modo (`docs/agents/orchestration.md`, tabela dos três modos: `sonnet` = Sonnet no Claude, `omni-pago` no pago, `omni-free` no free; `haiku` = Haiku / `omni-free` / `omni-light`). Commit: trailer `Executed-by: <executor>` no fim da mensagem.

## 0. Preparar (uma vez por execução)

0. **Sincronizar:** `git -C <repo> fetch origin` em cada repositório de código e no workspace, antes de qualquer conferência (feito, bloqueado, mergeado). `origin/main` sem fetch é dado velho.
1. **Reconciliar:** feche as fatias já mergeadas (`docs/agents/orchestration.md`, "Fechar a fatia"). O CI normalmente já fechou no merge; isto é a rede de segurança. É rápido e nunca bloqueia.
2. **Resolver a fatia:** `B2` → linha do `specs/README.md` (link da spec e `#<mãe>`); sem `#` no mapa → `glab issue list -R <grupo>/<projeto>-workspace --search "B2 —"`. Leia a mãe e as filhas (Child items: `docs/agents/issue-tracker.md`, "Tickets de uma spec") uma vez cada; da spec, **só o cabeçalho e a Ideia**: `node .claude/scripts/ticket-contexto.mjs <spec> --cabecalho` (`risco:`, `flag:`, `preview:`). A spec inteira **não** entra nesta sessão: cada filha lê o recorte dela (passo 1). O `risco:` (`baixo`/`alto`) vale pra fatia toda (passo 3).

   **Contexto da sessão:** ela relê tudo que carrega a cada chamada, então só coordena (lê código só o da task que você mesmo implementa no modo Claude). Rode `node .claude/scripts/gasto.mjs --resumo`: com a sessão principal acima de ~150 mil de contexto médio (veio do `/fatia` com a conversa da spec), avise o humano que `/clear` e `/implement-task <fatia>` retomam de onde está (o estado vive no painel da mãe e no git) e gasta bem menos; siga se ele disser que não precisa.
3. **Trava e área:**
   - A mãe já tem `em-execucao`? Leia a linha **Área** do painel: é a sua área (mesmo caminho) → retomada, siga; é outra → **pare** ("a fatia está em execução em <área>"), a não ser que o humano tenha escrito `— retomar`.
   - Há outra mãe `em-execucao` (`glab issue list -R … --label em-execucao`) e você está na raiz do workspace, não numa área isolada (`git rev-parse --git-common-dir` ≠ `.git`)? **Pare** e diga: `node .claude/scripts/worktree-fatia.mjs B2 <slug>` e abrir o painel em `<workspace>.wt/b2/`. Sozinha na raiz, trabalhe nela.
   - Sem trava: crie o label se não existir (`glab label create -R … --name em-execucao --color "#1f75cb"`) e ponha `em-execucao` na mãe.
4. **Branch** em cada repositório que as filhas tocam (`backend` → `<projeto>-api`, `frontend` → `<projeto>-frontend`): `git -C <repo> branch --list "feature/b2-*"` existe → `switch` (na área isolada ela já vem em checkout); senão `fetch origin` + `switch -c feature/b2-<slug> origin/main` (`<slug>` = nome do arquivo da spec sem o `NN-`). Working tree sujo **num repositório que a fatia toca** → pare. O resto (workspace, outros repositórios) não é seu: não comite nem altere nada lá. Nunca comite na `main`.
5. **Cabeçalho** — antes de qualquer alteração, imprima:
   ```
   Fatia B2 — <título> (workspace#2) · spec <caminho> · risco <baixo|alto>
   Branch feature/b2-<slug> em <repo(s)> · área <caminho> · modo <Claude|pago|free>
   Filhas: B2.1 #4 ✔ · B2.2 #5 ✔ · B2.3 #6 ✔ · B2.4 #7 ✔ · B2.5 #8 → agora
   MR: <link, se já existe> · Fora do escopo: tudo que não é filha de #2
   ```
   Filha feita = commit com `workspace#<n>)` alcançável pela branch: `git -C <repo> log <branch> --oneline --grep "workspace#<n>)"`.
6. **Painel na mãe** — o mesmo estado, no GitLab, pro humano acompanhar sem o terminal (a lista de issues e o board por label `em-execucao` mostram a contagem "3 of 7"). Na descrição da mãe, o bloco entre `<!-- execucao -->` e `<!-- /execucao -->` (crie no fim se não existir; nunca mexa no resto da descrição):
   ```markdown
   <!-- execucao -->
   ### Execução
   **Área:** `<caminho>` · **Modo:** Claude | pago | free · **Início:** 2026-10-25
   - [x] B2.1 #4 — `0b4bd79` · pai (Claude)
   - [x] B2.2 #5 — `3fa91c2` · backend (omni-pago) · review PASS
   - [ ] B2.3 #6 — em andamento · pai (Claude)
   - [ ] Suite completa
   - [ ] Review
   - [ ] MR
   <!-- /execucao -->
   ```
   Atualizar = ler a descrição (`glab issue view <mãe> -R <grupo>/<projeto>-workspace -O json`), trocar só o bloco e gravar (`glab issue update <mãe> -R … --description "<descrição inteira>"`). **Atualize em lote, só nestes momentos:** ao começar, a cada filha comitada, ao começar/terminar a suite, no início e no resultado de cada rodada de review, na MR e ao parar. Nada de label ou nota por filha — o painel é o registro.
7. **MR já aberta para a branch** (`glab mr list -R <grupo>/<repo> --source-branch <branch>`; inclua as **fechadas**, `--all`): se ela foi **fechada pela reprovação na Esteira**, o comentário do humano (com o nome dele) é a correção pedida e, depois do push, você **reabre a mesma MR** (`glab mr reopen <iid> -R <grupo>/<repo>`) em vez de abrir outra. Os comentários não resolvidos dela (`glab api projects/:id/merge_requests/<iid>/discussions`) são correções pedidas pelo humano. Cada um vira uma correção no passo 1 (commit `fix: … (B2.N · workspace#<filha>)`), e no passo 4 você responde o comentário com o sha.

## 1. Por task (na ordem do `Blocked by`, só as não feitas)

Pare se a filha não tiver `ready-for-agent` ou tiver bloqueador que não está feito nem fechado. Guarde o sha de `HEAD` antes de começar (`<base>`); no painel, a linha da filha vira `— em andamento · <executor>`.

**Em paralelo (só com executores subagentes, no máximo 2 ao mesmo tempo):** duas filhas rodam juntas quando **as três** condições valem: (1) nenhuma está no `Blocked by` da outra, direto ou por outra filha; (2) tocam **repositórios de código diferentes** (ex.: `<projeto>-api` e `<projeto>-frontend`), então não há arquivo nem working tree em comum; (3) a do front só usa da API o que as filhas já **comitadas** entregaram (contrato do OpenAPI na `main` da branch), nunca o que a outra filha em andamento está escrevendo. Duas filhas do mesmo repositório **nunca** rodam juntas. Lance os dois subagentes em segundo plano (`run_in_background`), cada um com o seu `<base>` (o `HEAD` do próprio repositório) e o seu recorte; **você, a sessão principal, faz a conferência, o commit e a atualização do painel de um por vez, na ordem em que voltam** (o painel é um texto só: ler, trocar a linha, gravar, e só então o próximo). Qualquer dúvida sobre as três condições → rode em fila. Pare de paralelizar se um dos dois falhar: termine o outro e trate o que falhou sozinho.

Escopo da task: o trecho da spec que é dela (os critérios do `Cobre:` da filha), o que **não** tocar (o que é das outras filhas) e os arquivos onde a mudança deve cair. **Recorte da spec, sem modelo:** `node .claude/scripts/ticket-contexto.mjs <spec> --cobre "<Cobre da filha>" --area back|front --nome B2.5` grava só o que a filha precisa (cabeçalho, contexto, Ideia, seções da área, critérios dela, Testes) e imprime o caminho. No modo pago/free, o `$TASK` autocontido do executor (com os 2–4 arquivos de contexto e o comando de teste) leva esse caminho: o executor lê o recorte **em vez da spec inteira** e só abre a spec se o recorte não bastar, dizendo no relatório o que faltava. Passe o `$TASK` inteiro.

**Testes — o custo de tempo está aqui** (a suite de integração sobe containers):
- Durante a task, rode **só os testes da task**, com filtro (`dotnet test <projeto de teste> --filter <classe>`, `npx vitest run <arquivo>`). Vermelho primeiro, depois verde.
- A **suite completa roda uma vez por fatia**, por você, no passo 3 (e de novo depois de uma correção de review que mudou comportamento). Subagente nunca roda a suite completa. O CI da MR é a rede de segurança.

**TDD obrigatório, nesta ordem, por critério da task (modo Claude e executores):**
1. Escreva o teste do critério.
2. Rode e **veja falhar pelo motivo certo** (o comportamento não existe ainda — não erro de compilação de outra coisa).
3. Só então escreva o código de produção, até o teste ficar verde. O teste vermelho fica congelado: só a implementação muda.

Escreveu código de produção antes de ver o teste vermelho? **Desfaça esse código** (só o que você criou nesta task), volte ao passo 1. Teste escrito depois do código não conta — ele nunca provou que testa algo. No relatório da task, cite cada teste e a falha vermelha que você viu antes do verde.

**Marca da fatia em todo teste novo** (`docs/agents/orchestration.md`, "Marca da fatia nos testes"): o código da fatia (`B2`, não `B2.5`) na classe ou no `describe`. Teste novo sem a marca dá FALHA no `check-escopo`. No modo pago/free, a marca vai no `$TASK` ("marque os testes com a fatia B2").

**Flag:** leia `flag:` na spec. Com `flag: sim`, todo comportamento percebido pelo usuário entra atrás de `Features:<Fatia>` (`docs/agents/padrao-api.md`, "Feature flags"), com **flag ausente = desligado** no código; com `flag: não` (correção, refatoração, infra, migração expand-only), nenhum flag. Fatia que toca o front: leia `preview:` e entregue a sessão falsa e os dados falsos da tela (agente `ui`, `docs/agents/padrao-frontend.md`).

Demais regras — as mesmas dos executores em `.claude/agents/`: só o escopo da task, nada de "Não toque".

Percebeu falta ou erro em repositório compartilhado (`ai-base`, `ai-infra`, `ai-ops`, `template-ci`)? Não contorne nem edite lá: **pare nesse ponto**, proponha ao humano (`docs/agents/melhoria-orquestracao.md`) dizendo se bloqueia a fatia, e só abra a issue com o sim. Não bloqueia → siga e registre no relatório.

`tests` (subagente) só se a task juntar duas ou mais camadas. `security`: em task que toque auth, sessão, segredo, permissão ou dependência nova — e, com `risco: alto`, **uma vez sobre o diff da fatia inteira** antes da review do passo 3.

## 2. Conferir e comitar (por task)

- **Script, não olho:** `node .claude/scripts/check-escopo.mjs <repo> <base> --allow "<arquivos esperados>" --deny "<Não toque>"`. `FALHA` (arquivo fora do escopo, de outra filha, teste apagado, `skip`/`only`) → corrija, ou reabra o executor com o motivo. `AVISO` (asserção a menos) → confira contra a spec e, se for legítimo, registre no relatório.
- Modo pago/free: `review` (julgamento: spec, padrões, segurança básica) → FAIL reabre o executor uma vez com os achados; FAIL de novo → pare (spec ou contrato ambíguo).
- Testes da task verdes → commit `<tipo>: <o que fez> (B2.N · workspace#<filha>)` com o trailer `Executed-by: <executor>`, e no painel `- [x] B2.N #<filha> — \`<sha>\` · <executor>`. **Sem push** aqui, sem nota na filha: quem fecha as filhas é o merge.

## 3. Suite, segurança e review (automático, quando não sobra filha)

1. **Suite completa** em cada repositório da fatia, uma vez. Vermelha → corrija (TDD, commit `fix:` na filha dona do arquivo) e rode de novo. Painel: `- [x] Suite completa — verde`.
2. **Marcas:** `node .claude/scripts/status-specs.mjs B2 --pre-entrega` (zero token; sem a flag `--sem-gitlab` ele também confere issue e MR). `FALHA` = nenhum teste leva a marca da fatia → marque os testes (ou, se a spec não tem teste exigível, diga no relatório) antes da review. Depois do merge, `node .claude/scripts/status-specs.mjs B2` mostra `IMPLEMENTADA`/`INCONSISTENTE`; sem argumento, a tabela de todas as fatias.
3. **Ponto de corte antes do review** (a review é ~60% do cache da principal: medido na E1b, ela relia 167 mil por chamada contra 86 mil na implementação). Rode `node .claude/scripts/gasto.mjs --resumo` e leia "Contexto atual da sessão principal". **Acima de ~100 mil** → grave no painel `- [x] Suite completa — verde` e `- [ ] Review — aguardando sessão limpa`, e **pare** com duas linhas: "Implementação pronta e comitada; o contexto desta sessão está em <N> mil. Rode `/clear` e `/implement-task <fatia>`: a retomada vai direto à review (o estado está no painel e no git) e gasta bem menos." Só siga se o humano responder `seguir`. **Na retomada** (filhas todas comitadas, painel com a suite verde e nenhum commit novo depois dela) pule o item 1 e comece aqui, sem refazer o que o painel marca como feito. Abaixo de ~100 mil → siga direto. Isso vale também para `FAIL` de review: se o contexto passar de ~150 mil entre rodadas, o mesmo corte.
4. `risco: alto` → subagente `security` sobre `git -C <repo> diff origin/main...<branch>`; achado crítico vira correção como no FAIL abaixo.
5. **Review** — só se houver commit novo desde a última prova (`.code-review-ok.json`). Rode a skill `code-review` (Skill tool) **sem perguntar o ponto fixo**: em cada repositório da fatia, ponto fixo `origin/main`, diff `git -C <repo> diff origin/main...<branch>`, spec = o arquivo da fatia. **Os dois sub-agentes que a skill manda abrir (Standards e Spec) abra com `subagent_type: revisor`** (`.claude/agents/revisor.md`: só leitura, ferramentas mínimas), mantendo os prompts, os smells e a agregação da skill inteiros: sem tipo eles viram `general-purpose` com ~65 ferramentas e gastam ~75 mil só de base cada (medido na P1); o `revisor` começa em ~15 mil. Painel: `- [ ] Review — rodada <n> · pai (<modelo>)` enquanto roda, `FAIL, corrigindo <k> achados` no FAIL, `- [x] Review — PASS na rodada <n>` no PASS.

- **PASS** → passo 4 (Entrega).
- **FAIL** → corrija você mesmo, sem devolver ao humano: cada achado vai pra filha dona do arquivo/commit, com TDD quando é comportamento, commit `fix: <achado> (B2.N · workspace#<filha>)`; rode o review de novo. **No máximo 2 rodadas de correção.** Achado de padrão marcado como julgamento (smell) que você decide não corrigir → vai na descrição da MR com o motivo.
- FAIL na 3ª rodada → **pare** (passo 5): quase sempre é spec ambígua ou achado com o qual você discorda, e isso é decisão humana.

## 4. Entrega

Em cada repositório da fatia (`docs/agents/orchestration.md`, "Entrega"): prova `.code-review-ok.json` + commit, `git -C <repo> push -u origin <branch>`, e — sem o gate do template-ci (`grep -q verify-code-review <repo>/.gitlab-ci.yml` falha) — a MR pra `main`, título `B2 — <título da mãe>`, descrição no formato de lá (com a coluna **Executor**). MR já aberta: só o push (ela se atualiza) e a resposta em cada comentário tratado. Na mãe: `glab issue note <mãe> -m "MR pronta pra revisão: <link>"` e, no painel, `- [x] MR — <link>`. A mãe **continua aberta com `em-execucao`**: quem fecha a mãe e as filhas e tira o label é o merge da MR (job `fechar-fatia` do template-ci, ou "Fechar a fatia" no próximo comando).

## 5. Encerrar — sempre com este relatório

```
B2 — PRONTA PARA SUA REVISÃO          (ou: B2 — PAROU: precisa de você)
MR: <link> (main ← feature/b2-<slug>)   · filhas B2.1–B2.5 ✔ · review PASS na rodada <n>
Executores: <ex.: pai (Claude) em B2.1–B2.3 · backend (omni-pago) em B2.4–B2.5 · review: pai (Claude)>
Gasto: <saída de `node .claude/scripts/gasto.mjs --resumo`; a tabela por ticket é o `/gasto`>
Suposições: <as que você fez e o humano deve conferir>
Você agora: <a próxima ação humana, concreta>
Depois: <o que /proximo diria: fatia que isto destrava e fatias que já podem rodar em paralelo; cada fatia citada com o código e o título do mapa, ex.: `/fatia F0.5` — Shell, sessão compartilhada, interceptors e guards>
```

"Você agora", conforme o caso: **pronta** → a MR **já está aberta** (o link vai no relatório; nunca diga "abra a MR" nem peça para criá-la): ler o diff, testar (comandos do "Como testar"), aprovar e mergear — ou comentar na MR e rodar `/implement-task B2` de novo; **parou** → o motivo e a decisão exata que falta (ex.: "o critério 3 da spec diz X e o código legado Y: qual vale?"). Ao parar, registre o mesmo texto na mãe (`glab issue note`) e troque a linha do painel onde parou por `⚠ parou: <motivo em uma frase>`; o `em-execucao` fica (a fatia segue sua). Termine com uma notificação (ferramenta `PushNotification`, quando a sessão tiver) com a primeira linha do relatório.
