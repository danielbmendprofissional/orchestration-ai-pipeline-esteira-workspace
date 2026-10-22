# M0 — Esqueleto: limpeza do modelo herdado do sistema legado

## Contexto necessário
- esteira-api/CLAUDE.md (camadas e padrões)
- esteira-api/docs/PENDENCIAS.md (seção "Refatoração do modelo")
- docs/adr/0009-agregados-e-ocupacao-do-ambiente.md, docs/adr/0010-acoes-do-bot.md, docs/adr/0014-identificadores.md
- docs/agents/infra-local.md (chaves `ConnectionStrings:*`, `RabbitMQ:*`)
- specs/feature/infra/00-adequacao-ambiente.md (precisa estar feita: a API já lê as chaves do contrato)

## Ideia
O código da `esteira-api` é o modelo do sistema legado, que diverge do modelo novo na raiz (Fluxo chaveado por sigla de sistema, um serviço de regras por etapa, AET única, deploy associado por branch, limite de 2 fluxos). Nada rodou em produção. Em vez de refatorar aos poucos, esta fatia **remove todas as features herdadas** e deixa um **esqueleto**: a infraestrutura transversal que continua valendo, os value objects reaproveitáveis, a base de identificadores nova (ADR-0014) e o **outbox com tabela** (ADR-0010). A1 e E1 constroem os agregados novos do zero, test-first. O conhecimento antigo fica no histórico do git e no glossário.

Ao final, a API sobe, responde `/health`, não tem nenhum endpoint de negócio e a solução compila e passa nos testes.

## Remover

### Domain
- [ ] `FluxosDeploy/` inteiro (entidades, eventos, serviços de etapa, `FluxoDeployService`, VOs `Tarefa`, `ValidacaoEtapa`, `VersaoFluxo`)
- [ ] `Deploys/` exceto `ValueObjects/VersaoAplicacaoValueObject.cs` (move para `Common/ValueObjects`)
- [ ] `Etapas/`, `AprovadoresTecnicos/`
- [ ] `ConfiguracoesSistema/` exceto `ValueObjects/LimitesSeveridadeValueObject.cs` (move para `Common/ValueObjects`; a A1 o usa na `PoliticaSeveridade`)
- [ ] `Common/Enums/EtapaEnum.cs`, `Common/Enums/StatusEnum.cs` (as etapas e status novos nascem na E1)
- [ ] `Common/ValueObjects/IntValueObject.cs` se ficar sem uso

### Application
- [ ] `FluxosDeploy/`, `Deploys/`, `Etapas/`, `AprovadoresTecnicos/`, `Status/`, `Jobs/`, `Settings/GerenciadorTarefasSettings.cs`
- [ ] `DTOs/` inteiro, exceto `DTOs/Response/OptionDto.cs` se ainda houver uso
- [ ] `Common/Json/SingleOrArrayConverter.cs`
- [ ] `Interfaces/Integracoes/` (`IGerenciadorTarefas`, `IScannerDast`, `IMigracaoBancoDados`) — a pasta fica para as portas novas
- [ ] `Interfaces/Usuario/IAlteraFluxoDeploy.cs` e `Behavior/AutorizacaoBehavior.cs` (a permissão por papéis nasce na A1)
- [ ] Pacote `Quartz.Extensions.Hosting` (único uso era o `AnaliseDastJob`)

### Data
- [ ] Pastas por agregado: `FluxosDeploy/`, `Deploys/`, `Etapas/`, `AprovadoresTecnicos/`, `ConfiguracoesSistema/`
- [ ] `Common/Persistence/Migracoes/` inteiro (incluindo `ViewResumo.cs`) — recomeça na migration base abaixo
- [ ] `DbSet`s e configurations removidos de `EsteiraContext`/`EsteiraReadContext`

### AcL, Messaging, Api, IoC
- [ ] `Esteira.AcL/Integracoes/*NaoConfigurado.cs`
- [ ] Os 3 consumers DAST/SAST de `Esteira.Messaging` (o projeto fica, vazio, para os consumers novos)
- [ ] `Esteira.Api/Controllers/*` exceto nenhum de negócio (remove todos os 13; `StatusController` inclusive), `Esteira.Api/Models/*`
- [ ] `Program.cs`: registro do Quartz, dos consumers removidos, `UseInMemoryInboxOutbox`, seção `GerenciadorTarefas`
- [ ] `DependencyInjection.cs`: registros de tudo que foi removido

### Testes e scripts
- [ ] Testes das features removidas (Application: `Deploys/`, `Etapas/`, `FluxosDeploy/`, `Common/AutorizacaoBehaviorTests.cs`; Domain: `AprovadoresTecnicos/`, `ConfiguracoesSistema/Entities/`, `Deploys/` exceto o teste do `VersaoAplicacao`, `Etapas/`, `FluxosDeploy/`, `Common/FluxoTestesSuporte.cs` se ficar sem uso)
- [ ] `scripts/banco/` (`esteira.sql` e a view de resumo)

## Manter (e ajustar)
- [ ] Behaviors `Validation`, `Cache`, `Transaction` e seus testes; `IUnitOfWork`/`UnitOfWork`; `IDomainEventDispatcher`/`DomainEventDispatcher` (domain events despachados no `SaveChanges`)
- [ ] `EsteiraContext` (escrita) e `EsteiraReadContext` (leitura sem tracking), `EsteiraContextFactory`, converters, specifications base, repositório base
- [ ] VOs `ResumoSeveridade`, `LimitesSeveridade`, `VersaoAplicacao`, `Url`, `String` e seus testes
- [ ] `Esteira.Infra.Cache`, middlewares, autenticação atual (a B3 troca), `Paginacao` da Api (a B1 troca)

## Dados
- [ ] **IDs (ADR-0014):** `EntityBase` vira `long Id` (identity) + `Guid PublicId` (gerado no domínio com `Guid.CreateVersion7()`, índice único). Toda configuration de entidade mapeia os dois; nenhum DTO expõe `Id`.
- [ ] **Migration base** (`Base`): só as tabelas do outbox/inbox do MassTransit. As entidades novas entram nas migrations da A1 em diante.

## Backend
- [ ] **Outbox com tabela (ADR-0010):** `MassTransit.EntityFrameworkCore` na mesma linha 8.x do MassTransit (8.5.11), `AddEntityFrameworkOutbox<EsteiraContext>` com Postgres e bus outbox; `AddInboxStateEntity`/`AddOutboxMessageEntity`/`AddOutboxStateEntity` no `OnModelCreating`. Sai o `UseInMemoryInboxOutbox`.
- [ ] Publicação de mensagem dentro de um command passa pelo `IUnitOfWork` na mesma transação do `SaveChanges` (`TransactionBehavior`).
- [ ] `esteira-api/CLAUDE.md` e `esteira-api/docs/PENDENCIAS.md` atualizados: o que era "legado" e foi removido sai do texto; itens da "Refatoração do modelo" cobertos por esta fatia marcados.

## Frontend
N/A.

## Infra
N/A — usa Postgres e RabbitMQ da casa `esteira` (fatia 00). Nenhuma chave nova.

## Critérios (EARS)
1. Quando um command publica uma mensagem e a transação é confirmada, a Esteira deve gravar a mensagem na tabela de outbox na mesma transação e entregá-la ao broker depois do commit.
2. Se a transação de um command falhar, a Esteira não deve gravar nem entregar a mensagem publicada nele.
3. Se a API for reiniciada entre o commit e a entrega, a Esteira deve entregar a mensagem pendente depois que subir.
4. Quando um consumer recebe a mesma mensagem duas vezes, a Esteira deve processá-la uma vez só (inbox).
5. Quando uma entidade é criada, ela deve ter `PublicId` GUID v7 antes de ser persistida, e `Id` atribuído pelo banco.
6. Enquanto não houver agregados de negócio, a API deve subir, responder `/health` Healthy e expor um OpenAPI sem rotas de negócio.

## Testes
- Solução compila sem warnings novos; `dotnet test --solution Esteira.slnx` verde.
- **Novo projeto `Esteira.Integration.Tests`** (Testcontainers: PostgreSQL + RabbitMQ), com uma mensagem e um consumer **só de teste** para os critérios 1–4. Fica como base para os testes de integração das próximas fatias.
- Domain: critério 5 sobre uma entidade de teste.
- `grep -rni "FluxoDeploy\|Gmud\|BdCrs\|VersaoTarefas\|ScannerDast\|AprovadorTecnico\|ConfiguracaoSistema\|Quartz" src test` não acha nada.
