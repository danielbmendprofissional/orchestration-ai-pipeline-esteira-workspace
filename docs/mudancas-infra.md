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
