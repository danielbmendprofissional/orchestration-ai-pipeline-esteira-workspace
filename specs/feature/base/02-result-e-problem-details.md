# B2 — Result pattern + Problem Details

## Contexto necessário
- esteira-api/CLAUDE.md (camadas, padrões, testes)
- esteira-api/docs/PENDENCIAS.md
- docs/adr/0003-erros.md (a decisão; esta spec não repete o formato, só o aplica)
- docs/adr/0014-identificadores.md (nenhum `long` em mensagem de erro)
- specs/feature/base/01-esqueleto-do-modelo.md (precisa estar feita: é sobre o esqueleto que esta fatia trabalha)

## Ideia
Hoje erro de negócio é exception: os VOs lançam `DomainException` pelo `Guard`, o `ValidationBehavior` lança `ValidationException` e o `ExceptionMiddleware` devolve `{ message }` com o status que a exception carrega. Esta fatia aplica a ADR-0003 no esqueleto, antes de existir o primeiro handler de negócio: **todo handler e toda fábrica de VO devolve `Result`**, a API traduz `Result` em status + `{ errors: [...] }`, e só o que é inesperado vira **Problem Details** (RFC 9457) com `traceId`, sem detalhe técnico.

Junto, cria o **seam de teste HTTP** (`WebApplicationFactory<Program>` no `Esteira.Integration.Tests`), que a B1 e a A1 reaproveitam.

Fora desta fatia: o `error.interceptor` do front (F0.5); 401/403 de sessão e o corpo do desafio de autenticação (B3); paginação (B1, que vem depois desta e já nasce sobre `Result`); consumers do RabbitMQ (não mudam de contrato).

## Dados
N/A — nenhuma tabela, nenhuma migration.

## Backend

### Tipos (`Esteira.Domain/Common/Resultados/`)
Implementação própria, sem pacote. Mora no Domain porque o domínio também decide e devolve erro.

```csharp
public enum TipoErro { Validation, NotFound, Conflict, Forbidden, Unauthorized, Failure }
public sealed record Erro(string Code, string Message, TipoErro Type);

// Result (sem valor) e Result<T>: Sucesso / Falha(params Erro[]); IsSuccess, Value, Errors.
// Falha sem erro é erro de programação. Ler Value de uma falha lança InvalidOperationException.
```

- `Code` segue `<area>.<motivo>` em kebab-case (`url.invalida`, `ambiente.ocupado`); `Message` é texto pt-BR pro usuário.
- `TipoErro` → status HTTP (fixo, num lugar só na Api): `Validation` 400 · `Unauthorized` 401 · `Forbidden` 403 · `NotFound` 404 · `Conflict` 409 · `Failure` 422. Com vários erros, o status é o do primeiro.

### Checklist
- [ ] `Result`/`Result<T>`/`Erro`/`TipoErro` no Domain, com testes.
- [ ] **VOs com fábrica que devolve `Result`:** `UrlValueObject.Criar`/`CriarDast` → `Result<UrlValueObject>` (`url.invalida`, `url.longa-demais`); `VersaoAplicacaoValueObject.Criar(int|string)`/`DaTag` → `Result<...>` (`versao.invalida`, `versao.tag-invalida`), e `AceitaTag` devolve `false` para tag inválida; `LimitesSeveridadeValueObject.Criar` → `Result<...>` (`politica.limite-negativo`, o mesmo code que a A1 usa); `ResumoSeveridadeValueObject.Criar` → `Result<...>` (`severidade.quantidade-negativa`). Construtor público com regra vira privado; `Nenhum`/`Vazio`/`Somar`/`DeSeveridades` continuam sem `Result` (não recebem entrada inválida). `UrlValueObject.Normalize` some se ficar sem uso.
- [ ] **`Guard`** fica só para erro de programação (argumento nulo, enum fora do intervalo) e lança `ArgumentException`/`ArgumentNullException` → vira 500. `Guard.Against<TException>` sai.
- [ ] **Removidos:** `DomainException`, `NotFoundException`, `IntegrationException` (pasta `Domain/Common/Exceptions` inteira) e `ExceptionMiddleware`. `OrdenacaoExtensions` deixa de lançar `DomainException` — o campo inválido vira `Result` na B1; aqui basta trocar por `ArgumentException` para compilar.
- [ ] **`ValidationBehavior`** restrito a requests cuja resposta é `Result`/`Result<T>`: falha do FluentValidation vira `Result` com um `Erro` por falha, `Type = Validation`, `Code` = `ErrorCode` do validator. Validator sem `.WithErrorCode(...)` explícito cai em `validacao.campo-invalido` (o código padrão do FluentValidation, tipo `NotEmptyValidator`, nunca sai na resposta). Não chama `next`.
- [ ] **`TransactionBehavior`:** command que devolve `Result` de falha **não salva** (`SaveChanges` não roda) e, se for `ITransactionRequest`, faz **rollback** — com isso, domain events e mensagens do outbox do command também não saem. Exception continua fazendo rollback e propaga.
- [ ] **`CacheBehavior`:** `Result` de falha não entra no cache.
- [ ] **Api — tradução de `Result`:** controllers devolvem `Result`; um ponto único na Api (filtro de resultado registrado no `AddControllers`, irmão do `PaginacaoResultFilter`) converte: sucesso com valor → 200 com o valor; `Result` sem valor → 204; falha → status do primeiro erro + `{ "errors": [{ "code", "message", "type" }] }` (`type` como string). Criação com 201 fica a cargo do controller (`Created` com o valor do `Result`).
- [ ] **Model binding inválido** (`[ApiController]`, JSON malformado, tipo errado) sai no mesmo formato: 400, `type: Validation`, `code: requisicao.invalida`, uma entrada por campo — nunca o `ValidationProblemDetails` padrão.
- [ ] **Erro inesperado:** `AddProblemDetails` + um `IExceptionHandler` global (`Esteira.Api/Erros/`). Resposta 500 `application/problem+json` com `type`, `title` ("Erro inesperado"), `status` e `traceId` (`Activity.Current?.Id ?? HttpContext.TraceIdentifier`); nunca `detail` com mensagem da exception, nunca stacktrace, em nenhum ambiente. Log `Error` com a exception e o mesmo `traceId`.
- [ ] Rota inexistente: 404 sem corpo (comportamento padrão), não Problem Details.
- [ ] `Program.cs`: sai `UseMiddleware<ExceptionMiddleware>`, entra `UseExceptionHandler()` antes da autenticação.
- [ ] `public partial class Program` (ou equivalente) para o `WebApplicationFactory` enxergar a API.
- [ ] `esteira-api/CLAUDE.md`: tira "`DomainException` é legado até a fatia B2"; descreve o padrão (`Result` em handler e fábrica de VO, `Guard` só para programação, code `<area>.<motivo>`, `WithErrorCode` obrigatório). `docs/PENDENCIAS.md` atualizado se algo de lá for coberto.

## Frontend
N/A — o `error.interceptor` que lê `errors[]`/Problem Details é da F0.5.

## Infra
N/A.

## Critérios (EARS)
1. Quando um handler devolve `Result` de sucesso com valor, a API deve responder 200 com o valor no corpo.
2. Quando um handler devolve `Result` de sucesso sem valor, a API deve responder 204 sem corpo.
3. Quando um handler devolve `Result` de falha, a API deve responder com o status do tipo do primeiro erro (`Validation` 400, `Unauthorized` 401, `Forbidden` 403, `NotFound` 404, `Conflict` 409, `Failure` 422) e corpo `{ errors: [{ code, message, type }] }` com todos os erros, na ordem.
4. Se o request falhar na validação do FluentValidation, a Esteira deve responder 400 com um erro `type: Validation` por falha, sem executar o handler.
5. Se um validator não declarar `ErrorCode`, o erro deve sair com `code: validacao.campo-invalido`.
6. Se o corpo da requisição não puder ser lido ou convertido, a API deve responder 400 com `code: requisicao.invalida` no formato `errors[]`.
7. Se um command devolver `Result` de falha, a Esteira não deve gravar nada no banco, nem disparar domain events, nem gravar mensagem no outbox.
8. Se uma query cacheável devolver `Result` de falha, a Esteira não deve guardar a resposta no cache.
9. Se ocorrer uma exception não tratada, a API deve responder 500 `application/problem+json` com `type`, `title`, `status` e `traceId`, sem mensagem da exception nem stacktrace, e registrar no log a exception com o mesmo `traceId`.
10. Quando a fábrica de um VO recebe entrada inválida, ela deve devolver `Result` de falha com o code do VO, sem lançar exception.

## Testes
- **Domain** (`Esteira.Domain.Tests`): `Result`/`Result<T>` (sucesso, falha, ler `Value` de falha); critério 10 por VO — os testes atuais dos VOs que esperam `DomainException` passam a esperar `Result` de falha com o code.
- **Application** (`Esteira.Application.Tests`, NSubstitute): critérios 4 e 5 no `ValidationBehavior` (handler não chamado); critério 7 no `TransactionBehavior` (`SaveChangesAsync`/`CommitAsync` não chamados, `RollbackAsync` chamado para `ITransactionRequest`); critério 8 no `CacheBehavior`. Os testes existentes dos dois behaviors continuam verdes.
- **Integração — seam HTTP novo** (`Esteira.Integration.Tests`): `ApiDeTeste` = `WebApplicationFactory<Program>` sobre os containers do `InfraestruturaFixture` (config das chaves do contrato em memória, Keycloak com authority fake — nenhuma rota de teste exige sessão). Um controller e requests MediatR **só de teste** (registrados pela fábrica, nunca no assembly da Api) para os critérios 1, 2, 3 (um caso por `TipoErro` + caso com 2 erros), 4, 6 e 9 (handler que lança; assert de que o corpo não contém a mensagem lançada). Critério 7 também aqui ponta a ponta: command de teste que publica mensagem e devolve falha → tabela do outbox sem a mensagem. Fica como base dos testes de API da B1 e da A1.
- `grep -rn "DomainException\|NotFoundException\|IntegrationException\|ExceptionMiddleware" src test` não acha nada.
- `dotnet test --solution Esteira.slnx` verde, sem warnings novos.
