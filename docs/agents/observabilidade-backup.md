# Observabilidade e backup da infra compartilhada

## Observabilidade: Grafana + Loki + Prometheus, dentro do `ai-infra`

Serviços permanentes do `ai-infra`, junto de Postgres/Redis/RabbitMQ/Keycloak. Configuração versionada (`ai-infra/container/<ferramenta>/`), nada configurado pela interface.

- **Prometheus** — métricas, retenção de 30 dias. Um exporter por serviço (`postgres_exporter`, `redis_exporter`, plugin nativo do RabbitMQ — por vhost/fila —, métricas nativas do Keycloak) e `prometheus-net.AspNetCore` em cada API .NET (`/metrics`). Alertas básicos em `container/prometheus/rules.yml`.
- **Loki** — log centralizado, retenção de 30 dias. Nível detectado sozinho em log JSON (`detected_level`).
- **Grafana Alloy** — leva log pro Loki, por dois caminhos:
  - **app em container:** lê o stdout (Docker). Rótulo `project` = label `project` do container (ou nome do compose).
  - **app fora do Docker** (`dotnet run`): OTLP em `http://localhost:4318`, com `OTEL_RESOURCE_ATTRIBUTES=service.namespace=<projeto>` (vem pronto no contrato, `docs/agents/infra-local.md`) — vira o mesmo rótulo `project`.
- **Grafana** — painéis e alerta. Pasta `infra`: Visão geral, Logs (filtro por projeto/serviço/nível), PostgreSQL, Redis, RabbitMQ, APIs .NET (prometheus-net). Painel próprio de projeto vai em `ai-infra/container/grafana/dashboards/<projeto>/`.

**Regras fixas pro .NET (formato de saída, não arquitetura):**
- Log em JSON no console (Serilog ou equivalente, formatter JSON) — e, rodando fora do Docker, também o sink OTLP apontando pras variáveis `OTEL_*` do contrato.
- `/metrics` via `prometheus-net.AspNetCore`.
- `/health` (`Microsoft.Extensions.Diagnostics.HealthChecks`) checando Postgres/Redis/RabbitMQ/Keycloak — obrigatório em toda API.

**Registro do `/metrics` no Prometheus:** campo `"metrics": "host.docker.internal:<porta>"` do projeto em `ai-infra/configs/infra/projects.json` + `apply`. Nunca editar `prometheus.yml` por projeto.

Framework, ORM, camadas: decisão de cada projeto.

## Backup do Postgres: local + cópia externa (Google Drive)

- `pg_dump` agendado (Windows Task Scheduler chamando `ai-infra/backup/backup-postgres.ps1`, que roda `pg_dump`/`pg_dumpall` via `docker exec`), com rotação, salvo localmente e sincronizado pro Google Drive.
- **Dump por banco, nunca `pg_dumpall` geral** — um banco por projeto permite restaurar um projeto sem mexer nos outros.
- **Roles são de cluster inteiro** (`<projeto>_owner`/`_app`/`_connect`, `vp_*` do Valuto, `keycloak`, `monitoring`) — `pg_dumpall --globals-only` à parte, incluído na rotina.
- **Rotação:** 7 dumps diários + 4 semanais.
- **Sync pro Google Drive:** Google Drive for Desktop, pasta `G:\My Drive\ia`. Não `rclone`.
- **`ai-infra/container/.env` também precisa de backup** (gerenciador de senhas/Drive): as senhas de máquina se regeneram com `infra-config.mjs apply`, mas as chaves de provider do OmniRoute não.
- **Testar restore pelo menos uma vez** — backup nunca testado não é garantia.
