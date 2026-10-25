# Orquestração de execução: Claude Code + subagentes

Tudo roda no Claude Code: discovery, spec, tickets, execução e review. A execução de uma spec é o comando `/implement-task` (`.claude/commands/implement-task.md`): a sessão é o agente-pai, e cada task é feita por subagentes de `.claude/agents/`, cada um com contexto próprio e limpo — é isso que mantém o escopo da task.

Economia de tokens: RTK ligado pelo hook do Claude Code (setup de máquina). Caveman nunca — medido líquido negativo em sessão de código.

## Três modos, mesma orquestração

O modelo não é decidido aqui: cada subagente declara um **apelido** (`sonnet`, `haiku`), e o modo em que a sessão foi aberta diz o que o apelido significa. Os mesmos arquivos funcionam nos três.

| Modo | Abre com | Agente-pai | `sonnet` (executores, `review`, `security`) | `haiku` (`tests`, `qa`) |
|---|---|---|---|---|
| **Claude** (padrão) | `claude` | seu plano | Sonnet | Haiku |
| **Pago** | `claude-pago` | OmniRoute `omni-pago` | `omni-pago` (DeepSeek → Luna) | `omni-free` |
| **Free** | `claude-free` | OmniRoute `omni-free` | `omni-free` | `omni-light` |

- Os modos pago e free são o mesmo Claude Code apontado pro OmniRoute (`ANTHROPIC_BASE_URL`), com o mapeamento dos apelidos e o raciocínio desligado (DeepSeek e Luna aceitam o histórico um do outro só sem raciocínio — `ai-infra/configs/omniroute/combos.md`). Configuração em `~/.claude/modos/` (setup de máquina, `ai-ops/agents/infra/local-environment-config/docs/enviroment/claude-modos.md`).
- **A assinatura do Claude nunca passa pelo OmniRoute** (é o que dá banimento): o modo Claude fala direto com a Anthropic; o OmniRoute só usa as chaves de API dos outros providers.
- Trocar de modo é fechar a sessão e abrir a próxima task (ou spec) no outro modo — nunca no meio de uma conversa.

## Subagentes (`.claude/agents/*.md`)

| Papel | Quando entra |
|---|---|
| `data`, `backend`, `front`, `ui` | executores no modo pago/free (no modo Claude o pai implementa direto), cada um com TDD da própria fatia |
| `tests` | só se a task junta duas ou mais camadas |
| `security` | em task de auth, sessão, segredo, permissão ou dependência nova; com `risco: alto` na spec, também uma vez sobre o diff da fatia |
| `review` | por task no modo pago/free (somente leitura: spec, padrões, segurança básica — o escopo mecânico já saiu do `check-escopo.mjs`); no modo Claude quem revisa é o `/code-review` no fim da fatia, chamado pelo próprio `/implement-task` |
| `qa` | fora do `/implement-task`: valida o ambiente `qa` publicado (`docs/agents/esteira-deploy.md`) |

**Modo Claude:** o agente-pai implementa cada task direto (TDD), sem subagente executor nem `review` por task — o `/code-review` no fim da fatia revisa tudo. **Modo pago/free:** o agente-pai monta um `$TASK` autocontido por task (trecho da spec, o que **não** tocar, arquivos esperados, 2–4 arquivos de contexto), delega ao executor e ao `review`. Nos dois: testes da task com filtro durante o trabalho, **suite completa uma vez por fatia, pelo pai, antes do review** (a de integração sobe containers — é o maior custo de tempo; o CI da MR cobre o resto); escopo conferido por `.claude/scripts/check-escopo.mjs` (arquivo fora do escopo, "Não toque", teste apagado, `skip`/`only`, asserção a menos — sem LLM). Subagente não comita nem faz push; o hook `.claude/hooks/block-dangerous-git.sh` vale pra todos.

## Nomes — tudo ligado pelo código da fatia

O código da fatia no mapa (`specs/README.md`: `B2`, `A1`…) liga issue, branch, commit e MR. Com ele você acha tudo no GitLab e no git sem decorar número de issue.

| Coisa | Formato | Exemplo |
|---|---|---|
| Issue-mãe (spec) | `<fatia> — <título>` | `B2 — Result pattern + Problem Details (ADR-0003)` · workspace#2 |
| Issue filha (task) | `<fatia>.<N> — <título>` | `B2.5 — VOs com fábrica Result` · workspace#8 |
| Branch (em cada repositório tocado) | `feature/<fatia minúscula>-<slug da spec>` | `feature/b2-result-e-problem-details` |
| Commit | `<tipo>: <o que fez> (<fatia>.<N> · workspace#<filha>)` | `feat: VOs devolvem Result (B2.5 · workspace#8)` |
| MR (pra `dev`) | `<fatia> — <título da mãe>` | `B2 — Result pattern + Problem Details (ADR-0003)` |

Os comandos aceitam o código: `/implement-task B2`, `/implement-task B2.5`, `/code-review B2`. O `#n` continua valendo, mas ninguém precisa digitar.

## Ciclo de uma fatia — quem faz o quê

Uma sessão por fatia, na **raiz do workspace** (enxerga `<projeto>-api/` e `<projeto>-frontend/`).

**Estado do GitLab sempre sincronizado:** todo comando que confere algo contra `dev`/`main` ("está mergeada?", "filha feita?", "bloqueada?") roda `git -C <repo> fetch origin` antes, em cada repositório envolvido. A cópia local (`origin/dev`) só muda no fetch — sem ele, uma MR que você acabou de mergear parece não existir.

| # | Humano | LLM (Claude Code) |
|---|---|---|
| 1 | `/fatia B2` → **aprova a spec** (única leitura antes do código) | escreve a spec (com `risco` e "Toca em") e para; com o ok abre a mãe `B2 — …`, linka no mapa |
| 2 | nada (só `risco: alto`: lê os tickets) | cria as filhas `B2.1 — …`, `B2.2 — …` (`Blocked by:` e `Cobre:`) e confere a cobertura por script |
| 3 | nada (o `/fatia` segue sozinho; ou `/implement-task B2` à parte) | `em-execucao` na mãe → filhas com TDD, um commit cada (executor no painel) → suite completa uma vez → `/code-review` → corrige os achados sozinho (até 2 rodadas) → push → MR pra `dev` → relatório + notificação |
| 4 | na MR: lê, testa a branch, **aprova e mergeia** — ou comenta na MR e roda `/implement-task B2` de novo | lê os comentários não resolvidos, corrige, revisa, faz push, responde cada comentário |
| 5 | nada | no merge, o CI fecha a mãe e as filhas e tira `em-execucao` (job `fechar-fatia`); sem o job, o próximo `/implement-task`/`/to-spec` fecha (abaixo) |

Perdeu o fio? `/proximo` (ou `/proximo B3`) diz em que pé está, qual o seu próximo passo e de onde vem cada fatia (linha do mapa, ADR, spec). Os comandos soltos `/to-spec`, `/to-tickets` e `/implement-task` continuam valendo; `/fatia` só os encadeia.

**Acompanhar sem o terminal:** a mãe de uma fatia em execução tem o label `em-execucao` (o board de issues por label mostra todas as fatias em andamento numa tela) e a descrição dela ganha o painel "Execução": **área** onde roda, **modo** da sessão e uma linha por filha com o sha do commit e **quem executou** (`pai (Claude)`, `backend (omni-pago)`…), mais Suite, Review e MR. O painel é atualizado em lote (início, filha comitada, suite, review, MR, parada) — não há label nem nota por filha. A lista de issues mostra a contagem ("3 of 7"). O mesmo executor vai no trailer `Executed-by:` de cada commit e na descrição da MR. O fluxo registra *o que o processo mandou executar* (modo da sessão + apelido do subagente); o modelo que o OmniRoute de fato serviu só aparece no log dele.

O LLM **para e devolve pra você** só quando: working tree sujo num repositório da fatia, filha bloqueada, review FAIL depois de 2 rodadas de correção, ou spec ambígua. O relatório diz `PAROU: precisa de você` e a decisão exata que falta, e o mesmo texto vai como nota na mãe. Resolveu → `/implement-task B2` de novo: ele retoma de onde parou (filha feita = commit com `workspace#<n>)` alcançável pela branch).

## Entrega

`/code-review` roda numa sessão interativa (nunca headless/`-p` disparado pelo CI — risco de cobrança fora do plano). A skill é de fora e não sabe da entrega; **com PASS, o Claude Code faz, em cada repositório de código alterado:**
1. grava `.code-review-ok.json` na raiz do repositório com `{"commit": "<sha revisado>", "data": "<ISO>", "spec": "<caminho>"}` e comita só esse arquivo (`chore: prova de code review (<fatia>)`) — o sha é o do commit revisado, que fica como pai desse;
2. `git -C <repo> push -u origin <branch>`;
3. sem o gate do template-ci ligado no repositório (`verify-code-review` no `.gitlab-ci.yml`): abre a MR — `glab mr create -R <grupo>/<repo> --source-branch <branch> --target-branch dev --title "<fatia> — <título da mãe>" --description "<abaixo>"`. Com o gate ligado, quem abre é o CI.

Descrição da MR:
```markdown
Fatia **B2** · spec `specs/feature/base/02-…md` · mãe <grupo>/<projeto>-workspace#2

| Task | Issue | Commit | Executor |
|---|---|---|---|
| B2.1 — … | workspace#4 | <sha> | pai (Claude) |

**Review:** PASS na rodada <n>. Achados de julgamento não corrigidos: <lista com o motivo, ou "nenhum">.
**Suposições:** <as que o humano deve conferir>.
**Como testar:** `git -C <repo> switch <branch>` · <comando de teste/subida> · <o que olhar, por critério>.
```

Sem `Closes`: a MR vai pra `dev`, e o GitLab só fecha issue no merge pro branch padrão. Quem fecha é "Fechar a fatia", abaixo.

O gate `verify-code-review` do template-ci (só bash, nenhuma IA) aceita a prova quando o sha gravado é o do push, ou o pai dele com o último commit mexendo só no `.code-review-ok.json`. Bateu: abre a MR pra `dev`. Não bateu: pipeline falha, rode `/implement-task <fatia>` de novo. Promoção `dev → qa/hml/main` é a esteira de deploy (`docs/agents/esteira-deploy.md`).

## Fechar a fatia

**No merge (automático):** o job `fechar-fatia` do template-ci (`review/fechar-fatia.yml`) roda no push em `dev` de cada repositório de código. Acha a MR mergeada pelo código da fatia (branch `feature/b2-…` ou título `B2 — …`); se **todas** as MRs da fatia nos repositórios do projeto já estão mergeadas, ele: nota na mãe com os links, fecha as filhas e a mãe, tira `em-execucao`. Liga com `FECHAR_FATIA_ENABLED: "true"` + `WORKSPACE_PROJECT` + `SLICE_REPOS` e usa o mesmo `GITLAB_TOKEN` do gate de review (escopo `api`, e acesso ao workspace). A linha do `specs/README.md` o job não toca (é commit no workspace).

**Rede de segurança (sem o job, ou se ele falhou):** roda no começo de todo `/implement-task`, `/to-spec` e `/fatia`, sem o humano pedir. Para cada issue-mãe aberta: se a MR `<fatia> — …` de **cada** repositório que ela tocou está mergeada em `dev` (`glab mr list -R <grupo>/<repo> --merged --search "<fatia> —"`):
1. nota na mãe com os links das MRs mergeadas;
2. `glab issue close` em cada filha e na mãe, e tira `em-execucao`;
3. a linha da fatia no `specs/README.md` passa a "feito" no próximo commit de docs do workspace (o do `/to-spec` seguinte), nunca num commit avulso na `main`. Fatia com artefato que outras specs vão citar (`DESIGN.md`, contrato novo, ADR): o mesmo commit aponta pra ele no `CLAUDE.md` do componente.

## Execução paralela

Fatias que não se tocam rodam em paralelo, **um painel do Alethe por fatia**, cada uma com a sua branch, a sua área e o modo que você escolher. Você governa por duas telas: o **board de issues do workspace por label** (`em-execucao`: uma coluna com todas as mães em andamento, cada uma com o painel de progresso e o executor) e o `/proximo` num painel livre.

1. **Quais podem rodar juntas:** "Depende de" feito e "Toca em" sem cruzamento (colunas do `specs/README.md`; `/proximo` lista). Sem a coluna, não há garantia — rode uma de cada vez.
2. **Uma área por fatia** (os repositórios de código são aninhados no workspace; um `git switch` num painel quebraria o outro): `node .claude/scripts/worktree-fatia.mjs B2 <slug>` cria `<workspace>.wt/b2/` — worktree do workspace + worktree de cada repositório de código na branch `feature/b2-<slug>` + junction das skills. Abra o painel nessa pasta (`claude`, `claude-pago` ou `claude-free`) e rode `/fatia B2` ou `/implement-task B2`. Ao fim: `node .claude/scripts/worktree-fatia.mjs --remove B2`.
3. **Trava:** o `/implement-task` põe `em-execucao` na mãe e grava a área no painel. Outro painel que tente a mesma fatia para; sem argumento, cada painel pega a próxima fatia **livre** (sem `em-execucao`, sem cruzar o "Toca em" das que estão rodando). Na raiz do workspace com outra fatia em execução, ele manda criar a área isolada.
4. **Governança igual:** cada fatia tem a sua spec aprovada, o seu review e a sua MR; nada se mistura. Cada painel termina com a notificação e o relatório (inclusive `PAROU: precisa de você`). Comece com 2 painéis.
