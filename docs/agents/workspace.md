# Workspace: um projeto, vários repositórios

Padrão de todo projeto nascido do `ai-base`. Um **grupo** no GitLab por projeto, uma **pasta local** com um repositório git por componente — o mesmo desenho do próprio `orquestracao-ai`.

```
GitLab: grupo valuto/                       Local: valuto/              ← clone do valuto-workspace
  ├── valuto-workspace   regras + issues            ├── CLAUDE.md, .claude/, docs/, CONTEXT-MAP.md
  ├── valuto-api         .NET   (template-ci)       ├── valuto-api/        (.git próprio — ignorado pelo workspace)
  └── valuto-frontend    Angular (template-ci)      └── valuto-frontend/   (.git próprio — ignorado pelo workspace)
```

## O que mora em cada repositório

| Repositório | Conteúdo | Pipeline |
|---|---|---|
| `<projeto>-workspace` | Este template (`CLAUDE.md`, `.claude/` (subagentes, comando `/implement-task`, hook), `docs/`, `CONTEXT-MAP.md`, ADRs transversais) e **todas as issues** do projeto | Nenhuma |
| `<projeto>-api` | Código .NET, `CONTEXT.md` do backend, `deploy/k8s/`, `.gitlab-ci.yml` (`templates/api.gitlab-ci.yml`) | template-ci, `APP_TECHNOLOGY: dotnet` |
| `<projeto>-frontend` | Código Angular, `nginx/`, `deploy/k8s/`, `.gitlab-ci.yml` (`templates/frontend.gitlab-ci.yml`) | template-ci, `APP_TECHNOLOGY: angular` |

Componente novo (ex: `<projeto>-worker`) segue o mesmo padrão: repositório próprio no grupo, pasta própria no workspace, linha nova no `.gitignore` do workspace e no `CONTEXT-MAP.md`.

O Claude Code sempre abre na **raiz do workspace** — enxergam todos os componentes e carregam as regras daqui. `CLAUDE.md` aninhado em `<projeto>-api/` ou `<projeto>-frontend/` (stack daquele componente) empilha automaticamente quando o trabalho entra na pasta.

## Git: sempre no repositório certo

- Toda operação de git aponta o repositório explicitamente: `git -C <projeto>-api status`, `git -C <projeto>-frontend commit ...`. Nunca rodar git "solto" na raiz achando que pega o código — na raiz só existe o repositório do workspace.
- Branch de feature com **o mesmo nome** em todo repositório que a issue tocar (`feature/42-cadastro-cliente` na api e no frontend). Só cria a branch onde houver mudança.
- Uma MR por repositório alterado, todas pra `dev`, cada uma referenciando a mesma issue.
- O hook `.claude/hooks/block-dangerous-git.sh` olha o comando, não a pasta — vale igual com `git -C`.

## Issues: todas no workspace

GitLab Free não tem issue de grupo nem épico (Premium) — toda issue pertence a um projeto. Por isso todas ficam no `<projeto>-workspace`, separadas por label de área:

| Label | Quando |
|---|---|
| `backend` | toca o `<projeto>-api` |
| `frontend` | toca o `<projeto>-frontend` |
| as duas | feature ponta a ponta |

(Labels simples — `area::backend` é label com escopo, recurso Premium.)

- Ler/criar: `glab issue list -R <grupo>/<projeto>-workspace --label backend`.
- Citar a issue na MR de outro repositório: `<grupo>/<projeto>-workspace#42` na descrição (referência entre projetos funciona no Free). `Closes` não serve aqui: a MR vai pra `dev` e o GitLab só fecha no merge pro branch padrão. Quem fecha é "Fechar a fatia" (`docs/agents/orchestration.md`).
- A lista de issues **do grupo** no GitLab mostra tudo junto.

## Feature que toca API e frontend

Os repositórios são versionados e promovidos de forma independente — no mesmo ambiente podem conviver `api v2.0` e `frontend v1.4`. Então:

1. **A API sobe primeiro e é retrocompatível** (expand/contract): campo novo opcional, endpoint novo ao lado do antigo. O frontend antigo continua funcionando com a API nova.
2. O frontend que usa a novidade sobe depois.
3. Remover o que ficou velho (campo, endpoint) é uma task separada, depois que nenhuma versão em uso depende dele.

Mesma regra das migrations do banco (só pra frente, ver `template-ci/docs/fluxo-de-tags.md`).

## Tags e esteira

Por repositório: cada um tem seu `dev → qa → hml → main`, suas tags `vX.Y.Z-rcN` e suas promoções (`docs/agents/esteira-deploy.md`). Rodada que tocou os dois gera tag nos dois — a da API promove antes ou junto, nunca depois da do frontend que depende dela.

## Code review

`/code-review` grava a prova `.code-review-ok.json` **na raiz de cada repositório de código alterado** (`<projeto>-api/.code-review-ok.json`), com o sha do commit revisado daquele repositório — o CI de cada um confere a sua (`docs/agents/orchestration.md`).
