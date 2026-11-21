# 01 — Cadastro de Aplicação

risco: alto   <!-- permissão por papel, tabelas novas (migração), token do bot (segredo) e o primeiro flag do projeto -->
base: workspace@23cf984 · esteira-api@1cbb342 · esteira-frontend@80307ea · 2026-11-21
flag: sim   <!-- Features:A1 -->
preview: features/aplicacoes — rota `/aplicacoes`

## Contexto necessário
- CONTEXT-MAP.md (Aplicação, Projeto, Ambiente, Destino, Papéis, Política de segurança)
- docs/adr/0007-cadastro-aplicacoes.md, 0008-esteira-decide-e-orquestra.md (token do bot, escopo)
- docs/adr/0002-paginacao.md, 0003-erros.md, 0004-autenticacao-bff.md, 0005-frontend-stack.md, 0014-identificadores.md, 0015-spartan-ui-no-lugar-do-primeng.md, 0016-schema-esteira.md
- docs/adr/0019-feature-flags-e-liberacao.md, 0020-kubernetes-local-e-validacao-por-fatia.md (`review-<fatia>`), 0021, 0025 (dependência entre Projetos)
- docs/agents/padrao-api.md (permissões, flags, identificadores) e padrao-frontend.md (camadas, flags, preview)
- docs/design/prototipos/prototipo-aplicacoes.html e README.md (telas aprovadas; o protótipo ainda mostra `dev` na Política — vale esta spec: review, qa, hml, produção) · esteira-frontend/DESIGN.md
- docs/mudancas-infra.md (item 2: token do bot) · docs/mudancas-template.md (item 3: configuração vem da Esteira)
- esteira-api/docs/PENDENCIAS.md (seções "Refatoração do modelo" e "Segurança e acesso") · esteira-frontend/docs/PENDENCIAS.md

## Ideia
Sem Aplicação cadastrada não existe Fluxo. Esta fatia cria a área onde se cadastra **Aplicação → Projetos → Ambientes → Destinos**, a **dependência entre Projetos**, a **política de severidade** de cada Ambiente e os **papéis** das pessoas na Aplicação. A Aplicação aponta para um grupo do GitLab; os Projetos são escolhidos da lista de projetos do grupo (ninguém digita ID). A configuração de cada Destino é o que a pipeline vai puxar no `esteira-abrir` (E1) — aqui só é cadastrada. A Esteira **não guarda segredo**: segredo continua variável do GitLab.

É a **primeira Fatia com flag** do projeto: entrega também o mecanismo de `Features:<Fatia>` (leitura no back, `/features.json` no front), que as próximas herdam.

Fora desta fatia: Fluxos/Entregas e o `esteira-abrir` que entrega a configuração (E1), Exceções (E2), e-mail (E3), qualquer escrita no GitLab (P2, E4), tela de auditoria (X1), o token real do bot na infra (pedido, item 2 de `docs/mudancas-infra.md`: a fatia roda com `IGitLab` falso nos testes; o smoke contra o GitLab real espera o pedido).

## Dados
Tabelas novas no schema `esteira` (ADR-0016), migration sobre a base da M0, **expand-only**. Toda entidade tem `Id` (`long`) e `PublicId` (GUID v7) como na ADR-0014; só o `PublicId` sai da API. Domínio em `Esteira.Domain/Aplicacoes/`, mapeamento em `Esteira.Data/Aplicacoes/`.

| Entidade | Campos | Regras |
|---|---|---|
| `Aplicacao` | Nome, Sigla, GrupoGitLabId, GrupoGitLabCaminho, Ativa | Sigla única (normalizada em maiúscula); um grupo do GitLab pertence a uma Aplicação só |
| `Projeto` | AplicacaoId, ProjetoGitLabId, Caminho, Nome, Stack (`dotnet`, `angular`, `outro`), Ativo | ProjetoGitLabId único; precisa pertencer ao grupo da Aplicação |
| `DependenciaProjeto` | ProjetoId, DependeDeProjetoId | Os dois na mesma Aplicação; nunca o próprio; sem ciclo. É o que a Abertura da Entrega (E1) vai pré-marcar |
| `AmbienteProjeto` | ProjetoId, Ambiente (`qa`, `hml`, `producao`), Habilitado | `producao` sempre habilitado; os outros opcionais. Sem `dev` (ADR-0021); `review-<fatia>` não é cadastrado: é efêmero (ADR-0020) |
| `Destino` | ProjetoId, Ambiente, Nome, Configuracao (JSON chave→valor, não secreto), Ordem | Nome único dentro de Projeto+Ambiente. Ambiente habilitado sem Destino = ambiente sem deploy (mesma semântica do `KUBE_CONTEXT` vazio do template) |
| `PoliticaSeveridade` | AplicacaoId, Ambiente (`review`, `qa`, `hml`, `producao`), Critica, Alta, Media, Baixa (`int?`, `null` = sem limite; ≥ 0), Modo (`avisa`, `bloqueia`) | Uma por Aplicação×Ambiente, criada com a Aplicação: `review` avisa; `qa`/`hml`/`producao` bloqueiam com Crítica=0, Alta=0, Média e Baixa sem limite |
| `PapelAplicacao` | AplicacaoId, Usuario (`sub` do Keycloak), Papel (`analista`, `membro`, `aprovador-tecnico`, `aprovador-negocio`, `publicador`) | Pessoa pode ter vários papéis; (Aplicação, Usuario, Papel) único |
| `Pessoa` | Sub (único), Nome, Email, UltimoLoginEm | Gravada/atualizada a cada login (callback da B3). É de onde o MOR escolhe quem vincular: **a pessoa precisa ter entrado na Esteira ao menos uma vez**. Sem consulta ao Keycloak admin (não precisa de credencial nova na infra) |
| `RegistroAuditoria` | Quando, Usuario (`sub`), Entidade, EntidadePublicId, Acao (`criou`, `alterou`, `removeu`), Antes (JSON), Depois (JSON) | Só insere. É a tabela que a X1 passa a exibir (e a pendência de audit trail substitui depois) |

`LimitesSeveridadeValueObject` (já na M0, `Domain/Common/ValueObjects`, `Criar` devolve `politica.limite-negativo`) passa a aceitar `null` por severidade (= sem limite; `ObterExcessos` ignora a que for `null`). Nada o usa hoje além dos testes dele.

**MOR** não é tabela: é role do realm `esteira`, lida da sessão (`IUsuarioAtual.EhMor`, ADR-0004). `AprovadorTecnicoEntity` e `ConfiguracaoSistema` já saíram na M0.

## Backend
Rotas sob `/api/v1`, todas com sessão (`FallbackPolicy` da B3). Paginação ADR-0002 (`PaginarAsync`, `Result<PaginaDto<T>>`; `?sort=&order=`), erros ADR-0003 (`code` estável). Rota recebe `PublicId`; o repositório resolve o `long` uma vez na entrada.

| Rota | Quem pode | O quê |
|---|---|---|
| `GET /aplicacoes` | quem tem papel na Aplicação; MOR vê todas | lista paginada (`?busca=`, `?ativa=`, `?sort=nome`) com nº de projetos |
| `GET /aplicacoes/permissoes` | qualquer logado | `{ podeCriar }` |
| `POST /aplicacoes` | MOR | `{ nome, sigla, grupoGitLab }` — `grupoGitLab` é o caminho (`valuto`); a API resolve o ID via GitLab e cria as 4 políticas padrão |
| `GET /aplicacoes/{id}` | papel na Aplicação ou MOR | detalhe: Projetos (com dependências), Ambientes, Destinos, políticas e papéis |
| `GET /aplicacoes/{id}/permissoes` | papel na Aplicação ou MOR | `{ podeEditar, podeEditarCadastro, podeEditarPolitica, podeGerenciarPapeis }` — o front só lê (padrao-api) |
| `PUT /aplicacoes/{id}` | MOR | nome, sigla, ativa |
| `GET /aplicacoes/{id}/gitlab/projetos` | analista ou MOR | projetos do grupo no GitLab, marcando os já cadastrados e a stack sugerida |
| `POST /aplicacoes/{id}/projetos` | analista ou MOR | `{ projetoGitLabId, stack }` — cria o Projeto com os 3 Ambientes habilitados |
| `PUT /projetos/{id}` | analista ou MOR | stack, ativo |
| `PUT /projetos/{id}/dependencias` | analista ou MOR | `{ dependeDe: [projetoId] }` (substitui a lista) |
| `PUT /projetos/{id}/ambientes/{ambiente}` | analista ou MOR | `{ habilitado }` |
| `POST` · `PUT /{destinoId}` · `DELETE /{destinoId}` em `/projetos/{id}/ambientes/{ambiente}/destinos` | analista ou MOR | `{ nome, configuracao, ordem }` |
| `PUT /aplicacoes/{id}/politicas/{ambiente}` | aprovador técnico ou MOR | limites e modo |
| `GET /pessoas?busca=` | MOR | procura em `Pessoa` (nome, e-mail), paginada |
| `GET` · `POST` · `DELETE /{papelId}` em `/aplicacoes/{id}/papeis` | MOR (leitura: papel na Aplicação) | vincular/desvincular pessoa e papel |

- **Flag `Features:A1`:** um filtro de endpoint lê `Features:A1` da configuração (ausente = desligado, nunca ligado por omissão); desligado, todas as rotas acima respondem 404. Primeira peça do mecanismo, reaproveitada pelas Fatias seguintes.
- **GitLab:** porta `IGitLab` (`ObterGrupo`, `ListarProjetosDoGrupo`, `ObterArquivo`) em `Application/Interfaces/Integracoes`, adaptador em `Esteira.AcL` (projeto hoje vazio) com `HttpClient` tipado; chaves `GitLab:Url` e `GitLab:Bots:<grupo>:Token` (proposta do item 2 da infra; só user-secrets). **Só leitura.** Sem token para o grupo → `gitlab.bot-nao-configurado`. A stack sugerida lê `APP_TECHNOLOGY` do `.gitlab-ci.yml` por regex de linha (`dotnet` e `angular` reconhecidos; outro valor ou ausência = sem sugestão), **sem dependência nova** de YAML.
- **Login:** o callback da B3 grava/atualiza `Pessoa` (sub, nome, e-mail) na mesma requisição; falha ao gravar não derruba o login (loga e segue).
- **Auditoria:** todo comando que altera cadastro grava `RegistroAuditoria` na mesma transação (antes/depois).
- **Acesso:** a checagem de papel mora num serviço de autorização da Aplicação (papéis da pessoa + `EhMor`), usado pelos handlers e pelo `/permissoes`; sem papel na Aplicação a rota devolve 404, nunca 403 (não revela existência).

## Frontend
Feature `features/aplicacoes/` (padrao-frontend: api service · domain service · pages · components; spartan/ui; texto pt-BR; tipos gerados do OpenAPI — rodar `generate:api-types` depois da API). Edição sempre em gaveta, como no protótipo.

- **Flags:** novo `core/config/feature-flags.service.ts`, carregado no `provideAppInitializer` ao lado do `/config.json`, lê `GET /features.json` (`public/features.json` em dev com `{"A1": true}`); `isEnabled('A1')`, ausente = desligado. `RotaData` ganha `feature?: string`: o guard de rota e o menu escondem a rota com o flag desligado.
- **Rotas** (sob o shell, com `data.menu`): `/aplicacoes` (item "Aplicações") e `/aplicacoes/:id`.
- **Lista de Aplicações**: tabela paginada (nome, sigla, grupo, nº de projetos; filtro ativas/inativas/todas); "Nova aplicação" só se `podeCriar`.
- **Nova/editar Aplicação** (gaveta): nome, sigla, grupo do GitLab (validação ao sair do campo: mostra o grupo encontrado ou o erro).
- **Detalhe** (`/aplicacoes/:id`), abas:
  - **Cadastro**: nome, sigla, ativa, grupo (edita só quem `podeEditar`).
  - **Projetos**: cadastrados, com stack e dependências; "Adicionar projetos" abre a lista do grupo com checkbox e stack sugerida editável.
  - **Ambientes e destinos**: matriz Projeto × Ambiente (habilitar/desabilitar) e Destinos de cada célula, com editor chave→valor.
  - **Política de segurança**: tabela severidade × Ambiente (review, qa, hml, produção) e modo avisa/bloqueia; o piso fixo aparece travado.
  - **Pessoas e papéis**: matriz pessoa × papel; adicionar (busca em `Pessoa`) e remover só com `podeGerenciarPapeis`.
- Ação que o usuário não pode fazer não aparece (vem de `/permissoes`, nenhuma regra de papel no front).
- **Preview:** sessão falsa (MOR) e dados falsos de 2 Aplicações, tipados pelos tipos gerados.

## Infra
- Token do bot do grupo, `read_api`, chaves no contrato — item 2 de `docs/mudancas-infra.md` (pedido já aberto; não bloqueia a implementação, só o smoke real).
- Role `mor` e usuário `dev` no realm `esteira`: já entregues na B3 (item 4 da infra, marcado).
- Variável `Features__A1` no Ambiente e `APP_FEATURES_JSON` no front: estado do flag é do Ambiente (padrao-api); nasce desligado em produção.

## Critérios (EARS)
1. Quando um MOR cria uma Aplicação com um grupo do GitLab existente, a Esteira deve guardar o ID do grupo e criar as 4 políticas padrão (review, qa, hml, producao).
2. Se a sigla já existir, a Esteira deve recusar a criação (`aplicacao.sigla-duplicada`).
3. Se o grupo já pertencer a outra Aplicação, a Esteira deve recusar (`aplicacao.grupo-ja-vinculado`).
4. Se o grupo não existir ou o bot não o enxergar, a Esteira deve recusar (`gitlab.grupo-nao-encontrado`); sem token configurado para o grupo, `gitlab.bot-nao-configurado`.
5. Quando a lista de projetos do grupo é pedida, a Esteira deve marcar os já cadastrados e sugerir a stack pelo `APP_TECHNOLOGY` do `.gitlab-ci.yml`, quando existir.
6. Se o projeto não pertencer ao grupo da Aplicação, a Esteira deve recusar o cadastro (`projeto.fora-do-grupo`).
7. Se o projeto já estiver cadastrado (em qualquer Aplicação), a Esteira deve recusar (`projeto.duplicado`).
8. Quando um Projeto é cadastrado, a Esteira deve criar os 3 Ambientes (`qa`, `hml`, `producao`), todos habilitados.
9. Se alguém tentar desabilitar `producao`, a Esteira deve recusar (`ambiente.producao-obrigatorio`).
10. Se a configuração de um Destino tiver chave cujo nome indique segredo (contém `PASSWORD`, `SENHA`, `SECRET`, `TOKEN`, `KEY`, `CREDENTIAL`, sem diferenciar maiúsculas), a Esteira deve recusar (`destino.configuracao-com-segredo`) e a mensagem deve orientar a cadastrar como variável no GitLab.
11. Se um limite de severidade for negativo, a Esteira deve recusar (`politica.limite-negativo`); `null` significa sem limite.
11a. Se a alteração afrouxar o piso fixo — em `qa`, `hml` ou `producao`, modo diferente de `bloqueia` ou limite de Crítica/Alta acima de 0 ou ausente — a Esteira deve recusar (`politica.abaixo-do-minimo`). Endurecer é permitido (ex.: `review` bloqueando, Média com limite).
12. Enquanto o usuário não tiver papel na Aplicação e não for MOR, a Esteira não deve listá-la nem devolver o detalhe (404, não 403).
13. Se um usuário sem o papel exigido chamar uma rota de alteração, a Esteira deve recusar com 403 (`acesso.papel-insuficiente`).
14. Quando qualquer item do cadastro é alterado, a Esteira deve registrar, na mesma transação, quem, quando e o antes/depois.
15. Se a dependência entre Projetos apontar para Projeto de outra Aplicação, para si mesmo ou fechar um ciclo, a Esteira deve recusar (`projeto.dependencia-invalida`).
16. Quando uma pessoa faz login, a Esteira deve registrar ou atualizar seu nome e e-mail em `Pessoa`; se o vínculo de papel apontar para quem nunca entrou, deve recusar (`papel.pessoa-desconhecida`).
17. Enquanto `Features:A1` estiver ausente ou desligado, a Esteira não deve responder as rotas do cadastro (404) e o front não deve mostrar o item de menu nem abrir a rota.
18. Quando o front pede as permissões, a Esteira deve devolvê-las pelas mesmas regras que aplica nas rotas de alteração, e o front só exibe as ações permitidas.

## Testes
Todo teste leva a marca `A1` (`docs/agents/orchestration.md`, "Marca da fatia nos testes").
- **Domain/Application** (xUnit, NSubstitute para `IGitLab`): um teste por critério EARS (1–11a, 15, 16); `LimitesSeveridadeValueObject` com `null`.
- **Integração** (Testcontainers + PostgreSQL): unicidades (sigla, grupo, projeto, destino, papel), cascata Projeto→Ambientes, política padrão, auditoria na mesma transação (14), `Pessoa` gravada no callback (16), adaptador `IGitLab` contra `HttpMessageHandler` falso (4, 5).
- **API** (sessão simulada): autorização por papel e MOR (12, 13, 18), flag desligado → 404 (17), contrato OpenAPI das rotas novas.
- **Frontend** (Vitest + Testing Library): domain service e pages; ações escondidas sem permissão (18); `feature-flags.service` (ausente = desligado) e rota/menu com flag desligado (17).
- **E2E** (Playwright, API simulada): MOR cria Aplicação → adiciona 2 projetos → declara dependência → cria 2 Destinos em `hml` → ajusta política → vincula um aprovador técnico; usuário só-analista não vê "Nova aplicação" nem Pessoas; axe-core sem violação AA nas 5 abas.
