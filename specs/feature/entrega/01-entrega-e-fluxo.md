# 01 — Entrega e Fluxo: agregados e contrato `/api/pipeline/v2`

risco: alto   <!-- valida id_token de terceiro (JWKS do GitLab) e é a trava fail-closed que autoriza publicar; migração de banco nova; decide ocupação de Ambiente -->
base: workspace@e11f997 · esteira-api@fb78294 · esteira-frontend@168f0f4 · 2026-11-26
flag: não   <!-- contrato máquina-a-máquina com a pipeline; nenhuma tela nem comportamento percebido pelo usuário. Fail-closed por construção: sem Entrega aberta, nada publica -->
preview: N/A

## Contexto necessário
- CONTEXT-MAP.md (Entrega, Fluxo, Artefato, Ambiente, Destino, Atalho, Fatia, Papéis)
- docs/adr/0009-agregados-e-ocupacao-do-ambiente.md (ocupação: índice único + concorrência otimista), 0013-contrato-da-pipeline.md (v2), 0022-fatias-aprovadas-e-fluxo-por-selecao.md (Entrega nasce antes do Artefato; um Fluxo por Projeto), 0023-etapas-do-fluxo.md (etapas, dependência entre Projetos), 0025-refinamentos-nomes-fatia-sem-flag-e-travas.md (SHA do Fluxo; sem Artefato sem Entrega; a Esteira fora do esquema), 0008-esteira-decide-e-orquestra.md (id_token, fail-closed), 0016-schema-esteira.md, 0014-identificadores.md, 0003-erros.md, 0019-feature-flags-e-liberacao.md
- docs/agents/padrao-api.md (erros, identificadores, flags, superfície da pipeline) · esteira-api/CLAUDE.md
- `../template-ci/docs/contrato-pipeline-v2.md` (o cliente já existe; esta spec é o servidor) · `../template-ci/docs/pipeline-trunk-based.md`
- docs/mudancas-template.md (itens 1 e 3) · docs/mudancas-infra.md (confirmar que nenhuma chave nova de infra é necessária)
- specs/feature/aplicacoes/01-cadastro-aplicacao.md (Projeto, AmbienteProjeto, Destino, dependências) · specs/feature/painel/02-review-e-aprovacao.md (como a P2 grava a decisão por Ação e usa `IUsuarioAtual`)
- esteira-api/docs/PENDENCIAS.md

## Ideia
Sem Entrega aberta, o `esteira-abrir` recusa e nada publica. Esta fatia entrega o **servidor** desse contrato e os agregados que ele consulta: **Entrega** (o que o humano abre, com um **Fluxo** por Projeto tocado), a **ocupação** de `hml` e produção por Projeto, o endpoint `POST /api/pipeline/v2/abrir` autenticado pelo `id_token` do GitLab e a configuração de cada **Destino** devolvida na resposta.

Fica de **fora** (e em qual fatia entra):
- A rota e a tela para **abrir** a Entrega, seleção de Fatias Prontas para Entrega, travas, Conferência de escopo e lista paginada → **E1a**. Aqui a abertura é um command de aplicação, testado, sem rota HTTP.
- Quem **escolhe o SHA, cria a tag `fluxo/<id>` e dispara a pipeline** (bot), e o Deploy → **E4**. Aqui o SHA chega no `esteira-abrir` e é registrado no Fluxo.
- Estados da Etapa/Entrega, linha do tempo e tela → **E1b**; webhook e SSE → **T1**.
- Aprovações, papéis por etapa e Atalho com verificação de papel → **E3** (aqui o Atalho só exige nome e motivo presentes).
- Processos `liberacao`, `flag`, `rotulo` e `rollback` (flags reais por Ambiente, versão, Projeto em rollback) → **E7**, **E4b**, **E6**. Até lá o `esteira-abrir` os **recusa** (fail-closed), nunca os aceita pela metade.
- `esteira-gate` e `esteira-resultado` → **E2**. Hotfix (Entrega de tipo hotfix) → **E3c**. Superação do `qa` e cancelamento de pipeline antigo → **E4**.
- **Template-ci:** a metade `template` do mapa (item 3 de `docs/mudancas-template.md`: consumir `destinos` e gerar o deploy por Destino em child pipeline dinâmico) **não é editada daqui**: o template-ci é repositório compartilhado (CLAUDE.md, "Melhoria em repositório compartilhado"). Ao fim desta fatia vira issue no `orchestration-ai/ai-pipeline/template-ci`, rodada pelo `/issue-ai`. O campo `destinos` na resposta é aditivo: o cliente v3 atual o ignora e continua funcionando.

## Dados
Migration **expand-only** (tabelas novas), schema `esteira`. Todas com `Id` (long) e `PublicId` (Guid v7).

| Entidade | Campos | Regras |
|---|---|---|
| `Entrega` | `AplicacaoId`, `Situacao` (`aberta`, `encerrada`), `AbertaPorPessoaId`, `AbertaEm` | Só `aberta` é criada aqui. `encerrada` existe para as fatias seguintes fecharem; não há transição nesta fatia |
| `Fluxo` | `EntregaId`, `ProjetoId`, `TipoMudanca` (`minor`, `major`), `Sha` (string 40 hex, nulo até o Artefato), `Versao` | Um Fluxo por Projeto por Entrega (índice único `EntregaId+ProjetoId`). `Versao` fica sempre nula aqui (nasce na confirmação em produção, E4b). Token de concorrência otimista |
| `FluxoFatia` | `FluxoId`, `CodigoFatia`, `ComFlag` (bool) | Código em maiúsculo como no mapa (`B2`). Único por `FluxoId+CodigoFatia`. `ComFlag` espelha `flag: sim\|não` da spec no momento da abertura |
| `OcupacaoAmbiente` | `ProjetoId`, `Ambiente` (`hml`, `producao`), `FluxoId`, `OcupadaEm` | **Índice único `ProjetoId+Ambiente`** (ADR-0009): a invariante é do banco, não de consulta antes de gravar. `qa` não tem ocupação (sem fila) |

## Backend
Em `Esteira.Domain/Entregas` (agregados e regras), `Esteira.Application/Entregas` (commands, queries, porta de leitura da configuração), `Esteira.Data` (mapeamentos `Write/` e `Read/`, repositórios, migration) e `Esteira.Api/Pipeline` (endpoint, autenticação do `id_token`).

**Agregado `Entrega`** (raiz): contém os `Fluxo` e `FluxoFatia`. `Entrega.Abrir(aplicacao, pessoa, fluxos)` devolve `Result` e valida: pelo menos uma Fatia; cada Fatia aponta Projeto da mesma Aplicação, ativo; o Ambiente `qa` está habilitado no Projeto; um Fluxo por Projeto; a mesma Fatia não aparece em dois Fluxos do mesmo Projeto. `Fluxo.RegistrarSha` (anexa o Artefato ao Fluxo) e `OcupacaoAmbiente.Reservar/Liberar` são regras de domínio com teste em `Esteira.Domain.Tests`.

**`AbrirEntregaCommand`** (aplicação, sem rota HTTP): `{ aplicacaoId, fluxos: [{ projetoId, tipoMudanca, fatias: [{ codigo, comFlag }] }] }`, executado como a pessoa da sessão (`IUsuarioAtual`). Papel exigido: **Membro** da Aplicação ou MOR (ADR-0023); sem ele, `entrega.sem-permissao`. Quem confere "Fatia está Pronta para Entrega", `Depende de`, travas e Conferência de escopo é a E1a, que chama este command.

**`POST /api/pipeline/v2/abrir`** (documento OpenAPI **próprio** `pipeline-v2`, separado do `v1` do front, ADR-0013; a v1 de pipeline nunca existiu neste código novo, então não é implementada). Corpo e resposta exatamente como `template-ci/docs/contrato-pipeline-v2.md`, mais o campo novo `destinos` na resposta:

```
{ "feature_flags": "B2=true,B3=true",
  "destinos": [ { "nome": "local", "ordem": 1, "configuracao": { "K8S_NAMESPACE": "qa", "APP_URL": "..." } } ] }
```

Passos, nesta ordem, **qualquer falha é 4xx e a pipeline reprova** (fail-closed):
1. **Autentica** o `id_token` (JWKS do GitLab em `GitLab:Url`; audiência `Pipeline:Audience`, padrão `esteira`; emissor = `GitLab:Url`; expiração; assinatura). Cabeçalho ausente, malformado ou token inválido → `401 pipeline.token-invalido`. O claim `project_path` do token tem de ser igual ao `projeto` do corpo, e esse caminho tem de ser um Projeto **ativo** cadastrado; senão `403 pipeline.projeto-nao-reconhecido`.
2. **Valida o corpo** (SHA 40 hex minúsculo, `process` e `env` conhecidos, `entrega_id`/`fluxo_id` GUID públicos): `422 pipeline.corpo-invalido`.
3. **Processos suportados:** `fluxo` (env `qa`, ou `production` com Atalho) e `promocao` (env `hml` ou `production`). `liberacao`, `flag`, `rollback` e `rotulo` → `422 pipeline.processo-nao-suportado` (as fatias donas deles passam a aceitá-los).
4. **Entrega e Fluxo:** o `fluxo_id` existe, pertence à `entrega_id` e ao Projeto do token e a Entrega está `aberta`; senão `409 pipeline.sem-entrega-aberta`.
5. **Ambiente habilitado** no Projeto: senão `422 ambiente.desabilitado`.
6. **SHA:** no `fluxo`, o primeiro SHA recebido é registrado no Fluxo; SHA diferente do já registrado → `409 pipeline.sha-diferente`. Na `promocao`, o SHA tem de ser o registrado no Fluxo (Fluxo sem SHA → `409 pipeline.sem-artefato`).
7. **Atalho:** `fluxo` com `env=production` exige `atalho_por` e `atalho_motivo` não vazios; senão `422 pipeline.atalho-obrigatorio`. O Atalho vale só para `fluxo`, nunca para `promocao`.
8. **Ocupação:** em `hml` e `production` o Fluxo reserva `Projeto×Ambiente` pelo índice único; ocupado por **outro** Fluxo → `409 ambiente.ocupado` (ADR-0003). A mesma chamada repetida pelo mesmo Fluxo (retry de job) é idempotente e devolve 200. Violação do índice nunca vira 500.
9. **Resposta:** `feature_flags` calculado do próprio Fluxo (o estado real por Ambiente é da E7): em `qa` e `hml`, `<Fatia>=true` para cada Fatia **com flag** do Fluxo; em `production`, `<Fatia>=false` para cada uma (ADR-0022/0023: produção sobe com tudo desligado). Fatia sem flag não aparece. `destinos`: os Destinos do Projeto naquele Ambiente, por `Ordem`, com `configuracao` como cadastrada na A1 (ambiente habilitado sem Destino = lista vazia, deploy pulado).

O `comFlag` de cada Fatia vem de quem chama o command (a E1a o lê da spec pelo leitor da P1, `CabecalhoDaSpec.Flag`) e fica gravado em `FluxoFatia.ComFlag`; o `esteira-abrir` nunca consulta o GitLab (precisa responder dentro dos 30 s do cliente).

**Segurança:** o token e o `id_token` nunca vão para log nem para o corpo de erro; o `projeto` do corpo só é aceito depois de igual ao do token; mensagens de erro não revelam se o Projeto existe em outra Aplicação (`403` uniforme). Nenhuma chave nova de infra: `GitLab:Url` já existe; `Pipeline:Audience` é configuração não secreta com padrão.

## Frontend
N/A (sem tela nesta fatia; a abertura e a lista são da E1a, a tela da Entrega é da E1b).

## Infra
Sem pedido novo. O DNS/Ingress e a rota pública que a pipeline do GitLab alcança em `ESTEIRA_URL` são do ambiente de execução da API, fora do mapa. Na pendência do template-ci: a issue de `destinos` + child pipeline dinâmico (acima).

## Critérios (EARS)
1. Quando uma pessoa com papel Membro (ou MOR) abre uma Entrega com N Fatias em Projetos da mesma Aplicação, a Esteira deve criar uma `Entrega` `aberta` e **um** `Fluxo` por Projeto tocado, cada um com as suas Fatias e o `TipoMudanca` declarado.
2. Se a pessoa não tem o papel Membro (nem é MOR) na Aplicação, a Esteira deve recusar a abertura (`entrega.sem-permissao`) e não gravar nada.
3. Se a Entrega vem sem Fatia, com Projeto de outra Aplicação, com Projeto inativo, ou com o `qa` desabilitado no Projeto, a Esteira deve recusar (`entrega.sem-fatias`, `entrega.projeto-invalido`, `ambiente.desabilitado`).
4. Quando o `esteira-abrir` recebe `fluxo` em `qa` de um Fluxo de Entrega aberta, com `id_token` válido, a Esteira deve registrar o SHA no Fluxo e responder 200 com `feature_flags` (as Fatias com flag do Fluxo `=true`) e `destinos`.
5. Se o `esteira-abrir` chega sem `id_token`, com assinatura, emissor, audiência ou validade inválidos, a Esteira deve responder 401 (`pipeline.token-invalido`) sem consultar o banco.
6. Se o `projeto` do corpo difere do `project_path` do token, ou não é um Projeto ativo cadastrado, a Esteira deve responder 403 (`pipeline.projeto-nao-reconhecido`), com a mesma resposta nos dois casos.
7. Se não existe Entrega aberta para o `entrega_id`, o `fluxo_id` e o Projeto, a Esteira deve recusar (`pipeline.sem-entrega-aberta`); com a Entrega `encerrada`, idem.
8. Se o `process` é `liberacao`, `flag`, `rollback` ou `rotulo`, a Esteira deve recusar (`pipeline.processo-nao-suportado`).
9. Se o SHA do `fluxo` difere do já registrado no Fluxo, ou o SHA da `promocao` difere do registrado (ou o Fluxo não tem SHA), a Esteira deve recusar (`pipeline.sha-diferente`, `pipeline.sem-artefato`).
10. Se o `fluxo` em `production` chega sem `atalho_por` ou sem `atalho_motivo`, a Esteira deve recusar (`pipeline.atalho-obrigatorio`); `promocao` com Atalho preenchido não o honra.
11. Quando a `promocao` chega para `hml` ou `production` com o Ambiente livre, a Esteira deve reservá-lo para o Fluxo e responder 200; repetida pelo mesmo Fluxo, deve responder 200 sem criar segunda reserva.
12. Se `hml` ou `production` do Projeto está reservado por outro Fluxo, a Esteira deve recusar (`ambiente.ocupado`); duas chamadas simultâneas por Fluxos diferentes devem resultar em exatamente uma reserva (índice único, nunca 500).
13. Enquanto o Ambiente de um Projeto é `qa`, a Esteira não deve impor fila: dois Fluxos do mesmo Projeto registram SHA no `qa` sem se bloquear.
14. Em `production`, a Esteira deve devolver todas as Fatias com flag do Fluxo como `=false`; em `qa` e `hml`, como `=true`; Fatia sem flag não aparece.
15. Quando o Ambiente tem Destinos cadastrados, a resposta deve trazê-los por `Ordem` com a configuração da A1; ambiente habilitado sem Destino devolve lista vazia; ambiente desabilitado é recusado (`ambiente.desabilitado`).
16. Se o corpo é inválido (SHA que não é 40 hex minúsculo, `env` ou `process` desconhecido, GUID malformado), a Esteira deve responder 422 (`pipeline.corpo-invalido`) sem tocar o banco.
17. A resposta e o log do `esteira-abrir` não devem conter o `id_token`; o documento OpenAPI `pipeline-v2` deve existir separado do documento do front e listar só as rotas `/api/pipeline/v2`.

## Testes
Todo teste leva a marca `E1` (formato por stack em `docs/agents/orchestration.md`, "Marca da fatia nos testes").
- **Domain** (`Esteira.Domain.Tests`): `Entrega.Abrir` (1, 3), `Fluxo.RegistrarSha` (4, 9), `OcupacaoAmbiente` reservar/liberar/idempotência (11, 12), cálculo de `feature_flags` por Ambiente (14).
- **Application** (`Esteira.Application.Tests`, portas substituídas): `AbrirEntregaCommand` com papéis (1, 2, 3); handler do `esteira-abrir` por critério 4 a 16, com repositórios e leitor de Destinos falsos; Atalho (10).
- **Integration** (`Esteira.Integration.Tests`, PostgreSQL real, schema pelas migrations): índices únicos (Fluxo por Projeto, Fatia por Fluxo, ocupação), corrida de duas `promocao` simultâneas (12), migration só cria tabelas, leitura dos Destinos da A1 (15).
- **API/HTTP** (host de teste com **emissor JWKS falso** que assina `id_token`s): 401 por cada defeito do token (5), 403 uniforme (6), caminho feliz fim a fim com `destinos` (4, 15), segredo fora do log e do corpo de erro (17), documento OpenAPI separado (17).
- **Sem E2E de front:** nenhuma tela. A suíte de segurança do `review` roda sobre a fatia inteira (`risco: alto`), com foco em validação do `id_token` e enumeração de Projeto.
