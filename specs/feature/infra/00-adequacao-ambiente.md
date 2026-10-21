# 00 — Adequação do ambiente à infra compartilhada

## Contexto necessário
- docs/agents/infra-local.md (contrato de chaves)
- docs/agents/observabilidade-backup.md
- docs/agents/relatorio-ambiente.md (o que já foi provisionado)
- docs/adr/0004-autenticacao-bff.md, docs/adr/0006-configuracao-runtime.md

## Ideia
O `esteira-api` passa a usar a casa dele na infra compartilhada (`esteira`), lendo só as chaves do contrato. A casa já está provisionada (`verify` verde) e as 16 chaves já estão nos user-secrets da API (`UserSecretsId` `f4cc2692-…`) — falta o código ler esses nomes, e não os atuais.

Fatia de infra: checklist em vez de critérios EARS de domínio. Nenhuma senha aparece aqui — só o lugar onde ela está.

## Checklist

### Postgres
- [ ] `esteira-api/src/Esteira.Api/Program.cs:37` — `GetConnectionString("EsteiraConnection")` → `ConnectionStrings:Postgres` (runtime, role `esteira_app`)
- [ ] `esteira-api/src/Esteira.Api/appsettings.json:17` — remover `ConnectionStrings:EsteiraConnection`
- [ ] `esteira-api/src/Esteira.Api/appsettings.Development.json:3` — remover a connection string versionada (superusuário `postgres`, senha no arquivo)
- [ ] `esteira-api/src/Esteira.Data/Common/Persistence/EsteiraContextFactory.cs:12-13` — design-time factory: ler `ConnectionStrings:PostgresMigrations` (role `esteira_owner`, via user-secrets/configuração) no lugar de `ESTEIRA_CONNECTION` com fallback versionado de superusuário; sem fallback com senha
- [ ] Migrations (`dotnet ef database update`) rodam com `PostgresMigrations`; a API em runtime nunca usa o owner

### RabbitMQ
- [ ] `esteira-api/src/Esteira.Api/appsettings.json:27-30` — remover `Host: "rabbitmq"` e `VirtualHost: "/"`; `Host`/`Port`/`VirtualHost`/`UserName`/`Password` vêm do contrato (`RabbitMQ:*`)
- [ ] `esteira-api/src/Esteira.Api/appsettings.Development.json:9-11` — remover `guest`/senha versionados
- [ ] `esteira-api/src/Esteira.Api/Program.cs:80-87` — sem default `"/"` nem `"rabbitmq"`; ler também `RabbitMQ:Port`. `RabbitMQ:Ambiente` (sufixo `-hml`/`-prd`) não é do contrato e continua no `appsettings` do projeto

### Keycloak / autenticação
- [ ] `esteira-api/src/Esteira.Api/Autenticacao/AutenticacaoSettings.cs:5` + `Program.cs:46-56` — `Autenticacao:Authority`/`Audience` → `Keycloak:Authority` e `Keycloak:ClientId` (audience `esteira-api`, ADR-0004). `ClaimUsuario`/`ClaimNome`/`RequerHttps` podem continuar na seção do projeto
- [ ] `esteira-api/src/Esteira.Api/appsettings.json:19-25` — tirar `Authority`/`Audience` vazios da seção `Autenticacao`
- [ ] `Keycloak:ClientSecret` só é usado pela sessão BFF (fatia B3) — esta fatia não implementa o BFF

### Redis
- [ ] Hoje o cache é `IMemoryCache` (`esteira-api/src/Esteira.IoC/DependencyInjection.cs:39`) — nada a mudar nesta fatia. Quando o Redis entrar (sessão BFF, B3, ou cache distribuído): `ConnectionStrings:Redis`, toda chave/canal com `Redis:KeyPrefix`, nada de `KEYS`/`SCAN`

### Observabilidade
- [ ] `/health` (`Microsoft.Extensions.Diagnostics.HealthChecks`) checando Postgres, RabbitMQ e Keycloak (Redis quando entrar)
- [ ] `/metrics` com `prometheus-net.AspNetCore` na porta `5105` (já registrada no manifesto: `host.docker.internal:5105`)
- [ ] `esteira-api/src/Esteira.Api/appsettings.json:12-14` — Serilog `Console` com formatter JSON
- [ ] Sink OTLP rodando fora do Docker, lendo `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_PROTOCOL`/`OTEL_RESOURCE_ATTRIBUTES` do contrato

### Documentação e segredos versionados
- [ ] `esteira-api/docs/PENDENCIAS.md:86` — "Como rodar" com connection string de superusuário e senha no texto: trocar por user-secrets (`node <ai-infra>\configs\infra\infra-config.mjs secrets esteira --csproj=...`) e `PostgresMigrations`
- [ ] `esteira-api/docs/PENDENCIAS.md:90` — atualizar a lista de chaves de configuração
- [ ] As senhas versionadas acima são os padrões de imagem (`postgres`/`guest`), não da casa nova — não exigem rotação, só remoção

## Dados
N/A — o dev já apontava pro Postgres compartilhado (`localhost:5432`); o banco `esteira` é o mesmo, agora com dono `esteira_owner`. Migrations recriam o schema se preciso.

## Frontend
N/A — `esteira-frontend` ainda não tem código; nunca recebe segredo (BFF, `config.json` público).

## Infra
N/A — nada novo no `ai-infra`. Precisou de chave/role/serviço fora do contrato: pedido pro agent `ai-ops/agents/infra/local-environment-config`, não código.

## Testes
- `node ai-infra/configs/infra/infra-config.mjs verify` com a API rodando: alvo `projects (esteira)` `up`
- API sobe só com user-secrets (sem connection string em `appsettings*.json`) e `/health` responde Healthy
- `dotnet ef database update` funciona com `PostgresMigrations` (role `esteira_owner`)
- Log da API aparece no Grafana (Loki) com o filtro Projeto = `esteira`
- `grep -rn "Password=\|guest" esteira-api/src` não acha nada
