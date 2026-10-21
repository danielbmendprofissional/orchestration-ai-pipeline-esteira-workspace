# Infra local: serviços de contexto + segurança

## Modelo: infra compartilhada, não por projeto

Uma instância só, permanente, de Postgres/Redis/RabbitMQ/Keycloak (repo `ai-infra`, `docker-compose.yml`). Todo projeto aponta sua connection string pra essa instância — nunca sobe container próprio.

Um Postgres compartilhado, um banco por projeto dentro dele. Nunca uma instância Postgres por projeto. O que acontece dentro do banco de cada projeto — schema por módulo, tabela solta, o que for — é decisão interna daquele projeto, não regra do `ai-base` (o `valuto` optou por schema+role por módulo, isso é ADR do `valuto`, não obrigação geral).

## Nascimento de projeto novo

Todo projeto novo ganha, na mesma infra compartilhada:

- **Postgres:** 1 banco `<projeto>` dedicado (nunca reaproveita banco de outro projeto). Organização interna do banco é decisão do projeto.
- **RabbitMQ:** 1 vhost `<projeto>` dedicado.
- **Keycloak:** 1 realm `<projeto>` dedicado.
- **Redis:** 1 ACL user `<projeto>` restrito a `<projeto>:*`:
  ```powershell
  docker exec -it <container-redis> redis-cli ACL SETUSER <projeto> on ">senha-do-projeto" "~<projeto>:*" "+@all" "-@dangerous"
  ```
  (senha gerada na hora, nunca hardcoded — avisar onde ficou guardada, nunca o valor em texto).

Cada projeto novo ganha seu próprio `banco/<projeto>/init-db.sql` dentro do repo `ai-infra`, sem sobrescrever os existentes.

## Nuvem de produção: AWS

- **Secrets:** Kubernetes Secrets nativo pra começar; evoluir pra HashiCorp Vault self-hosted (dentro do `ai-infra`) só se rotação/auditoria justificar depois. Nunca AWS Secrets Manager.
- **Registry de imagem e pacote:** GitLab Container Registry / GitLab Package Registry, não ECR.
- **Mensageria em produção:** RabbitMQ self-hosted, mesmo broker de dev — não Amazon MQ.
- Deploy roda em Kubernetes de produção — provisionamento é sempre manual do humano (fora de escopo de qualquer agent), e não muda como o código é escrito.

## Observabilidade e backup

Ver `docs/agents/observabilidade-backup.md`.