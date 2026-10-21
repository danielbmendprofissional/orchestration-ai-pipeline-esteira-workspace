# ADR-0004 — Autenticação BFF/Token Handler com Keycloak + Redis (igual ao Valuto ADR-004)

Status: Aceito · 2026-10-21 · Substitui JWT Bearer validado direto pela API

## Decisão

- **Nenhum token no navegador.** O navegador guarda só o cookie opaco `esteira_session` (httpOnly, `SameSite=Strict`, `Secure` fora de dev). Access/refresh/id token do Keycloak ficam no **Redis**, indexados pela sessão.
- **Login:** Authorization Code + PKCE (`S256`) com a tela do Keycloak (realm `esteira`, client confidencial `esteira-api`). Nunca formulário de senha no Angular.
- **Endpoints** (`esteira-api`): `GET /api/v1/auth/login` (302 pro Keycloak), `GET /api/v1/auth/callback` (troca code, cria sessão, seta cookie), `POST /api/v1/auth/refresh` (sem body), `GET /api/v1/auth/logout` (encerra sessão local + end-session do Keycloak), `GET /api/v1/usuarios/me`.
- **Middleware de sessão** popula `IUsuarioAtual` a partir do token guardado no Redis; token expirado → `401` com `code: auth.access-token-expired` (sem refresh síncrono). Refresh com rotação e reuse detection (revoga todas as sessões do usuário).
- **Frontend:** `auth.service` chama `/usuarios/me` uma vez no boot (`provideAppInitializer`), guarda `{ usuario, nome, email, perfis }` num signal; `authGuard`/`perfilGuard` leem o signal; interceptor de refresh trata `auth.access-token-expired` e repete a request; login/logout são navegação de página inteira (`window.location.href`).
- **Mesma origem:** front e API no mesmo host — no cluster, o Ingress roteia `/api` pro Service da `esteira-api` e `/` pro do frontend; em dev, `proxy.conf.json` do `ng serve` manda `/api` pra API local. Assim o cookie `SameSite=Strict` funciona sem CORS com credenciais. (O nginx do template-ci não faz proxy de `/api` — o roteamento é do Ingress, a ajustar no `deploy/k8s` dos dois repositórios.)

## Permissões

`GET /api/v1/fluxo-deploy/{id}/permissoes` (já em `PENDENCIAS.md`) devolve o que o usuário pode fazer, calculado pelas regras do backend — o front não reimplementa regra de "quem pode".

## Impacto

- Infra (agent `local-environment-config`): realm `esteira`, ACL Redis `esteira:*`, client `esteira-api`.
- `esteira-api`: hoje usa `MemoryCacheService` e `AddJwtBearer` — ganha Redis e o fluxo acima. É a primeira spec de backend que bloqueia o frontend autenticado (Fatia 0.5).
- Detalhe de referência: `valuto/specs/feature/identity/02.5-login.md` (mesmo desenho, nomes trocados).
