# Orquestração de execução: Claude Code + subagentes

Tudo roda no Claude Code: discovery, spec, tickets, execução e review. A execução de uma spec é o comando `/implement-task` (`.claude/commands/implement-task.md`): a sessão é o agente-pai, e cada task é feita por subagentes de `.claude/agents/`, cada um com contexto próprio e limpo — é isso que mantém o escopo da task.

Economia de tokens: RTK ligado pelo hook do Claude Code (setup de máquina). Caveman nunca — medido líquido negativo em sessão de código.

## Três modos, mesma orquestração

O modelo não é decidido aqui: cada subagente declara um **apelido** (`sonnet`, `haiku`), e o modo em que a sessão foi aberta diz o que o apelido significa. Os mesmos arquivos funcionam nos três.

| Modo | Abre com | Agente-pai | `sonnet` (executores, `review`, `security`) | `haiku` (`tests`, `qa`) |
|---|---|---|---|---|
| **Claude** (padrão) | `claude` | seu plano | Sonnet | Haiku |
| **Pago** | `claude-pago` | OmniRoute `pi-code` | `pi-code` (DeepSeek → Luna) | `pi-exec` |
| **Free** | `claude-free` | OmniRoute `pi-exec` | `pi-exec` | `pi-light` |

- Os modos pago e free são o mesmo Claude Code apontado pro OmniRoute (`ANTHROPIC_BASE_URL`), com o mapeamento dos apelidos e o raciocínio desligado (DeepSeek e Luna aceitam o histórico um do outro só sem raciocínio — `ai-infra/configs/omniroute/combos.md`). Configuração em `~/.claude/modos/` (setup de máquina, `ai-ops/agents/infra/local-environment-config/docs/enviroment/claude-modos.md`).
- **A assinatura do Claude nunca passa pelo OmniRoute** (é o que dá banimento): o modo Claude fala direto com a Anthropic; o OmniRoute só usa as chaves de API dos outros providers.
- Trocar de modo é fechar a sessão e abrir a próxima task (ou spec) no outro modo — nunca no meio de uma conversa.

## Subagentes (`.claude/agents/*.md`)

| Papel | Quando entra |
|---|---|
| `data`, `backend`, `front`, `ui` | executores no modo pago/free (no modo Claude o pai implementa direto), cada um com TDD da própria fatia |
| `tests` | só se a task junta duas ou mais camadas |
| `security` | só em auth, sessão, segredo, permissão ou dependência nova |
| `review` | por task no modo pago/free (somente leitura: escopo, spec, integridade dos testes, segurança básica); no modo Claude quem revisa é o `/code-review` no fim da spec |
| `qa` | fora do `/implement-task`: valida o ambiente `qa` publicado (`docs/agents/esteira-deploy.md`) |

**Modo Claude:** o agente-pai implementa cada task direto (TDD), sem subagente executor nem `review` por task — o `/code-review` no fim da spec revisa tudo. **Modo pago/free:** o agente-pai monta um `$TASK` autocontido por task (trecho da spec, o que **não** tocar, arquivos esperados, 2–4 arquivos de contexto), delega ao executor e ao `review`. Nos dois: testes da task com filtro durante o trabalho, **suite completa uma vez por task, pelo pai, antes do commit** (a de integração sobe containers — é o maior custo de tempo); escopo conferido com `git diff --stat`. Subagente não comita nem faz push; o hook `.claude/hooks/block-dangerous-git.sh` vale pra todos.

## Ciclo de uma spec

Uma sessão por spec, na **raiz do workspace** (enxerga `<projeto>-api/` e `<projeto>-frontend/`); uma branch `feature/<issue-mãe>-<slug>` por spec, a mesma em cada repositório tocado; um commit por issue filha.

1. `/implement-task #<issue-mãe>` (ou vazio: próxima spec desbloqueada do mapa). Lê issue e spec pelo `glab`, cria a branch a partir de `origin/dev`, faz as filhas na ordem do `Blocked by`, comita cada uma com `review` PASS. **Sem push.**
2. `/code-review` (mesma sessão ou nova). PASS → fecha a entrega (abaixo). FAIL → `/implement-task #<filha> — corrigir: <achados>`.
3. Você aprova o merge da MR.

## Depois do `/code-review` dar PASS

`/code-review` roda numa sessão interativa (nunca headless/`-p` disparado pelo CI — risco de cobrança fora do plano). A skill é de fora e não sabe da entrega; **com PASS, o Claude Code faz, em cada repositório de código alterado:**
1. grava `.code-review-ok.json` na raiz do repositório com `{"commit": "<sha revisado>", "data": "<ISO>", "spec": "<caminho>"}` e comita só esse arquivo (`chore: prova de code review`) — o sha é o do commit revisado, que fica como pai desse;
2. `git -C <repo> push -u origin <branch>`;
3. sem o gate do template-ci ligado no repositório: abre a MR — `glab mr create -R <grupo>/<repo> --source-branch <branch> --target-branch dev --title "<fatia>" --description "Closes <grupo>/<projeto>-workspace#<mãe> ..."` (e as filhas). Com o gate ligado, quem abre é o CI.

O gate `verify-code-review` do template-ci (só bash, nenhuma IA) aceita a prova quando o sha gravado é o do push, ou o pai dele com o último commit mexendo só no `.code-review-ok.json`. Bateu: abre a MR pra `dev`. Não bateu: pipeline falha, rode `/code-review` de novo. Promoção `dev → qa/hml/main` é a esteira de deploy (`docs/agents/esteira-deploy.md`).

## Execução paralela

Specs sem dependência entre si rodam em sessões paralelas, uma por painel do Alethe, cada uma na sua branch e no modo que você escolher.
