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
| `security` | só em auth, sessão, segredo, permissão ou dependência nova |
| `review` | por task no modo pago/free (somente leitura: escopo, spec, integridade dos testes, segurança básica); no modo Claude quem revisa é o `/code-review` no fim da fatia, chamado pelo próprio `/implement-task` |
| `qa` | fora do `/implement-task`: valida o ambiente `qa` publicado (`docs/agents/esteira-deploy.md`) |

**Modo Claude:** o agente-pai implementa cada task direto (TDD), sem subagente executor nem `review` por task — o `/code-review` no fim da fatia revisa tudo. **Modo pago/free:** o agente-pai monta um `$TASK` autocontido por task (trecho da spec, o que **não** tocar, arquivos esperados, 2–4 arquivos de contexto), delega ao executor e ao `review`. Nos dois: testes da task com filtro durante o trabalho, **suite completa uma vez por task, pelo pai, antes do commit** (a de integração sobe containers — é o maior custo de tempo); escopo conferido com `git diff --stat`. Subagente não comita nem faz push; o hook `.claude/hooks/block-dangerous-git.sh` vale pra todos.

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

| # | Humano | LLM (Claude Code) |
|---|---|---|
| 1 | `/to-spec B2` → aprova a spec | escreve a spec, abre a mãe `B2 — …`, linka no mapa |
| 2 | `/to-tickets B2` → aprova a quebra | cria as filhas `B2.1 — …`, `B2.2 — …`, com `Blocked by:` |
| 3 | `/implement-task B2` | cabeçalho (fatia, filhas, branch, fora do escopo) → filhas com TDD, um commit cada, nota em cada filha → `/code-review` → corrige os achados sozinho (até 2 rodadas) → push → MR pra `dev` → nota na mãe → relatório + notificação |
| 4 | na MR: lê, testa a branch, **aprova e mergeia** — ou comenta na MR e roda `/implement-task B2` de novo | lê os comentários não resolvidos, corrige, revisa, faz push, responde cada comentário |
| 5 | nada | no próximo `/implement-task` ou `/to-spec`: fecha a fatia mergeada (abaixo) |

**Acompanhar sem o terminal:** a descrição da mãe ganha um checklist "Execução" (uma linha por filha com o sha do commit, mais Review e MR), atualizado a cada mudança de estado. A lista de issues do GitLab mostra a contagem ("3 of 7"), então várias fatias rodando aparecem numa tela só. A filha que está sendo feita tem a label `em-andamento`.

O LLM **para e devolve pra você** só quando: working tree sujo num repositório da fatia, filha bloqueada, review FAIL depois de 2 rodadas de correção, ou spec ambígua. O relatório diz `PAROU: precisa de você` e a decisão exata que falta, e o mesmo texto vai como nota na mãe. Resolveu → `/implement-task B2` de novo: ele retoma de onde parou (filha feita = commit com `workspace#<n>)` alcançável pela branch).

## Entrega

`/code-review` roda numa sessão interativa (nunca headless/`-p` disparado pelo CI — risco de cobrança fora do plano). A skill é de fora e não sabe da entrega; **com PASS, o Claude Code faz, em cada repositório de código alterado:**
1. grava `.code-review-ok.json` na raiz do repositório com `{"commit": "<sha revisado>", "data": "<ISO>", "spec": "<caminho>"}` e comita só esse arquivo (`chore: prova de code review (<fatia>)`) — o sha é o do commit revisado, que fica como pai desse;
2. `git -C <repo> push -u origin <branch>`;
3. sem o gate do template-ci ligado no repositório (`verify-code-review` no `.gitlab-ci.yml`): abre a MR — `glab mr create -R <grupo>/<repo> --source-branch <branch> --target-branch dev --title "<fatia> — <título da mãe>" --description "<abaixo>"`. Com o gate ligado, quem abre é o CI.

Descrição da MR:
```markdown
Fatia **B2** · spec `specs/feature/base/02-…md` · mãe <grupo>/<projeto>-workspace#2

| Task | Issue | Commit |
|---|---|---|
| B2.1 — … | workspace#4 | <sha> |

**Review:** PASS na rodada <n>. Achados de julgamento não corrigidos: <lista com o motivo, ou "nenhum">.
**Suposições:** <as que o humano deve conferir>.
**Como testar:** `git -C <repo> switch <branch>` · <comando de teste/subida> · <o que olhar, por critério>.
```

Sem `Closes`: a MR vai pra `dev`, e o GitLab só fecha issue no merge pro branch padrão. Quem fecha é "Fechar a fatia", abaixo.

O gate `verify-code-review` do template-ci (só bash, nenhuma IA) aceita a prova quando o sha gravado é o do push, ou o pai dele com o último commit mexendo só no `.code-review-ok.json`. Bateu: abre a MR pra `dev`. Não bateu: pipeline falha, rode `/implement-task <fatia>` de novo. Promoção `dev → qa/hml/main` é a esteira de deploy (`docs/agents/esteira-deploy.md`).

## Fechar a fatia

Roda no começo de todo `/implement-task` e `/to-spec`, sem o humano pedir. Para cada issue-mãe aberta: se a MR `<fatia> — …` de **cada** repositório que ela tocou está mergeada em `dev` (`glab mr list -R <grupo>/<repo> --merged --search "<fatia> —"`):
1. nota na mãe com os links das MRs mergeadas;
2. `glab issue close` em cada filha e na mãe;
3. a linha da fatia no `specs/README.md` passa a "feito" no próximo commit de docs do workspace (o do `/to-spec` seguinte), nunca num commit avulso na `main`. Fatia com artefato que outras specs vão citar (`DESIGN.md`, contrato novo, ADR): o mesmo commit aponta pra ele no `CLAUDE.md` do componente.

## Execução paralela

Specs sem dependência entre si rodam em sessões paralelas, uma por painel do Alethe, cada uma na sua branch e no modo que você escolher.
