# Infra local: serviços de contexto + segurança

## Modelo: infra compartilhada, não por projeto

Uma instância só, permanente, de Postgres/Redis/RabbitMQ/Keycloak (+ observabilidade) no repo `ai-infra`. Todo projeto aponta pra essa instância — **nunca sobe container próprio** desses serviços.

É um bairro: cada projeto tem a sua casa em cada ferramenta e **não enxerga a dos outros** — nem por engano, nem por bug. Os muros são impostos pela infra (não dependem do código do projeto se comportar bem) e conferidos por `node ai-infra/configs/infra/infra-config.mjs verify`.

O projeto é declarado uma vez no manifesto `ai-infra/configs/infra/projects.json` e o `apply` cria tudo. Nunca criar banco/vhost/realm/usuário à mão (feito pelo agent `ai-ops/agents/infra/local-environment-config`).

## O que todo projeto recebe

`<projeto>` = nome do projeto, só minúsculas e dígitos.

| Ferramenta | Casa | Muro |
|---|---|---|
| **Postgres** | banco `<projeto>`; `<projeto>_owner` (dono do banco: DDL/migrations) e `<projeto>_app` (runtime: só `SELECT/INSERT/UPDATE/DELETE` no que o owner criar) | só roles do projeto conectam no banco do projeto; nenhuma role de projeto entra em outro banco |
| **RabbitMQ** | vhost `<projeto>` + usuário `<projeto>` | permissão só no próprio vhost, sem acesso à UI/API de gerenciamento |
| **Redis** | usuário ACL `<projeto>` | só chaves e canais `<projeto>:*`. `KEYS`, `SCAN`, `FLUSHALL`, `CONFIG` e todo comando `@dangerous` são negados |
| **Keycloak** | realm `<projeto>` + client confidencial `<projeto>-api` + usuário de teste `dev` | realm isolado |
| **Observabilidade** | rótulo `project=<projeto>` em log e métrica | só filtro (Grafana é da "prefeitura") |

Organização **dentro** do banco (schema por módulo, tabela solta) é decisão do projeto. O `valuto` optou por schema + role por módulo (`postgres.roles: "project"` no manifesto, roles `vp_*` criadas pelo próprio SQL inicial) — ADR do `valuto`, não obrigação geral.

## Contrato de configuração (o que o app lê)

A infra gera, por projeto, `ai-infra/container/generated/projects/<projeto>.secrets.json` (e o mesmo em `<projeto>.env`, formato `Seção__Chave`). **Os nomes abaixo são fixos** — o app lê exatamente estes, sem inventar outros:

| Chave | Exemplo |
|---|---|
| `ConnectionStrings:Postgres` | `Host=localhost;Port=5432;Database=<projeto>;Username=<projeto>_app;Password=…` (runtime) |
| `ConnectionStrings:PostgresMigrations` | idem com `<projeto>_owner` (só migrations) |
| `ConnectionStrings:Redis` | `localhost:6379,user=<projeto>,password=…,abortConnect=false` |
| `Redis:KeyPrefix` | `<projeto>:` — **toda** chave e canal usa esse prefixo (o resto dá `NOPERM`) |
| `RabbitMQ:Host` / `Port` / `VirtualHost` / `UserName` / `Password` | `localhost` / `5672` / `<projeto>` / `<projeto>` / … |
| `Keycloak:Authority` / `Realm` / `ClientId` / `ClientSecret` | `http://localhost:8080/realms/<projeto>` / `<projeto>` / `<projeto>-api` / … |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_RESOURCE_ATTRIBUTES` | `http://localhost:4318` / `service.namespace=<projeto>` |

Em dev, .NET carrega via user-secrets (nunca em `appsettings*.json` versionado). O script grava direto no `secrets.json` do user-secrets do csproj, mesclando com o que já existe — sem pipe de shell (no PowerShell 5.1, `Get-Content ... | dotnet user-secrets set` falha por causa do BOM):

```powershell
node <ai-infra>\configs\infra\infra-config.mjs secrets <projeto> --csproj=<csproj da API>
```

O csproj precisa de `<UserSecretsId>` (`dotnet user-secrets init --project <csproj>`, uma vez). Repetir depois de cada `apply` que troque segredo. Nos ambientes publicados, as mesmas chaves vêm de Kubernetes Secret/ConfigMap — o código não muda.

Regras que decorrem do contrato:
- **Nunca** superusuário do Postgres, `guest` do RabbitMQ ou usuário `default` do Redis no código ou no `appsettings`.
- Migrations com `PostgresMigrations`; a API em runtime com `Postgres`.
- Cache/sessão no Redis sempre com `Redis:KeyPrefix` (ex.: `InstanceName` do `IDistributedCache`). Pra invalidar várias chaves, guardar o índice num set (`<projeto>:…`) — `SCAN`/`KEYS` não existem pra projeto.
- Frontend não recebe nada daqui: nenhum segredo no navegador (BFF, `config.json` público).

## Padrão de autenticação (Keycloak)

O client padrão é o do **BFF** (Valuto ADR-004, Esteira ADR-0004): `<projeto>-api` **confidencial**, Authorization Code + **PKCE S256**, redirect pro callback da API, sem implicit, sem password grant, `aud` do access token inclui `<projeto>-api`, refresh token com rotação (`revokeRefreshToken`). Nenhum token chega no navegador. Política do realm (senha ≥ 12, brute force, token de 15 min, pt-BR): `ai-infra/configs/infra/keycloak/realm-defaults.json`. Roles, roles padrão e service account (ex.: API que cria usuário pela Admin API) são declarados no manifesto.

## Nuvem de produção: AWS

- **Secrets:** Kubernetes Secrets nativo pra começar; evoluir pra HashiCorp Vault self-hosted (dentro do `ai-infra`) só se rotação/auditoria justificar depois. Nunca AWS Secrets Manager.
- **Registry de imagem e pacote:** GitLab Container Registry / GitLab Package Registry, não ECR.
- **Mensageria em produção:** RabbitMQ self-hosted, mesmo broker de dev — não Amazon MQ.
- Deploy roda em Kubernetes de produção — provisionamento é sempre manual do humano (fora de escopo de qualquer agent), e não muda como o código é escrito.

## Observabilidade e backup

Ver `docs/agents/observabilidade-backup.md`.
