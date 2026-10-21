# Observabilidade e backup da infra compartilhada

## Observabilidade: Grafana + Loki + Prometheus, dentro do `ai-infra`

Serviços permanentes no `docker-compose.yml` do `ai-infra`, junto de Postgres/Redis/RabbitMQ/Keycloak:

- **Prometheus** — coleta de métricas. Um exporter por serviço: `postgres_exporter`, `redis_exporter`, o plugin nativo do RabbitMQ (`rabbitmq_prometheus`, já embutido na imagem `management`), e `prometheus-net.AspNetCore` pra cada app .NET (expõe `/metrics`).
- **Loki** — agregação de log centralizada. Retenção: 30 dias.
- **Grafana Alloy** — agente que lê o log de cada container (Docker) e empurra pro Loki (Promtail é EOL desde março/2026, Alloy é o substituto oficial da própria Grafana). Cobre .NET e o que não é .NET (Keycloak, RabbitMQ) com o mesmo mecanismo, sem depender da arquitetura interna de nenhum projeto.
- **Grafana** — UI de dashboard + alerta, consumindo Prometheus e Loki como datasources.
- **Regra fixa pro .NET (não é arquitetura, é formato de saída):** log em JSON no console (Serilog ou equivalente, `WriteTo.Console` com formatter JSON) — é o que o Alloy espera pra indexar direito. Framework, ORM, camadas: decisão de cada projeto, o `ai-base` não fixa isso.
- **Health check endpoint** (`/health`, via `Microsoft.Extensions.Diagnostics.HealthChecks` no .NET, checando Postgres/Redis/RabbitMQ/Keycloak) é obrigatório em toda API .NET, independente do stack acima — vira também alvo de scrape do Prometheus.

## Backup do Postgres: local + cópia externa (Google Drive)

- `pg_dump` agendado (Windows Task Scheduler, chamando `pg_dump`/`pg_dumpall` via `docker exec`), com rotação, salvo localmente e sincronizado pro Google Drive.
- **Dump por banco, nunca `pg_dumpall` geral** — a instância é compartilhada entre projetos (um banco por projeto). `pg_dump` por banco permite restaurar um projeto sem mexer nos outros.
- **Roles são de cluster inteiro** (`vp_owner_<schema>`/`vp_usu_<schema>` e equivalentes de projetos futuros) — precisam de `pg_dumpall --globals-only` à parte, incluído na rotina de backup.
- **Rotação:** 7 dumps diários + 4 semanais mantidos, o resto é apagado pela própria rotina.
- **Sync pro Google Drive:** via Google Drive for Desktop (pasta local sincronizada automaticamente), não `rclone`. Pasta de destino: `G:\My Drive\ia`.
- **Testar restore pelo menos uma vez** depois de implementado — backup nunca testado não é garantia de nada.