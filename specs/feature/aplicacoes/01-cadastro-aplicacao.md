# 01 — Cadastro de Aplicação

## Contexto necessário
- CONTEXT-MAP.md (seção Linguagem: Aplicação, Projeto, Ambiente, Destino, Papéis)
- docs/adr/0007-cadastro-aplicacoes.md, docs/adr/0008-esteira-decide-e-orquestra.md
- docs/adr/0002-paginacao.md, docs/adr/0003-erros.md, docs/adr/0004-autenticacao-bff.md, docs/adr/0005-frontend-stack.md
- docs/mudancas-infra.md (item 2: token do bot) · docs/mudancas-template.md (item 3: configuração vem da Esteira)
- esteira-api/docs/PENDENCIAS.md (seção "Refatoração do modelo")

## Ideia
Sem Aplicação cadastrada não existe Fluxo. Esta fatia cria a área onde se cadastra **Aplicação → Projetos → Ambientes → Destinos**, a **política de severidade** de cada Ambiente e os **papéis** das pessoas na Aplicação. A Aplicação aponta para um grupo do GitLab; os Projetos são escolhidos da lista de projetos do grupo (ninguém digita ID). A configuração de cada Destino é o que a pipeline vai puxar no `esteira-abrir` (fatia E1) — aqui só é cadastrada. A Esteira **não guarda segredo**: segredo continua como variável do GitLab.

Fora desta fatia: Fluxos/Entregas (E1), o `esteira-abrir` que entrega a configuração (E1), Exceções (E2), e-mail (E3), qualquer escrita no GitLab (E4).

## Dados
Tabelas novas (migration sobre a base da M0). IDs expostos são GUID opacos (ADR-0005, segurança).

| Entidade | Campos | Regras |
|---|---|---|
| `Aplicacao` | Id, Nome, Sigla, GrupoGitLabId, GrupoGitLabCaminho, Ativa | Sigla única (normalizada maiúscula); um grupo do GitLab pertence a uma Aplicação só |
| `Projeto` | Id, AplicacaoId, ProjetoGitLabId, Caminho, Nome, Stack (`dotnet`, `angular`, `outro`), Ativo | ProjetoGitLabId único; precisa pertencer ao grupo da Aplicação |
| `AmbienteProjeto` | ProjetoId, Ambiente (`dev`, `qa`, `hml`, `producao`), Habilitado | `producao` sempre habilitado; os outros opcionais (projeto sem `qa`, por exemplo) |
| `Destino` | Id, ProjetoId, Ambiente, Nome, Configuracao (JSON chave→valor, não secreto), Ordem | Nome único dentro de Projeto+Ambiente. Ambiente habilitado sem Destino = ambiente sem deploy (mesma semântica do `KUBE_CONTEXT` vazio do template) |
| `PoliticaSeveridade` | AplicacaoId, Ambiente, Critica, Alta, Media, Baixa (limites ≥ 0), Modo (`avisa`, `bloqueia`) | Uma por Aplicação×Ambiente. Criada junto com a Aplicação com o padrão: `dev` avisa; `qa`/`hml`/`producao` bloqueiam com Crítica=0 e Alta=0, Média/Baixa sem limite |
| `PapelAplicacao` | AplicacaoId, Usuario (`sub` do Keycloak), Nome (cache de exibição), Papel (`analista`, `membro`, `aprovador-tecnico`, `aprovador-negocio`, `publicador`) | Uma pessoa pode ter vários papéis; par (Aplicação, Usuario, Papel) único |

**MOR** não é tabela: é role do realm `esteira` no Keycloak, lida da sessão (ADR-0004). `AprovadorTecnicoEntity`/equipe e `ConfiguracaoSistema` saem (substituídos por `PapelAplicacao` e `PoliticaSeveridade`) — se a M0 não tiver removido, remove aqui.

## Backend
Todas as rotas exigem sessão (ADR-0004). Paginação ADR-0002, erros ADR-0003 (`code` estável entre parênteses).

| Rota | Quem pode | O quê |
|---|---|---|
| `GET /api/v1/aplicacoes` | quem tem papel na Aplicação; MOR vê todas | lista paginada (`?busca=`, `?sort=nome`) |
| `POST /api/v1/aplicacoes` | MOR | `{ nome, sigla, grupoGitLab }` — `grupoGitLab` é o caminho (`valuto`); a API resolve o ID via GitLab e cria as 4 políticas padrão |
| `GET /api/v1/aplicacoes/{id}` | papel na Aplicação ou MOR | detalhe com Projetos, Ambientes, Destinos, políticas e papéis |
| `PUT /api/v1/aplicacoes/{id}` | MOR | nome, sigla, ativa |
| `GET /api/v1/aplicacoes/{id}/gitlab/projetos` | analista ou MOR | projetos do grupo no GitLab, marcando os já cadastrados e a stack sugerida (`APP_TECHNOLOGY` lido do `.gitlab-ci.yml` do projeto, se houver) |
| `POST /api/v1/aplicacoes/{id}/projetos` | analista ou MOR | `{ projetoGitLabId, stack }` — cria o Projeto com os 4 Ambientes (`producao` habilitado, demais conforme existam as branches `dev`/`qa`/`hml` no projeto) |
| `PUT /api/v1/projetos/{id}` | analista ou MOR | stack, ativo |
| `PUT /api/v1/projetos/{id}/ambientes/{ambiente}` | analista ou MOR | `{ habilitado }` |
| `POST` · `PUT /{destinoId}` · `DELETE /{destinoId}` em `/api/v1/projetos/{id}/ambientes/{ambiente}/destinos` | analista ou MOR | `{ nome, configuracao, ordem }` |
| `PUT /api/v1/aplicacoes/{id}/politicas/{ambiente}` | aprovador técnico ou MOR | limites e modo |
| `GET` · `POST` · `DELETE /{papelId}` em `/api/v1/aplicacoes/{id}/papeis` | MOR | vincular/desvincular pessoa e papel (busca de pessoa pelo Keycloak) |

- Integração GitLab atrás de porta em `Application/Interfaces/Integracoes` (`IGitLab`: `ObterGrupo`, `ListarProjetosDoGrupo`, `ObterArquivo`, `ListarBranches`), adaptador em `Esteira.AcL` com o token do bot do grupo. Só leitura nesta fatia.
- Toda alteração de cadastro gera registro de auditoria (quem, quando, antes/depois) — por ora em tabela própria simples; a pendência de audit trail substitui depois.

## Frontend
Feature `features/aplicacoes/` (ADR-0005: api service · domain service · pages · components; PrimeNG; texto pt-BR).

- **Lista de Aplicações** (`/aplicacoes`): tabela paginada com nome, sigla, grupo, nº de projetos; botão "Nova aplicação" só para MOR.
- **Nova Aplicação**: nome, sigla, grupo do GitLab (campo com validação ao sair — mostra o nome do grupo encontrado ou o erro).
- **Detalhe da Aplicação** (`/aplicacoes/:id`), abas:
  - **Projetos**: projetos cadastrados com stack; "Adicionar projetos" abre a lista do grupo com checkbox e stack sugerida editável.
  - **Ambientes e Destinos**: por Projeto, os 4 Ambientes (habilitar/desabilitar) e a lista de Destinos de cada um; editor de configuração chave→valor.
  - **Política de severidade**: os 4 Ambientes lado a lado, limites por severidade e modo avisa/bloqueia.
  - **Papéis**: pessoas e papéis; adicionar/remover só para MOR.
- Ações que o usuário não pode fazer não aparecem (permissões vêm da API, não de regra no front).

## Infra
- Token do bot do grupo com escopo `read_api` e nome de chave no contrato — pedido em `docs/mudancas-infra.md`, item 2. Sem o token configurado para o grupo, a criação da Aplicação falha com erro claro (`gitlab.bot-nao-configurado`).
- Role `mor` no realm `esteira` (agent `local-environment-config`).

## Critérios (EARS)
1. Quando um MOR cria uma Aplicação com um grupo do GitLab existente, a Esteira deve guardar o ID do grupo e criar as políticas padrão dos 4 Ambientes.
2. Se a sigla já existir, a Esteira deve recusar a criação (`aplicacao.sigla-duplicada`).
3. Se o grupo já pertencer a outra Aplicação, a Esteira deve recusar (`aplicacao.grupo-ja-vinculado`).
4. Se o grupo não existir ou o bot não o enxergar, a Esteira deve recusar (`gitlab.grupo-nao-encontrado`).
5. Quando a lista de projetos do grupo é pedida, a Esteira deve marcar os já cadastrados e sugerir a stack pelo `APP_TECHNOLOGY` do `.gitlab-ci.yml`, quando existir.
6. Se o projeto não pertencer ao grupo da Aplicação, a Esteira deve recusar o cadastro (`projeto.fora-do-grupo`).
7. Se o projeto já estiver cadastrado (em qualquer Aplicação), a Esteira deve recusar (`projeto.duplicado`).
8. Quando um Projeto é cadastrado, a Esteira deve criar os 4 Ambientes, com `producao` habilitado e os demais habilitados conforme a branch correspondente exista no projeto.
9. Se alguém tentar desabilitar `producao`, a Esteira deve recusar (`ambiente.producao-obrigatorio`).
10. Se a configuração de um Destino tiver chave cujo nome indique segredo (contém `PASSWORD`, `SENHA`, `SECRET`, `TOKEN`, `KEY`, `CREDENTIAL`, sem diferenciar maiúsculas), a Esteira deve recusar (`destino.configuracao-com-segredo`) e a mensagem deve orientar a cadastrar como variável no GitLab.
11. Se um limite de severidade for negativo, a Esteira deve recusar (`politica.limite-negativo`).
12. Enquanto o usuário não tiver papel na Aplicação e não for MOR, a Esteira não deve listá-la nem devolver o detalhe (404, não 403 — não revelar existência).
13. Se um usuário sem o papel exigido chamar uma rota de alteração, a Esteira deve recusar com 403 (`acesso.papel-insuficiente`).
14. Quando qualquer item do cadastro é alterado, a Esteira deve registrar quem, quando e o antes/depois.

## Testes
- **Domain/Application** (xUnit, NSubstitute para `IGitLab`): um teste por critério EARS.
- **Integração** (Testcontainers + PostgreSQL): unicidades (sigla, grupo, projeto, destino), cascata Projeto→Ambientes, política padrão.
- **API**: autorização por papel e MOR (critérios 12 e 13) com sessão simulada.
- **Frontend** (Vitest + Testing Library): domain service e pages; ações escondidas sem permissão.
- **E2E** (Playwright, GitLab simulado): MOR cria Aplicação → adiciona 2 projetos do grupo → cria 2 Destinos em `hml` → ajusta política → vincula um aprovador técnico; axe-core sem violação AA nas 4 abas.
