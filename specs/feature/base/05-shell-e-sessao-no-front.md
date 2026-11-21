# F0.5 — Shell, sessão compartilhada, interceptors e guards

risco: alto   <!-- sessão e redirecionamento de login no front, componentes novos do spartan -->
base: workspace@68f8021 · esteira-api@104ca1d · esteira-frontend@f3416f4 · 2026-11-21
flag: não   <!-- fundação: troca a casca provisória da F0 e liga o front à sessão da B3; sem ela o app não tem o que esconder. Os repositórios da Esteira ficam fora do esquema de Entrega (ADR-0025), então não há quem ligue um flag aqui -->
preview: Início (`/`), com a sessão falsa do preview

## Contexto necessário
- esteira-frontend/CLAUDE.md (camadas, regras, comandos) · esteira-frontend/DESIGN.md (seção Layout, Buttons, Shapes) e PRODUCT.md
- docs/adr/0004-autenticacao-bff.md (a decisão; esta spec aplica o lado do front) · docs/adr/0005-frontend-stack.md · docs/adr/0006-configuracao-runtime.md
- docs/agents/padrao-frontend.md (camadas, Sessão e permissão, Segurança) · docs/agents/padrao-api.md (Erros, Paginação, Sessão)
- docs/design/prototipos/README.md e `base.css`/`comum.js` (menu lateral, cabeçalho, responsividade; referência visual, não código)
- specs/feature/base/04-sessao-bff.md (contrato dos cinco endpoints e dos códigos `auth.*`), 02-result-e-problem-details.md (`errors[]`), 03-paginacao.md (headers `X-*`)
- CONTEXT-MAP.md (Papéis: MOR é role global do realm; `perfis` do `me`)

## Ideia
O front passa a falar com a sessão BFF da B3. No boot, depois do `/config.json`, ele pergunta `GET /api/v1/usuarios/me`, guarda o usuário num signal e só então mostra a rota; quem não tem sessão vai para o login do Keycloak por navegação de página inteira. Um interceptor trata `auth.access-token-expired` (um refresh só, mesmo com várias requisições juntas, e repete a original), outro transforma `errors[]` e Problem Details em mensagem, e um helper lê e escreve os headers de paginação. A casca provisória da F0 vira o **shell** do design da D0: menu lateral de 240 px, cabeçalho com marca, ambiente e menu do usuário, página Início, `/sem-acesso` e "não encontrado". O menu é montado dos metadados das rotas, então as features futuras só declaram a rota.

Fora desta fatia: telas de negócio e itens de menu reais (A1 em diante; o menu da D1 refaz o desenho do modelo novo); sino de avisos e caixa "Aguardando você" (E3b); `feature-flags.service` e `/features.json` (padrão do template, mas a Esteira não tem Entrega nem flag para os próprios repositórios, ADR-0025; entra quando um projeto filho precisar); `GET .../permissoes` e papéis por Aplicação (A1); tempo real SSE (ADR-0011); ajuste do Ingress e do nginx para `/api`; i18n.

## Dados
N/A — nenhum dado persistido no navegador: sem `localStorage`, `sessionStorage` nem cookie lido ou escrito pelo código (o cookie `esteira_session` é `HttpOnly`).

## Backend
N/A — os cinco endpoints, os códigos `auth.*` e os headers `X-*` já estão na `main` da `esteira-api` (B3, B2, B1). A única dependência é o OpenAPI: `npm run generate:api-types` roda com a API no ar e substitui o `esteira-api.d.ts` hoje vazio.

## Frontend

### Boot e sessão (`core/auth/`)
- `AuthService` (domínio, `providedIn: 'root'`): signal `usuario` (`{ usuario, nome, email, perfis }`, tipo derivado do OpenAPI gerado), `carregar()` chamado no `provideAppInitializer` **depois** de `AppConfigService.carregar()`, `entrar(returnUrl)` e `sair()` por `window.location.href`. `AuthApiService` (camada API) é o único que faz `HttpClient` para `/api/v1/usuarios/me`, `/api/v1/auth/refresh`.
- **`returnUrl`:** só caminho interno (começa com `/`, não com `//` nem `/\`, sem esquema); qualquer outro valor vira `/`. Função pura em `core/auth/`, usada na ida (`/api/v1/auth/login?returnUrl=`) e conferida de novo pela API.
- `authGuard` e `perfilGuard` (`shared/guards/`, funções `CanActivateFn`): leem o signal; sem usuário → `entrar`; rota com `data.perfis` e usuário sem nenhum deles → `/sem-acesso`. Perfil é só o que o `me` devolve; regra por Aplicação é da A1.

### Interceptors (`core/http/`)
- **Sessão** (`sessao.interceptor.ts`): 401 com `code: auth.access-token-expired` → `POST /api/v1/auth/refresh` uma única vez para todas as requisições simultâneas (as outras esperam o mesmo refresh), 204 → repete a original **uma vez**; nova falha da repetição não entra em laço. 401 com `auth.nao-autenticado` ou `auth.sessao-invalida` (inclusive vindo do refresh) → login de página inteira com o `returnUrl` atual. `auth.provedor-indisponivel` no refresh → a requisição falha com a mensagem e a sessão continua. Nunca lê nem guarda token.
- **Erro** (`error.interceptor.ts`, depois do de sessão; 401 já foi tratado): corpo `errors[]` → mensagem com o `message` de cada erro e o `code` fica no erro propagado para a page; Problem Details (500) → "Algo deu errado. Tente de novo." e `traceId` só no `console.error`; falha de rede → mensagem genérica. Nunca stacktrace nem detalhe técnico na tela. Toast pelo componente `sonner` do spartan.
- **Paginação** (`paginacao.ts`): lê `X-Total-Count`, `X-Total-Pages`, `X-Page`, `X-Page-Size` de uma `HttpResponse` e devolve `{ itens, total, totalPaginas, pagina, tamanho }`; escreve `X-Page` e `X-Page-Size` na requisição. Header ausente ou não numérico → erro explícito (contrato quebrado aparece, não vira lista vazia). Nenhuma page conhece header.

### Shell (`layout/`)
- Casca sem regra de negócio: menu lateral de 240 px (abaixo de 1100 px vira coluna de ícones de 64 px com o nome no hover; abaixo de 760 px vira barra no topo), conteúdo limitado a 1680 px e centralizado, sem rolagem lateral de 2560 a 320 px, como no DESIGN.md.
- Cabeçalho: logo aprovado da D0, selo do ambiente (`AppConfigService`) e menu do usuário (nome, e-mail, perfis, **Sair**). Sem sino.
- Menu montado de metadados da rota (`data: { menu: { rotulo, icone }, perfis? }`): o mesmo dado serve ao menu e ao `perfilGuard`, então item e rota nunca divergem. Com as rotas atuais o menu tem só **Início**.
- Páginas: **Início** (`/`, saudação com o nome), **Sem acesso** (`/sem-acesso`) e **Não encontrado** (`**`). Rotas filhas com `loadComponent`.
- Acessibilidade: landmarks `header`/`nav`/`main`, link "Pular para o conteúdo", foco visível, menu do usuário operável por teclado.
- Componentes helm novos via `npx ng g @spartan-ng/cli:ui`: `button`, `dropdown-menu`, `sonner` (o `badge` já existe). Tokens só de `src/styles.css`.
- `app.ts`/`app.html` deixam de ser a casca provisória: o `App` só hospeda o shell.

### Preview
`preview: Início`. O agente `ui` cria a configuração de build `preview`, que troca o `AuthApiService` por uma sessão falsa (usuário com `perfis: ['mor']`, tipado pelos tipos gerados) e serve `/` sem API nem Keycloak.

## Infra
N/A — `proxy.conf.json` (`/api` → `localhost:5105`) já existe; Ingress e nginx não fazem parte. O realm, a role `mor` e os usuários `dev` e `dev-sem-papel` já existem (B3.1, item 4 de `docs/mudancas-infra.md`); mesmo assim o E2E automatizado usa a API simulada (abaixo), sem depender de Keycloak no ar.

## Critérios (EARS)
1. Quando o app inicia, o front deve carregar `/config.json` e depois chamar `GET /api/v1/usuarios/me` uma única vez, guardar `usuario`, `nome`, `email` e `perfis` num signal e só então renderizar a rota.
2. Se o `me` do boot volta 401 `auth.nao-autenticado` ou `auth.sessao-invalida`, o front deve navegar a página inteira para `/api/v1/auth/login?returnUrl=<caminho atual>`.
3. Se o `me` do boot volta 401 `auth.access-token-expired`, o front deve fazer o refresh, repetir o `me` e seguir sem mostrar login.
4. Quando várias requisições recebem `auth.access-token-expired` ao mesmo tempo, o front deve chamar `POST /api/v1/auth/refresh` uma única vez, esperar o 204 e repetir cada original uma vez.
5. Se o refresh volta 401 (`auth.sessao-invalida` ou `auth.nao-autenticado`), o front deve ir ao login com o `returnUrl` atual, sem repetir as originais.
6. Se o refresh falha com `auth.provedor-indisponivel`, o front deve mostrar a mensagem, falhar a requisição original e manter o usuário na página, sem ir ao login.
7. Se a requisição repetida depois do refresh volta de novo 401 `auth.access-token-expired`, o front não deve tentar outro refresh (sem laço).
8. Quando uma resposta traz `errors[]` (400, 403, 404, 409, 422), o front deve mostrar o `message` de cada erro e expor o `code` à page; quando traz Problem Details ou falha de rede, deve mostrar uma mensagem genérica, registrar o `traceId` só no console e nunca mostrar stacktrace.
9. O front não deve ler, escrever nem guardar token, cookie de sessão ou dado de sessão em `localStorage`, `sessionStorage` ou IndexedDB.
10. Se o `returnUrl` não é um caminho interno (não começa com `/`, começa com `//` ou `/\`, tem esquema ou host), o front deve usar `/`.
11. Se uma rota protegida é ativada sem usuário no signal, o `authGuard` deve levar ao login; se a rota declara `perfis` e o usuário não tem nenhum, o `perfilGuard` deve levar a `/sem-acesso`.
12. Quando o usuário aciona **Sair**, o front deve navegar a página inteira para `/api/v1/auth/logout`.
13. O menu deve listar só os itens cujas rotas o usuário pode abrir (mesmo metadado de `perfis` do guard), e o cabeçalho deve mostrar o selo do ambiente do `/config.json` e o nome do usuário.
14. Enquanto a largura é 2560 a 320 px, a página não deve ter rolagem lateral; abaixo de 1100 px o menu vira coluna de ícones de 64 px e abaixo de 760 px vira barra no topo.
15. Quando uma resposta paginada chega, o helper deve devolver `itens`, `total`, `totalPaginas`, `pagina` e `tamanho` a partir dos headers `X-*`; se um header falta ou não é numérico, deve falhar com erro explícito.
16. As telas Início, Sem acesso e Não encontrado, o shell e o menu do usuário não devem ter violação WCAG 2.1 AA (axe) e devem ser operáveis só por teclado.
17. O `esteira-api.d.ts` deve ser regenerado do OpenAPI da API e o código do front não deve declarar interface própria para payload da API.

## Testes
Marca da fatia: `[F0.5]` no Vitest e `@F0.5` no Playwright. (O preview e o `fechar-fatia` não aceitam ponto no código, ver `pendencias-orchestration-ai.md`; aqui só afeta a marca de teste e é aceito.)
- **Vitest** (junto do arquivo): `returnUrl` (10: relativo, `//`, `/\`, esquema, host externo, vazio); `AuthService` (1, 2, 12: `HttpTestingController`, navegação injetável para não trocar a página nos testes); sessão interceptor (3, 4 com requisições paralelas e um único refresh, 5, 6, 7); erro interceptor (8: `errors[]`, Problem Details, rede); guards (11); helper de paginação (15); montagem do menu por perfil (13); nenhum uso de storage/cookie (9, varredura do código por `localStorage|sessionStorage|document.cookie|indexedDB` em `src/app`).
- **Componente** (Angular Testing Library): shell com menu, cabeçalho, menu do usuário e **Sair** (12, 13); páginas Início, Sem acesso e Não encontrado.
- **Playwright + axe** (`e2e/`, **API simulada** com `page.route` para `/api/v1/usuarios/me`, `/api/v1/auth/refresh` e os 401): boot logado, boot sem sessão (2, destino da navegação conferido sem seguir ao Keycloak), refresh no boot (3), `perfis` sem `mor` caindo em `/sem-acesso` (11), Sair (12), larguras 2560, 1280, 1000, 700 e 320 sem rolagem lateral e com o menu na forma certa (14), axe nas três telas e no menu do usuário aberto (16), navegação só por teclado.
- **Contrato:** `npm run generate:api-types` roda com a API no ar e o `esteira-api.d.ts` deixa de ser vazio; `ng build` falha se o front usa campo fora do contrato (17).
- **Manual, uma vez, contra o Keycloak real** (não automatizado; registrar no relatório do `/implement-task`): `npm start` com a API local, login real com `dev` (cabeçalho mostra o nome e o perfil `mor`), recarregar a página sem novo login, **Sair**, e novo acesso volta ao Keycloak; com `dev-sem-papel`, `perfis` sem `mor`.
- `ng lint`, `ng build` e `npm run test:ci` verdes, sem warning novo.
