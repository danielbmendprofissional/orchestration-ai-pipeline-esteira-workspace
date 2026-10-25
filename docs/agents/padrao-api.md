# Padrão do contrato HTTP da API

Default de toda `<projeto>-api` nascida deste template — o mesmo que Valuto e Esteira chegaram por discovery. A stack do backend não é fixa; **o contrato com o front é**. O discovery confirma este arquivo; o que divergir vira ADR do projeto citando a seção daqui. Infra (chaves, Redis, Keycloak): `infra-local.md`. Lado do front: `padrao-frontend.md`.

## Paginação

- **Request:** `X-Page` (1-based) e `X-Page-Size`. Ordenação e filtro por query string: `?sort=<campo>&order=asc|desc&<filtro>=...`.
- **Response:** body é o array puro; paginação só nos headers `X-Total-Count`, `X-Total-Pages`, `X-Page`, `X-Page-Size`. CORS expõe os quatro.
- Front: um helper em `core/http/` lê/escreve os headers; nenhuma page conhece header.

## Erros

- Todo handler retorna `Result<T>`; erro de negócio nunca é exception. Validação (ex.: FluentValidation no pipeline) vira `Result.Failure` com `type: Validation`.
- **Negócio** (400/401/403/404/409/422): `{ "errors": [{ "code": "area.motivo", "message": "...", "type": "Validation|NotFound|Conflict|Forbidden|Unauthorized|Failure" }] }`. `message` é pro usuário; `code` é estável e o front pode usar.
- **Inesperado** (500): Problem Details RFC 9457 (`type`, `title`, `status`, `traceId`) por um handler global. Nunca stacktrace nem detalhe técnico.
- Front: `core/http/error.interceptor.ts` decide pela forma do body — `errors[]` → mensagem com `message` (e `code` disponível pra page); Problem Details → mensagem genérica + log do `traceId`. 401 passa antes pelo interceptor de sessão.

## Sessão (BFF / token handler)

- **Nenhum token no navegador.** Só o cookie opaco `<projeto>_session` (httpOnly, `SameSite=Strict`, `Secure` fora de dev). Access/refresh/id token ficam no Redis (`Redis:KeyPrefix`), indexados pela sessão.
- Login: Authorization Code + PKCE `S256` na tela do Keycloak (realm `<projeto>`, client confidencial `<projeto>-api`, criados pelo agent `local-environment-config`). Nunca formulário de senha no front.
- Endpoints: `GET /api/v1/auth/login` (302 pro Keycloak) · `GET /api/v1/auth/callback` (troca o code, cria a sessão, seta o cookie) · `POST /api/v1/auth/refresh` (sem body) · `GET /api/v1/auth/logout` (encerra a sessão local + end-session do Keycloak) · `GET /api/v1/usuarios/me`.
- Middleware de sessão popula o usuário atual a partir do token no Redis; token expirado → `401` com `code: auth.access-token-expired` (sem refresh síncrono). Refresh com rotação e reuse detection (revoga todas as sessões do usuário).
- Front e API na **mesma origem** (`/api` pelo Ingress no cluster, pelo proxy do `ng serve` em dev): o cookie `SameSite=Strict` funciona sem CORS com credenciais.

## Permissões

A API expõe o que o usuário pode fazer sobre um recurso (ex.: `GET /api/v1/<recurso>/{id}/permissoes`), calculado pelas regras do backend. O front só lê.

## Identificadores

Toda entidade tem `Id` (`long`, identity) pra chave e join, e `PublicId` (GUID v7, único, gerado no domínio) pra tudo que sai da API: URL, contrato, eventos. O `long` nunca aparece fora do backend; o GUID nunca é usado em join. Rotas recebem GUID; o repositório resolve pro `long` uma vez na entrada.
