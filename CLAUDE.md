# ai-base

Projeto base para todo novo workflow assistido por IA — backend sem stack fixa; frontend fixo em Angular (ver seção abaixo). O que fica fixo aqui é o **processo**: discovery → spec → tickets → TDD → review → commit → merge request para branch protegida (validação humana).

## Estrutura: workspace com um repositório por componente

Este repositório é o **workspace** do projeto (`<projeto>-workspace`): regras, docs, specs e issues. O código mora em repositórios próprios dentro desta pasta — `<projeto>-api/` (.NET) e `<projeto>-frontend/` (Angular) —, cada um com git, tags e esteira independentes. Git sempre com `git -C <repositório>`, issues sempre no workspace. Ver `docs/agents/workspace.md`.

## Papéis fixos das ferramentas

- **Claude Code**: tudo — discovery, spec, tickets, execução e review. A sessão pensa e decide; a execução de uma spec (`/implement-task`) delega cada task a subagentes de `.claude/agents/` (`data`/`backend`/`front`/`ui`/`tests`/`security`/`review`), cada um com contexto limpo.
- **Modelo:** cada subagente declara só um apelido (`sonnet`/`haiku`); a sessão aberta com `claude` usa o seu plano, com `claude-pago`/`claude-free` usa os combos do OmniRoute. Ver `docs/agents/orchestration.md`.

## Stack fixa de frontend

**Angular** é a stack fixa pra todo site/aplicativo web enterprise/SaaS criado a partir deste template. React fica reservado só pra landing page isolada ou uso futuro pontual, quando a spec deixar isso explícito. Backend não tem stack fixa. Ver `docs/design/component-library.md` (spartan/ui como biblioteca de componentes — ADR-0015, o PrimeNG 22 deixou de ser MIT —, skills oficiais do Angular) e `docs/design/principios.md` (cadeia `ui-ux-pro-max-skill` + `impeccable.style` + `avoid-ai-design` contra ai-slop).

**Padrões que o projeto herda** (o discovery confirma; o que divergir vira ADR do projeto citando a seção): `docs/agents/padrao-frontend.md` (stack, camadas, config em runtime, sessão no front) e `docs/agents/padrao-api.md` (paginação, erros, sessão BFF, permissões, identificadores). Na Esteira, as ADRs 0002–0006 e 0014 registram essas mesmas decisões e prevalecem se divergirem.

Ver `docs/workflow.md` para o fluxo completo ponta a ponta, `docs/agents/orchestration.md` para o `/implement-task`, os subagentes e os três modos (Claude, pago, free), `docs/design/` para tokens/biblioteca de componentes/princípios anti-ai-slop.

## Agent skills

As skills em `.claude/skills/` têm `disable-model-invocation: true` — nenhuma dispara sozinha por descrição bater com o contexto. Só rodam quando chamadas explicitamente (`/grill-me`, "use a skill code-review", etc.). Isso é deliberado, pra não gastar token com skill que o agente decidiu invocar por conta própria.

**Exceção obrigatória — peças internas:** skill que outra skill chama pelo Skill tool (`grill-with-docs` → `grilling` + `domain-modeling`; `implement` → `tdd` + `code-review`; `improve-codebase-architecture` → `codebase-design`…) **não** pode ter a flag, senão o comando composto quebra. É o mesmo desenho do repositório de origem (mattpocock/skills: só os comandos de entrada têm a flag). A lista sai de um grep, não de memória — `ai-ops/agents/infra/local-environment-config/docs/enviroment/security-skills.md`, passo 3.

**Override de skill de fora:** as skills não são versionadas (reinstaladas pelo `skills-lock.json`), então ajuste nelas se perde — a correção mora aqui. **`/to-spec` segue `docs/agents/spec-format.md`**, não o template nem o processo dele: acha a fatia no mapa, confere o gate, pesquisa ADRs e código e só pergunta o que falta. **`/to-tickets`** publica cada ticket como Task filha da issue-mãe (`docs/agents/issue-tracker.md`, "Tickets de uma spec"). **`/code-review` com PASS** fecha a entrega como em `docs/agents/orchestration.md` ("Depois do `/code-review` dar PASS"): prova `.code-review-ok.json`, push da branch de feature e MR pra `dev` quando o repositório não tem o gate do CI.

### Issue tracker

Issues e specs vivem no GitLab, **todas no repositório do workspace** (label `backend`/`frontend` por área), via GitLab MCP quando configurado no projeto; fallback manual via `glab` documentado em `docs/agents/issue-tracker.md`. Configuração do MCP é por projeto — cada workspace instanciado a partir deste template aponta pro seu próprio grupo no GitLab.

> **Nota de instanciação:** o parágrafo acima é genérico de propósito. Se este arquivo estiver sendo copiado do `ai-base` para um projeto real, não é preciso editar nada aqui — mas confira `docs/agents/issue-tracker.md` no projeto novo pra saber se o MCP já está configurado ou se ainda vale o fallback via `glab`.

### Triage labels

Vocabulário padrão de 5 papéis (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Ver `docs/agents/triage-labels.md`.

### Segurança (skills de auditoria manual)

Camadas de segurança além do checklist automático do subagent `security` (`.claude/agents/security.md`): skills do Claude Code (`security-review`, `owasp-audit`, `dependency-audit`, `secrets-audit`, entre outras) rodadas sob demanda, mais o scanner de infra (`Security-Scanner`, que também roda no stage `security` da esteira). Instalação é setup de projeto, fora deste repo; camadas e fluxo de correção de achado em `docs/agents/security-review.md`.

### Infra (Postgres, Redis, RabbitMQ, Keycloak, observabilidade)

O projeto não sobe esses serviços: usa a infra compartilhada do `ai-infra`, onde ganhou uma "casa" isolada (banco, vhost, realm, prefixo Redis) que não enxerga a de outros projetos. Código e configuração leem **só as chaves do contrato** em `docs/agents/infra-local.md` (`ConnectionStrings:Postgres`, `RabbitMQ:*`, `Keycloak:*`...), em dev via user-secrets — nunca senha em `appsettings*.json` versionado, nunca superusuário/`guest`/`default`, nunca nome de chave inventado. Toda chave/canal Redis com `Redis:KeyPrefix`. Precisa de algo novo na infra (outro serviço, outra role)? Não é código do projeto: vira pedido pro agent `ai-ops/agents/infra/local-environment-config`. Log/métrica/health: `docs/agents/observabilidade-backup.md`.

### Domain docs

**Glossário é sempre `CONTEXT.md`/`CONTEXT-MAP.md`, nunca `GLOSSARY.md`/`GLOSSARY-MAP.md`** — as skills `domain-modeling`/`grill-with-docs` usam esses nomes por padrão; neste repo, onde elas falarem em `GLOSSARY.md` leia `CONTEXT.md`, e `GLOSSARY-MAP.md` leia `CONTEXT-MAP.md`.

`CONTEXT.md`/`CONTEXT-MAP.md` + `docs/adr/` — quantos contextos existem e onde cada um mora é decidido em conversa com o humano (via `/domain-modeling`), não uma estrutura fixa de pasta. Ver `docs/agents/domain.md`.

## Convenções de repo

Fluxo de branches (promoção via esteira de deploy por tag, não é só uma branch protegida):

```
feature-x → MR → dev → qa → hml → main
```

- Vale por repositório de código (`<projeto>-api`, `<projeto>-frontend`), cada um com sua esteira. Issue que toca os dois: mesma branch `feature-x` nos dois, uma MR em cada, API retrocompatível e promovida antes (ver `docs/agents/workspace.md`).
- O agente sempre sobe o trabalho em `feature-x` e abre merge request pra `dev` — nunca commita direto em nenhuma das branches promovidas.
- `dev`, `qa`, `hml` e `main` são todas protegidas. Promoção `dev → qa` é merge direto por tag, feito por você (sem Merge Request; o hook bloqueia agente); `qa → hml` e `hml → main` passam por Merge Request com aprovação humana. Ver `docs/agents/esteira-deploy.md` pro fluxo completo.
- Hotfix direto em `main`: habilitado, mas só por pedido humano direto — branch `hotfix/xxx`, MR, aprovação humana. Não é bypass do processo, é rota de emergência com o mesmo gate de revisão. Ver `docs/agents/esteira-deploy.md`.
- **Isso é reforçado por hook** (`.claude/hooks/block-dangerous-git.sh`, via skill `git-guardrails-claude-code`): bloqueia `git push` direto em `main`/`dev`/`qa`/`hml`, `--force`, `reset --hard`, `clean -f`, `branch -D`, `checkout .`/`restore .`. Push de feature branch funciona normal. Vale pra toda sessão Claude Code, inclusive os subagentes do `/implement-task`.
- Specs e tickets seguem `docs/workflow.md`.