# Mudanças necessárias na infra (ai-infra)

Pedidos da Esteira para o agent `ai-ops/agents/infra/local-environment-config`. A Esteira não sobe serviço próprio: cada item aqui vira pedido lá.

## 1. E-mail (SMTP)

- **Por quê:** a Esteira avisa por e-mail quem precisa agir (aprovação técnica da proposta e da entrega, aprovação da candidata, aprovação de negócio, Publicar, Exceção). Hoje a `ai-infra` não tem serviço de e-mail.
- **Dev:** um capturador de e-mail local (ex.: Mailpit) — nada sai pra fora, a caixa é vista numa UI web.
- **Ambientes reais:** relay SMTP de verdade (provedor a definir — decisão de custo, humano).
- **Contrato de chaves** (seguir o padrão de `docs/agents/infra-local.md`): `Smtp:Host`, `Smtp:Port`, `Smtp:Usuario`, `Smtp:Senha`, `Smtp:Remetente`, `Smtp:UsarTls`. Senha só em user-secrets/Secret, nunca em `appsettings*.json`.

## 2. Token do bot do GitLab

- **Por quê:** a Esteira fala com o GitLab por um bot, **um por grupo** (ADR-0008). Na fatia A1 só lê (listar projetos do grupo e o `.gitlab-ci.yml`); a partir da E4 também cria tag, abre/mergeia MR e dá play em job.
- **Precisa:** nome das chaves no contrato (proposta: `GitLab:Url` e `GitLab:Bots:<caminho-do-grupo>:Token`), token só em user-secrets/Secret, rotação antes do vencimento (máx. 1 ano) com alerta.
- Escopo: `read_api` até a E3; `api` a partir da E4 (o GitLab não tem escopo mais fino para tag + merge).

## 3. Guarda dos backups pré-publicação

- **Por quê:** o template passa a fazer `pg_dump` do banco de cada aplicação antes da migration de produção (`docs/mudancas-template.md`, item 4.2), mantendo os das 3 últimas publicações. É recuperação de desastre, complementar à rotina diária de `docs/agents/observabilidade-backup.md`.
- **Precisa:** um local fora do cluster de produção (volume dedicado + a mesma cópia externa para o Google Drive), uma credencial de leitura para o dump (role de backup, não o owner) e o procedimento de restore documentado e testado uma vez.

## 4. Realm `esteira`: role `mor` e usuários de teste (fatia B3)

- **Por quê:** a sessão BFF (ADR-0004, `specs/feature/base/04-sessao-bff.md`) lê o MOR de `realm_access.roles`; o manifesto do `esteira` ainda não declara a role.
- **Precisa:** `keycloak.realmRoles: ["mor"]`; usuário `dev` com `roles: ["mor"]` e um segundo usuário `dev-sem-papel` sem role (testes manuais de acesso).
- **Conferir no `apply`/`verify`:** client `esteira-api` confidencial com PKCE `S256`; `aud` do access token com `esteira-api`; `revokeRefreshToken` ligado; `redirectUris`/`postLogoutRedirectUris` como no manifesto; `realm_access.roles` no access token; ACL Redis do usuário `esteira` aceita `GET`/`SET`/`DEL`/`SADD`/`SREM`/`SMEMBERS`/`EXPIRE`/`SET NX` em `esteira:*`.
- **Contrato:** nenhuma chave nova. Depois do `apply`, regravar o user-secrets da API (`infra-config.mjs secrets esteira`).
