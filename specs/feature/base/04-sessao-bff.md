# B3 — Sessão BFF: login, callback, refresh, logout e `me`

risco: alto   <!-- sessão, segredo, dependência nova (StackExchange.Redis), pedido de infra -->

## Contexto necessário
- esteira-api/CLAUDE.md (camadas, padrões, testes)
- esteira-api/docs/PENDENCIAS.md (item `[Authorize]` nos endpoints)
- docs/adr/0004-autenticacao-bff.md (a decisão; esta spec a aplica e fixa os detalhes que ela deixa abertos)
- docs/agents/padrao-api.md (seção Sessão) · docs/agents/infra-local.md (chaves do contrato, Redis sem `SCAN`/`KEYS`, padrão Keycloak)
- docs/adr/0003-erros.md e specs/feature/base/02-result-e-problem-details.md (erros de sessão saem como `errors[]`; usa o `ApiDeTeste`)
- CONTEXT-MAP.md (Papéis: MOR é role global do realm)
- docs/mudancas-infra.md (item 4, criado por esta fatia)

## Ideia
Hoje a API valida JWT Bearer direto (`AddJwtBearer`) e nenhum endpoint exige login. Esta fatia troca isso pelo BFF da ADR-0004: o navegador só tem o cookie opaco `esteira_session`; os tokens do Keycloak ficam no Redis. Entregam-se os cinco endpoints (`login`, `callback`, `refresh`, `logout`, `usuarios/me`), o esquema de autenticação por sessão que alimenta `IUsuarioAtual`, e a **exigência de sessão por padrão** em todo endpoint (quem não quer, declara `[AllowAnonymous]`).

Fora desta fatia: guards, interceptor de refresh e `auth.service` do front (F0.5); autenticação da superfície da pipeline por `id_token` do GitLab (E1 — o E1 acrescenta o próprio esquema e marca as rotas `/api/pipeline/v1` como anônimas para a sessão); papéis por Aplicação e `/permissoes` (A1); audit trail; migrar o `ICacheService` para Redis (continua em memória); ajuste do Ingress/`deploy/k8s` (`/api` → API) e dos redirect URIs dos ambientes publicados.

## Dados
N/A — nenhuma tabela, nenhuma migration. Estado de sessão só no Redis (abaixo).

## Backend

### Decisões que a ADR não fixa
- **Sem pacote OIDC.** O fluxo (discovery, troca de code, refresh, end-session) é próprio, com `HttpClient` tipado e o documento `.well-known/openid-configuration` de `Keycloak:Authority`. Único pacote novo: `StackExchange.Redis` (MIT). `Microsoft.AspNetCore.Authentication.JwtBearer` e o `AddJwtBearer` saem.
- **Redis só com comandos simples** (`GET`/`SET`/`DEL`/`SADD`/`SREM`/`SMEMBERS`/`EXPIRE`, `SET NX` para trava): a ACL do projeto nega `SCAN`/`KEYS` e comandos perigosos (sem script Lua). Toda chave com `Redis:KeyPrefix`.
- **Chaves:** `{prefix}sessao:{id}` (hash/JSON: `sub`, `access_token`, `refresh_token`, `id_token`, `expira_em` do access token), `{prefix}usuario:{sub}:sessoes` (set dos ids de sessão do usuário, para revogar todas), `{prefix}login:{state}` (code verifier, nonce, `returnUrl`; TTL 5 min; apagada ao usar), `{prefix}refresh:{id}` (trava, TTL 10 s). TTL da sessão = `refresh_expires_in` devolvido pelo Keycloak.
- **Id de sessão:** 32 bytes aleatórios (CSPRNG), base64url. O cookie guarda só esse id.
- **Cookie `esteira_session`:** `HttpOnly`, `SameSite=Strict`, `Path=/`, `Secure` quando `Autenticacao:RequerHttps` (verdadeiro fora de Development), sem `Domain`, de sessão (sem `Expires`).
- **Configuração do projeto** em `Autenticacao` (appsettings, não é chave de contrato da infra): `UrlPublica` (base pública do front/API, mesma origem; Development `http://localhost:4200`) usada no `redirect_uri` (`{UrlPublica}/api/v1/auth/callback`, idêntico ao do manifesto da infra) e no `post_logout_redirect_uri`. Ausente fora de Development → a API não sobe e diz qual falta (como as demais obrigatórias). `ClaimUsuario`/`ClaimNome` continuam.
- **Claims** vêm do token guardado, lido sem revalidar assinatura (chegou pelo canal de fundo, TLS, do endpoint de token do Keycloak a um client confidencial): `sub` (id), `preferred_username` (usuário), `name`, `email`, `realm_access.roles` (perfis). MOR = perfil `mor`.
- **`returnUrl`:** só caminho relativo da mesma origem (começa com `/`, não com `//` nem `/\`, sem esquema). Qualquer outro valor ou ausente → `/`. Nunca redireciona para host externo.

### Endpoints (`/api/v1`, ADR-0004)
| Rota | O quê |
|---|---|
| `GET /auth/login?returnUrl=` | anônimo. Cria `state`, `nonce` e PKCE `S256`, grava `login:{state}` e responde 302 para o `authorization_endpoint` (`scope=openid profile email`). |
| `GET /auth/callback?code=&state=` | anônimo. Consome `login:{state}` (uso único), troca o code (client secret + `code_verifier`), confere `nonce` do id_token, cria a sessão, seta o cookie e responde 302 para o `returnUrl`. `state` desconhecido/reusado ou erro do Keycloak → 302 para `/` **sem** cookie e **sem** expor o motivo na URL; o motivo vai pro log. |
| `POST /auth/refresh` | sem body. Troca o refresh token (rotação), atualiza a sessão e responde 204. Sob trava por sessão: requisições simultâneas (várias abas) fazem uma troca só e as outras veem o token já novo. |
| `GET /auth/logout` | apaga a sessão no Redis (e do set do usuário), expira o cookie e responde 302 para o `end_session_endpoint` com `id_token_hint` e `post_logout_redirect_uri={UrlPublica}/`. Sem sessão → 302 direto para `/`. |
| `GET /usuarios/me` | exige sessão. `200 { usuario, nome, email, perfis }`. |

### Sessão como esquema de autenticação
- Esquema `Sessao` (`AuthenticationHandler`) lê o cookie, busca a sessão no Redis e monta o `ClaimsPrincipal`; `IUsuarioAtual` passa a expor também `Id`, `Email`, `Perfis` e `EhMor` (o que não depende de `HttpContext` no Application).
- **Política padrão (`FallbackPolicy`)**: usuário autenticado. `[AllowAnonymous]` em `login`/`callback`/`logout`, e `.AllowAnonymous()` em `/health`, `/metrics`, OpenAPI e Scalar (este só em Development, como hoje). Sem `[Authorize]` repetido nos controllers.
- Sem cookie, cookie desconhecido ou sessão expirada no Redis → `401` `auth.nao-autenticado`. Access token vencido (`expira_em`) → `401` `auth.access-token-expired`, **sem refresh síncrono**. Ambos saem no formato `errors[]` da ADR-0003 (o desafio do esquema usa o mesmo `RespostaDeErro` do `ResultadoFilter`); sem `WWW-Authenticate: Bearer`.
- **Reuse detection:** se o refresh falha com `invalid_grant` (token já usado/revogado), revoga **todas** as sessões do usuário (`usuario:{sub}:sessoes`), expira o cookie e responde `401` `auth.sessao-invalida`. Outra falha do Keycloak no refresh (indisponível) → `502`/`Failure` `auth.provedor-indisponivel` e a sessão fica intacta.
- Health check do Redis entra ao lado dos de Postgres, RabbitMQ e Keycloak.

### Checklist
- [ ] `StackExchange.Redis` registrado a partir de `ConnectionStrings:Redis` (obrigatória, falha clara se faltar) e `Redis:KeyPrefix`; `IConnectionMultiplexer` singleton.
- [ ] Porta de sessão em `Application/Interfaces/Sessao` (criar/obter/renovar/revogar/revogar todas do usuário) e adaptador Redis em `Esteira.Infra.Cache`; fluxo OIDC e esquema `Sessao` em `Esteira.Api/Autenticacao`.
- [ ] `HttpClient` tipado do provedor OIDC (discovery com cache em memória, troca de code, refresh, end-session), substituível nos testes.
- [ ] `AuthController` (`login`, `callback`, `refresh`, `logout`) e `UsuariosController` (`me`) finos; erros como `Result`.
- [ ] `AddJwtBearer`/pacote JwtBearer removidos; `Keycloak:Authority`/`ClientId`/`ClientSecret` lidos do contrato; `FallbackPolicy` + `AllowAnonymous` conforme acima.
- [ ] `IUsuarioAtual`/`UsuarioAtual` estendidos; `Autenticacao:UrlPublica` em `appsettings*.json`.
- [ ] CORS: `AllowCredentials` e `Cors:Origens` continuam só em Development (em produção é mesma origem); sem token em nenhuma resposta nem log (Serilog não registra cookie, `Authorization` nem corpo de token).
- [ ] `esteira-api/CLAUDE.md` e `docs/PENDENCIAS.md`: sessão BFF descrita, item `[Authorize]` marcado como feito, "Como rodar" cita Redis e o login do usuário `dev`.

## Frontend
N/A — `auth.service`, `authGuard`/`perfilGuard`, interceptor de refresh e `proxy.conf.json` são da F0.5 (o proxy de `/api` → `localhost:5105` já existe).

## Infra
Pedido ao agent `local-environment-config` em `docs/mudancas-infra.md`, item 4, **antes de executar a spec** (ticket próprio, sem dependência de código):
- realm `esteira`: role `mor` em `keycloak.realmRoles`; usuário de teste `dev` com `roles: ["mor"]` e um segundo usuário sem role (`dev-sem-papel`) para os testes manuais de acesso;
- confirmar no `apply`/`verify`: client `esteira-api` confidencial com PKCE `S256`, `aud` do access token com `esteira-api`, `revokeRefreshToken` ligado, `redirectUris`/`postLogoutRedirectUris` como no manifesto, e `realm_access.roles` presente no access token;
- ACL Redis do usuário `esteira` aceita os comandos listados acima em `esteira:*`; segredos regravados no user-secrets da API (`infra-config.mjs secrets esteira`).
Nenhuma chave nova no contrato.

## Critérios (EARS)
1. Quando `GET /auth/login` é chamado, a API deve responder 302 para o `authorization_endpoint` do Keycloak com `response_type=code`, `code_challenge_method=S256`, `state`, `nonce` e o `redirect_uri` de `Autenticacao:UrlPublica`, e gravar o contexto do login no Redis com TTL.
2. Quando o `callback` recebe `code` e `state` válidos, a API deve criar a sessão no Redis, setar o cookie `esteira_session` (`HttpOnly`, `SameSite=Strict`, `Secure` fora de Development) e responder 302 para o `returnUrl` do login.
3. Se o `state` do callback é desconhecido ou já foi usado, ou o Keycloak devolve erro ou `nonce` diferente, a API deve responder 302 para `/` sem criar sessão nem cookie e sem o motivo na URL.
4. Se o `returnUrl` não é um caminho relativo da mesma origem, a API deve redirecionar para `/` após o login.
5. A API não deve expor access, refresh ou id token em corpo, header (além do `id_token_hint` na URL do end-session, que é do Keycloak), cookie ou log de nenhum endpoint.
6. Quando uma requisição chega com sessão válida e access token dentro da validade, a API deve popular `IUsuarioAtual` (`Id`, `Usuario`, `Nome`, `Email`, `Perfis`, `EhMor`) a partir dos claims do token guardado.
7. Se uma requisição a endpoint protegido chega sem cookie, com cookie desconhecido ou com sessão expirada no Redis, a API deve responder 401 `auth.nao-autenticado` no formato `errors[]`.
8. Se o access token da sessão está vencido, a API deve responder 401 `auth.access-token-expired` sem chamar o Keycloak.
9. Quando `POST /auth/refresh` é chamado com sessão válida, a API deve trocar o refresh token no Keycloak, guardar os tokens novos na mesma sessão e responder 204.
10. Quando duas chamadas de refresh da mesma sessão chegam ao mesmo tempo, a API deve chamar o Keycloak uma única vez e ambas devem terminar em 204.
11. Se o refresh volta `invalid_grant`, a API deve revogar todas as sessões do usuário, expirar o cookie e responder 401 `auth.sessao-invalida`.
12. Se o Keycloak está indisponível no refresh, a API deve responder com erro `auth.provedor-indisponivel` e manter a sessão.
13. Quando `GET /auth/logout` é chamado, a API deve apagar a sessão do Redis, expirar o cookie e responder 302 para o `end_session_endpoint` com `id_token_hint` e `post_logout_redirect_uri`; sem sessão, deve responder 302 para `/`.
14. Quando `GET /usuarios/me` é chamado com sessão válida, a API deve responder 200 com `usuario`, `nome`, `email` e `perfis`.
15. Enquanto um endpoint não declara `[AllowAnonymous]`, a API deve exigir sessão; `login`, `callback`, `logout`, `/health` e `/metrics` respondem sem sessão.
16. Enquanto a API fala com o Redis, toda chave deve começar com `Redis:KeyPrefix` e usar só os comandos permitidos pela ACL (sem `SCAN`/`KEYS`).
17. Se `ConnectionStrings:Redis`, `Keycloak:ClientSecret` ou `Autenticacao:UrlPublica` (fora de Development) faltam, a API não deve subir e deve dizer qual falta.

## Testes
- **Application** (`Esteira.Application.Tests`): validação do `returnUrl` (critério 4: relativo, `//`, `/\`, esquema, host externo, vazio) e montagem de `IUsuarioAtual` a partir de claims, incluindo `EhMor` (6).
- **Integração — Redis real** (`Esteira.Integration.Tests`, Testcontainers Redis com ACL de prefixo): repositório de sessão — TTL, set por usuário, revogar todas, trava de refresh; assert de que toda chave criada começa com o prefixo (16).
- **Integração — HTTP** (`ApiDeTeste` da B2, Redis real, **provedor OIDC falso** no lugar do `HttpClient` tipado, com `refresh_token` rotativo e `invalid_grant` programáveis): critérios 1, 2, 3, 5 (varredura de resposta e log capturado), 7, 8 (provedor falso sem chamadas), 9, 10 (duas chamadas paralelas, provedor falso conta uma troca), 11, 12, 13, 14, 15 (controller de teste sem `[AllowAnonymous]` → 401; os anônimos → não 401) e 17 (host sem a chave falha com mensagem).
- **Contrato de erro:** 401 em `errors[]` com `code`, nunca corpo vazio nem `WWW-Authenticate: Bearer`.
- **Manual, uma vez, contra o Keycloak real** (não automatizado; registrar no relatório do `/implement-task`): login com `dev`, `me` com `perfis` contendo `mor`, refresh, logout e novo `me` → 401. Com `dev-sem-papel`, `perfis` sem `mor`.
- `grep -rn "AddJwtBearer\|JwtBearer" src test` não acha nada. `dotnet test --solution Esteira.slnx` verde, sem warnings novos.
