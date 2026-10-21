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

**Todas as issues ficam no `<projeto>-workspace`** (ver `docs/agents/workspace.md`): sempre passar `-R <grupo>/<projeto>-workspace` nos comandos de issue — rodado de dentro de `<projeto>-api/` o `glab` inferiria o repositório errado. Label de área obrigatória em toda issue: `backend`, `frontend` ou as duas. MR é criada no repositório de código (`glab mr create -R <grupo>/<projeto>-api ...`) e fecha a issue com `Closes <grupo>/<projeto>-workspace#<n>` na descrição.

`glab` infere o repo a partir de `git remote -v` quando rodado dentro do clone — na raiz do workspace, isso já é o repositório das issues.

## Merge requests como superfície de triagem

**MRs como superfície de request: não.** _(Mude para `sim` se este repo tratar MRs externos como feature requests; `/triage` lê essa flag.)_

## Quando uma skill diz "publicar no issue tracker"

Criar uma issue no GitLab.

## Quando uma skill diz "buscar o ticket relevante"

Rodar `glab issue view <number> --comments`.

## Quando a spec já existe como arquivo versionado no repo

Alguns projetos (ex: `valuto`) guardam a spec como arquivo Markdown no próprio repo (`specs/feature/{module}/NN-nome.md`) — fonte de verdade versionada junto com o código, com seção `## Contexto necessário` explícita, porque nem todo executor empilha `CLAUDE.md` automaticamente por pasta.

Nesse modelo, `/to-spec` não substitui o arquivo por uma issue: abre uma **issue-mãe** que referencia o arquivo (link relativo + resumo na descrição, nunca o conteúdo inteiro copiado). Essa issue-mãe é a superfície que os agentes-pai usam pra orquestrar os subagents via GitLab — mesmo papel do **map** nas operações de wayfinding abaixo. `/to-tickets` continua criando as issues filhas normalmente, cada uma `Part of #<issue-mãe>`.

Se o projeto não tiver esse modelo de arquivo, `/to-spec` publica a spec inteira como issue, como descrito no resto deste documento.

## Operações de wayfinding

Usadas por `/wayfinder`. O **map** é uma issue única com issues **filhas** como tickets.

- **Map**: issue única com label `wayfinder:map`, corpo Notes / Decisions-so-far / Fog. `glab issue create --label wayfinder:map`.
- **Ticket filho**: issue com `Part of #<map>` no topo da descrição e label `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Ao ser reivindicado, atribuído ao dev que está tocando.
- **Bloqueio**: link nativo do GitLab via quick action `/blocked_by #<n>`, postado como note (recurso Premium/Ultimate; no tier free, usar linha `Blocked by: #<n>, #<n>` no topo da descrição). Ticket desbloqueia quando todos os bloqueadores fecham.
- **Frontier query**: `glab issue list -F json` filtrado nas filhas do map, descartando as com bloqueador aberto ou assignee; a primeira na ordem do map vence.
- **Claim**: `glab issue update <n> --assignee @me`, primeira escrita da sessão.
- **Resolve**: `glab issue note <n> --message "<resposta>"`, depois `glab issue close <n>`, depois anexar um ponteiro de contexto às Decisions-so-far do map.