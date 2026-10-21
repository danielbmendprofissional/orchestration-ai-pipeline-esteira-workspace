# ADR-0003 — Erros: Result pattern + Problem Details (igual ao Valuto ADR-010/022)

Status: Aceito · 2026-10-21 · Substitui o `{ message }` do `ExceptionMiddleware` atual

## Decisão

- **Todo handler retorna `Result<T>`**; erro de negócio nunca é exception.
- **Erro de negócio** (400/401/403/404/409/422): `{ "errors": [{ "code": "fluxo.etapa-nao-executando", "message": "...", "type": "Validation|NotFound|Conflict|Forbidden|Unauthorized|Failure" }] }`. `message` é texto pro usuário; `code` é estável e pode ser usado pelo front (ex.: destacar campo).
- **Erro inesperado** (500): Problem Details RFC 9457 (`type`, `title`, `status`, `traceId`) via `IExceptionHandler` global. Nunca stacktrace, nunca detalhe técnico.
- Validação (FluentValidation) vira `Result.Failure` com `type: Validation` no pipeline do MediatR, não mais `ValidationException`.

## Frontend

`core/http/error.interceptor.ts` decide pela forma do body: `errors[]` → toast com `message` (e `code` disponível pra page); Problem Details → mensagem genérica + log do `traceId`. 401 passa antes pelo interceptor de sessão (ADR-0004).

## Impacto

Refactor transversal na `esteira-api` (handlers, behaviors, controllers, testes). Consumers do RabbitMQ não mudam de contrato. Vira spec de backend própria.
