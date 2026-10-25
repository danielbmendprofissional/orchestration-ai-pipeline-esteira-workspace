# esteira-workspace

Workspace da **Esteira** — plataforma que controla o fluxo de deploy de cada aplicação por etapas (abertura, versão das tarefas, GMUD, banco de dados, aprovação técnica, DEV, QA, HML, aprovação de negócio, PRD) e recebe os deploys e as análises de segurança das pipelines.

Nasceu do `ai-base` (regras, `.claude/`, `docs/`). Padrão de workspace: `docs/agents/workspace.md`.

```
GitLab: orchestration-ai/ai-pipeline/esteira/     Local: ai-pipeline/esteira/   ← clone deste repositório
  ├── esteira-workspace  regras + specs + issues          ├── CLAUDE.md, .claude/, docs/, specs/, CONTEXT-MAP.md
  ├── esteira-api        .NET 10  (template-ci)           ├── esteira-api/       (.git próprio — ignorado aqui)
  └── esteira-frontend   Angular  (template-ci)           └── esteira-frontend/  (.git próprio — ignorado aqui)
```

## Onde está o quê

- `CONTEXT-MAP.md` — os componentes e como conversam.
- `docs/adr/` — decisões da Esteira (paginação, erros, autenticação, stack do frontend, config em runtime, cadastro de aplicações).
- `specs/feature/<área>/NN-nome.md` — specs de fatia (fonte de verdade); a issue no GitLab só aponta pro arquivo.
- `esteira-api/docs/PENDENCIAS.md` — backlog técnico da API.

## Clonar do zero

```powershell
cd C:\Users\danib\source\repos\orquestracao-ai\ai-pipeline
git clone git@gitlab.com:orchestration-ai/ai-pipeline/esteira/esteira-workspace.git esteira
cd esteira
git clone git@gitlab.com:orchestration-ai/ai-pipeline/esteira/esteira-api.git
git clone git@gitlab.com:orchestration-ai/ai-pipeline/esteira/esteira-frontend.git
```

Depois reinstalar as skills (não versionadas): `ai-ops/docs-human/ai-base/comandos-para-rodar.md`, seções 8, 9 e 13.
