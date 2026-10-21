# Relatório de ambiente — esteira

Última atualização: 2026-10-21, rodada Etapa 2 (existente — recriação do ambiente).

## Recriação

- Data: 2026-10-21 · Base do template: ai-base@bfe1b43 · Origem: ai-base-antigo · Layout: workspace (mantido — `esteira-workspace` + `esteira-api` + `esteira-frontend`, cada um com `.git` próprio)
- Ambiente de IA: modificados `.pi/agents/backend.md`, `docs/agents/infra-local.md`, `docs/agents/observabilidade-backup.md`; `CLAUDE.md` ganhou a seção "Infra" (agora idêntico ao template). Todos os arquivos de processo iguais ao template; diferem só `README.md` (conteúdo do projeto) e `skills-lock.json` (preenchido pela instalação de skills). Campos `model:` dos `.pi/agents` já batiam com o template.
- Spec de adequação: `specs/feature/infra/00-adequacao-ambiente.md` · issue https://gitlab.com/orchestration-ai/ai-pipeline/esteira/esteira-workspace/-/work_items/1 (`needs-triage`, `backend`)
- Dados antigos: não havia outra origem — o dev já apontava pro Postgres compartilhado (`localhost:5432`, banco `esteira`). Sem dump/restore.

## O que foi feito

- **Infra compartilhada** — `esteira` já estava no manifesto `ai-infra/configs/infra/projects.json` (Postgres, RabbitMQ, Redis, Keycloak BFF, `metrics: host.docker.internal:5105`); `verify` verde. Nada mudou no manifesto.
- **User-secrets da API** — `node infra-config.mjs secrets esteira --csproj=...\esteira-api\src\Esteira.Api\Esteira.Api.csproj`: 16 chaves do contrato gravadas no user-secrets `f4cc2692-4c37-4deb-88e6-51a51f7ed735`. O código **ainda lê os nomes antigos** (`EsteiraConnection`, `Autenticacao:*`, vhost `/`) — a troca é a spec de adequação.
- **`.mcp.json`** — já igual ao template (GitLab, `disabled: true`, `${GITLAB_TOKEN}`). Sem mudança.
- **Skills base** — `mattpocock/skills` (38), `angular/skills` (2), `avoid-ai-design` (git clone) em `.claude/skills/`.
- **Skills de segurança** — `getsentry/skills` (27 no lock) e `briiirussell/cybersecurity-skills` (29 no lock), todas instaladas. Colisão com skill base: `code-review` (Sentry sobrescreveu o do Matt Pocock) — resolvida reinstalando as base por cima; `skills-lock.json` confere `code-review → mattpocock/skills`. `commit` e `pr-writer` da Sentry ficam (não colidem). `security-review` (Sentry) está em disco mas não aparece no `skills-lock.json` — não é colisão com base, só registro.
- **`disable-model-invocation: true`** — conferido no `SKILL.md` de todas as 98 skills base + segurança (só o `impeccable` fica fora, é ferramenta de design de outro procedimento).
- **impeccable** — engine v0.1.16 via bundle baixado (`IMPECCABLE_BUNDLE_PATH`); `SKILL.md` em `.claude/skills/impeccable` e `.pi/skills/impeccable`, mais 4 agents em `.claude/agents/impeccable-*.md`. `.claude/settings.json` não mudou.
- **Playwright** — imagem `mcr.microsoft.com/playwright:v1.64.1-noble` (tag mais recente no MCR em 2026-10-21).
- **Smoke test** — os três combos dos `.pi/agents` responderam (ver "Comandos de teste").

## Acessos

| Serviço | URL | Usuário | Onde achar a senha |
|---|---|---|---|
| Postgres | `localhost:5432`, banco `esteira` (pgAdmin `http://localhost:15432`, grupo `esteira`) | `esteira_owner` (migrations) / `esteira_app` (runtime) | `ai-infra/container/.env`, `PROJECT_ESTEIRA_PG_OWNER_PASSWORD` / `PROJECT_ESTEIRA_PG_APP_PASSWORD` |
| RabbitMQ | `localhost:5672`, vhost `esteira` (UI `http://localhost:15672` com o admin) | `esteira` | `.env`, `PROJECT_ESTEIRA_RABBITMQ_PASSWORD` |
| Redis | `localhost:6379`, prefixo `esteira:` (provisionado; o código hoje usa `IMemoryCache`) | ACL user `esteira` | `.env`, `PROJECT_ESTEIRA_REDIS_PASSWORD` |
| Keycloak | `http://localhost:8080/admin` → realm `esteira`, client `esteira-api` (BFF, callback `http://localhost:4200/api/v1/auth/callback`), usuário de teste `dev` | — | `.env`, `PROJECT_ESTEIRA_KEYCLOAK_CLIENT_SECRET` / `PROJECT_ESTEIRA_KEYCLOAK_DEV_PASSWORD` |
| Logs/métricas | Grafana `http://localhost:3000`, pasta `infra`, filtro Projeto = `esteira`; Prometheus alvo `projects (esteira)` em `host.docker.internal:5105` | admin do Grafana | `.env`, `GF_SECURITY_ADMIN_PASSWORD` |

(Tudo isso também está pronto pro app em `ai-infra/container/generated/projects/esteira.secrets.json`, já carregado nos user-secrets da API.)

## Pendências

- **Código (spec de adequação, issue #1):** chaves fora do contrato, senhas padrão versionadas (`appsettings.Development.json`, `EsteiraContextFactory.cs`, `esteira-api/docs/PENDENCIAS.md`), `/health`, `/metrics` na porta 5105, log JSON + OTLP. Enquanto isso, o alvo `projects (esteira)` do Prometheus fica `down`.
- **Humano:** `esteira-api` não tem `.gitlab-ci.yml` (modelo em `templates/api.gitlab-ci.yml` do workspace) — mudança de esteira é sempre do humano.
- **Humano:** `esteira-frontend` vazio (sem commits) — o bootstrap é a fatia F0 do `specs/README.md`, fluxo normal.
- **Humano:** revisar e commitar/dar push no `esteira-workspace` (arquivos de `docs/agents`, `.pi/agents/backend.md`, `CLAUDE.md`, `skills-lock.json`, `specs/feature/infra/`, `.claude/agents/`, `.pi/skills/`, este relatório). O link da spec na issue #1 só funciona depois do push.
- **`/skills`** — confirmar a lista numa sessão Claude Code aberta no workspace (este agent conferiu em disco, não dentro de uma sessão).

## Comandos de teste

- Infra: `node <ai-infra>\configs\infra\infra-config.mjs verify` → "✔ tudo conferido" (muros `esteira` do Postgres/Redis/RabbitMQ, realm e segredo do Keycloak; `projects (esteira)` `down` até a API ter `/metrics`).
- User-secrets: `dotnet user-secrets list --project esteira-api\src\Esteira.Api\Esteira.Api.csproj` → as 16 chaves do contrato (conferir só os nomes).
- Skills: `/skills` numa sessão Claude Code no workspace; `skills-lock.json` → `code-review` com `source: mattpocock/skills`.
- impeccable: `Test-Path .claude\skills\impeccable\SKILL.md`; `/impeccable init` numa sessão de desenvolvimento (depois do F0).
- Playwright: `docker images mcr.microsoft.com/playwright` → `v1.64.1-noble`.
- Smoke test não interativo (2026-10-21, os três ok, sem fallback):
  - `pi -p "say ok" --provider omniroute --model pi-exec` → atendido por `bazaarlink/deepseek/deepseek-v4-flash-0731free:free`
  - `pi -p "say ok" --provider omniroute --model pi-light` → `mistral/ministral-14b-latest`
  - `pi -p "say ok" --provider omniroute --model pi-quality` → `openai/gpt-5.6-luna` (pago)
  - Forma convencional: `pi` interativo no workspace + `/model` escolhendo `omniroute/pi-exec` etc.; o modelo que atendeu aparece nos logs do dashboard do OmniRoute.
