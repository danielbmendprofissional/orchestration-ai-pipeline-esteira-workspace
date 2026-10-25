# Issue tracker: GitLab

Preferência: **GitLab MCP**, quando configurado no projeto — acesso estruturado a issues/MRs sem depender de binário. Até o MCP estar configurado, usar os comandos `glab` abaixo como fallback. Quando o MCP entrar, trocar os comandos por chamada de ferramenta equivalente — a lógica de convenção (wayfinding, labels) continua a mesma.

## Convenções

- **Criar issue**: `glab issue create --title "..." --description "..."`. Heredoc pra descrição multi-linha. `--description -` abre editor.
- **Ler issue**: `glab issue view <number> --comments`. `-F json` pra saída programática.
- **Listar issues**: `glab issue list -F json` com `--label` conforme necessário.
- **Comentar**: `glab issue note <number> --message "..."`. GitLab chama comentário de "note".
- **Aplicar/remover label**: `glab issue update <number> --label "..."` / `--unlabel "..."`.
- **Fechar**: `glab issue close <number>`. Como `close` não aceita comentário, postar a explicação antes com `glab issue note`, depois fechar.
- **Merge requests**: `glab mr create`, `glab mr view`, `glab mr note` — mesmo padrão de `gh pr ...` trocando `pr` por `mr` e `comment`/`--body` por `note`/`--message`.

**Todas as issues ficam no `<projeto>-workspace`** (ver `docs/agents/workspace.md`): sempre passar `-R <grupo>/<projeto>-workspace` nos comandos de issue — rodado de dentro de `<projeto>-api/` o `glab` inferiria o repositório errado. Label de área obrigatória em toda issue: `backend`, `frontend` ou as duas. MR é criada no repositório de código (`glab mr create -R <grupo>/<projeto>-api ...`) e cita a mãe (`<grupo>/<projeto>-workspace#<n>`) na descrição. MR de fatia vai pra `dev`, onde `Closes` não fecha nada (o GitLab só fecha no merge pro branch padrão): quem fecha mãe e filhas é "Fechar a fatia" em `docs/agents/orchestration.md`.

**Títulos:** issue-mãe `<fatia> — <título>` (ex.: `B2 — Result pattern + Problem Details`), filha `<fatia>.<N> — <título>` na ordem do `Blocked by` (ex.: `B2.5 — VOs com fábrica Result`). É o código da fatia que liga issue, branch, commit e MR (tabela "Nomes" em `docs/agents/orchestration.md`).

`glab` infere o repo a partir de `git remote -v` quando rodado dentro do clone — na raiz do workspace, isso já é o repositório das issues.

## Merge requests como superfície de triagem

**MRs como superfície de request: não.** _(Mude para `sim` se este repo tratar MRs externos como feature requests; `/triage` lê essa flag.)_

## Quando uma skill diz "publicar no issue tracker"

Criar uma issue no GitLab.

## Quando uma skill diz "buscar o ticket relevante"

Rodar `glab issue view <number> --comments`.

## Quando a spec já existe como arquivo versionado no repo

É o modelo padrão deste template (formato em `docs/agents/spec-format.md`): a spec é arquivo Markdown no workspace (`specs/feature/<área>/NN-nome.md`) — fonte de verdade versionada, com seção `## Contexto necessário` explícita, porque nem todo executor empilha `CLAUDE.md` automaticamente por pasta.

Nesse modelo, `/to-spec` não substitui o arquivo por uma issue: abre uma **issue-mãe** que referencia o arquivo (link relativo + resumo na descrição, nunca o conteúdo inteiro copiado). Essa issue-mãe é a superfície que os agentes-pai usam pra orquestrar os subagents via GitLab — mesmo papel do **map** nas operações de wayfinding abaixo. `/to-tickets` continua criando as issues filhas normalmente, cada uma `Part of #<issue-mãe>`.

Se o projeto não tiver esse modelo de arquivo, `/to-spec` publica a spec inteira como issue, como descrito no resto deste documento.

## Tickets de uma spec (`/to-tickets`)

Onde a skill diz "make each ticket its sub-issue": no GitLab, ticket de spec é **Task filha da issue-mãe** (Child items, funciona no Free). Pra cada ticket, em ordem de dependência:

1. Criar como task: MCP `create_issue` com `issue_type: "task"` (ou `glab issue create ... --type task`), título `<fatia>.<N> — <título>`, labels de área + `ready-for-agent`, descrição começando com `Part of #<mãe>` e `Blocked by: #<n>, #<n>` (ou `Blocked by: —`).
2. Ligar à mãe pela GraphQL (não há REST pra hierarquia):
   ```bash
   glab api graphql -f query='query { project(fullPath:"<grupo>/<projeto>-workspace") { workItems(iids:["<mãe>","<filha>"]) { nodes { id iid } } } }'
   glab api graphql -f query='mutation { workItemUpdate(input:{id:"<gid da filha>", hierarchyWidget:{parentId:"<gid da mãe>"}}) { errors } }'
   ```
   Se a filha nasceu como Issue, converter antes: `workItemConvert(input:{id:"<gid>", workItemTypeId:"<gid do tipo Task>"})` (o gid do tipo sai de `project { workItemTypes { nodes { id name } } }`).
3. Conferir: `workItems(iids:["<mãe>"]) { nodes { widgets { ... on WorkItemWidgetHierarchy { children { nodes { iid } } } } } }` lista todas as filhas.

Bloqueio continua como texto (`Blocked by:`): o vínculo nativo "blocks" é Premium.

## Operações de wayfinding

Usadas por `/wayfinder`. O **map** é uma issue única com issues **filhas** como tickets.

- **Map**: issue única com label `wayfinder:map`, corpo Notes / Decisions-so-far / Fog. `glab issue create --label wayfinder:map`.
- **Ticket filho**: issue com `Part of #<map>` no topo da descrição e label `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Ao ser reivindicado, atribuído ao dev que está tocando.
- **Bloqueio**: link nativo do GitLab via quick action `/blocked_by #<n>`, postado como note (recurso Premium/Ultimate; no tier free, usar linha `Blocked by: #<n>, #<n>` no topo da descrição). Ticket desbloqueia quando todos os bloqueadores fecham.
- **Frontier query**: `glab issue list -F json` filtrado nas filhas do map, descartando as com bloqueador aberto ou assignee; a primeira na ordem do map vence.
- **Claim**: `glab issue update <n> --assignee @me`, primeira escrita da sessão.
- **Resolve**: `glab issue note <n> --message "<resposta>"`, depois `glab issue close <n>`, depois anexar um ponteiro de contexto às Decisions-so-far do map.