# CONTEXT-MAP — Esteira

| Componente | Repositório | Papel |
|---|---|---|
| API | `esteira-api/` | .NET 10, DDD + CQRS. Agregados `FluxoDeploy` e `Deploy`. Recebe deploys/análises das pipelines (RabbitMQ) e serve o frontend. Contexto interno: `esteira-api/docs/PENDENCIAS.md`. |
| Frontend | `esteira-frontend/` | Angular 22 (ADR-0005). Telas de fluxo de deploy, etapas, deploys/análises e cadastro de aplicações. |

## Como conversam

```
navegador ──cookie esteira_session──► esteira-frontend (nginx) ──/api──► esteira-api ──► Postgres (banco esteira)
                                                                            ├──► Redis (sessões, ADR-0004)
                                                                            ├──► Keycloak (realm esteira, ADR-0004)
pipelines GitLab (template-ci) ──RabbitMQ (vhost esteira)──────────────────►┘
esteira-api ──API do GitLab──► projetos/variáveis de CI das aplicações cadastradas (ADR-0007)
```

- Contrato front ↔ API: OpenAPI da `esteira-api`, tipos gerados no front (`openapi-typescript`). Paginação ADR-0002, erros ADR-0003.
- Feature que toca os dois: API primeiro e retrocompatível (`docs/agents/workspace.md`).

## Linguagem

- **Aplicação** — sistema cadastrado na Esteira, ligado a um ou mais projetos do GitLab (substitui o "portfólio de sistemas" do sistema legado).
- **Fluxo de deploy** — uma rodada de entrega de uma aplicação, percorrendo as etapas.
- **Etapa** — passo do fluxo (sigla: ABE, GMUD, AET, BD, DEV, QA, HML, AAN, PRD…), com status Não iniciado / Executando / Concluído / Cancelado.
- **Deploy** — uma publicação de um projeto num ambiente, dentro de um fluxo.
- **Análise** — resultado de uma ferramenta (SAST/DAST) sobre um deploy; contém **artefatos** (vulnerabilidades por severidade).
