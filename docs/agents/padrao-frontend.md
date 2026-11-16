# Padrão do frontend Angular

Default de todo `<projeto>-frontend` nascido deste template — o mesmo que Valuto e Esteira chegaram por discovery. O discovery do projeto **confirma** este arquivo; o que divergir vira ADR do projeto citando a seção daqui. O bootstrap (passo 7 do roteiro) monta exatamente isto, e o `<projeto>-frontend/CLAUDE.md` resume com os nomes do domínio. Visual: `docs/design/`. Contrato com a API: `padrao-api.md`.

## Stack

| Peça | Escolha |
|---|---|
| Framework | Angular estável mais recente · standalone · **zoneless** (`provideZonelessChangeDetection`) |
| Componentes | **spartan/ui**: `@spartan-ng/brain` (npm) + helm copiado em `src/app/shared/ui` (`components.json`, alias `@spartan-ng/helm/<nome>`) — `docs/design/component-library.md` |
| Estilo | Tailwind 4; tokens com fonte única em `src/styles.css` (`@theme` pros utilitários, `:root` pras variáveis do helm) |
| Estado | Signals (`signal`/`computed`; `effect` só pra side effect real) |
| Dados | `httpResource`/`resource()` pra leitura; `firstValueFrom` pra comando |
| Contrato | `openapi-typescript` gera `core/api/<projeto>-api.d.ts` do OpenAPI da API (`npm run generate:api-types`); nunca editar à mão nem declarar interface própria pra payload |
| Testes | Vitest (runner do CLI) + Angular Testing Library · Playwright (E2E, Docker) · axe-core (WCAG 2.1 AA) em toda tela nova |
| Node | versão fixa em `.nvmrc` |

Decidir no discovery (sem default): i18n (sem i18n = texto pt-BR direto no template), mobile (Ionic/Capacitor), testes visuais (Chromatic).

## Camadas + smart/dumb

| Camada | Arquivo | Pode | Não pode |
|---|---|---|---|
| API | `{feature}-api.service.ts` | `HttpClient`, URL, tipos gerados | regra, signal, mensagem |
| Domínio | `{feature}.service.ts` | orquestrar a API, signals, regra de exibição | `HttpClient` direto |
| Smart | `pages/*.page.ts` | serviço de domínio, Router | API service, `HttpClient` |
| Dumb | `components/*.component.ts`, `shared/ui/` | só `input()`/`output()` | injetar serviço |

- Serviço de domínio `providedIn: 'root'` pra catálogo/lista; **escopo de rota** (`providers` no componente da rota) pro que é de uma instância.
- Rotas filhas com `loadComponent`.
- Mensagem de erro sai do interceptor (`padrao-api.md`), de sucesso sai da page — nunca da camada API.

```
src/app/
  core/      config/ (runtime) · api/ (tipos gerados) · http/ (interceptors: sessão, erro, paginação) · auth/
  layout/    casca (sidebar + header), sem regra de negócio
  features/  <feature>/ api service · domain service · pages/ · components/
  shared/    ui/ (helm + componentes próprios) · pipes/ · guards/
  app.config.ts · app.routes.ts
```

Nomenclatura: arquivos kebab-case; `*.page.ts`, `*.component.ts`, `*-api.service.ts`, `*.service.ts`; constantes `UPPER_SNAKE_CASE`; guards `camelCase` (`authGuard`). Seletores `hlm*` só em `shared/ui`; o resto usa o prefixo do projeto. Features, componentes e rotas com os termos do `CONTEXT-MAP.md`.

## Configuração em runtime

O template-ci gera o Artefato uma vez (na pipeline do Fluxo) e o mesmo percorre qa → hml → produção, então **nada de `environment.<ambiente>.ts`**. No boot, `provideAppInitializer` faz `GET /config.json` (antes do `auth.service`) e guarda num signal (`core/config/app-config.service.ts`). No container, o nginx do template-ci responde com a variável `APP_RUNTIME_CONFIG`; em dev, `public/config.json`. Nunca segredo lá (é público).

## Feature flags

Mudança de comportamento que o usuário percebe (tela nova, regra nova ou alterada, endpoint novo consumido pelo front) entra atrás de um flag `Features:<Fatia>` (ex.: `Features:B2`, código da Fatia). Regras completas e o critério em `docs/agents/padrao-api.md`, seção "Feature flags". No front:

- Os flags chegam por `GET /features.json` em runtime (`{"B2":true,...}`, servido pelo nginx do template-ci a partir do ConfigMap do Ambiente, `APP_FEATURES_JSON`), por Ambiente: o estado pertence ao Ambiente, não à imagem. `{}` = tudo desligado. Um serviço (`core/config/feature-flags.service.ts`), carregado no mesmo `provideAppInitializer` do `/config.json`, expõe `isEnabled('B2')`.
- **Flag ausente conta como desligado.** Nunca `?? true` nem default ligado.
- Rota e item de menu da feature checam o flag; com ele desligado a tela não existe para o usuário.
- Só a Esteira liga e desliga (reinicia o pod); o front não altera flag.
- Fatia que dispensa flag (correção, refatoração, infra, migração expand-only) declara `flag: não` na spec.

## Preview da Fatia

Fatia que toca o front declara `preview:` na spec (módulo e rota de entrada). O agente `ui` cria, como parte da Fatia, a **sessão falsa** (já logado) e os **dados falsos** da tela, **tipados pelos tipos gerados do OpenAPI** (`openapi-typescript`): dado fora do contrato quebra o build. O preview é um build estático servido por um nginx mínimo no cluster, sem API nem banco.

## Sessão e permissão

- Nenhum token no navegador (BFF, `padrao-api.md`). `auth.service` chama `GET /api/v1/usuarios/me` no boot e guarda o usuário num signal; `authGuard`/guard de perfil leem o signal; interceptor de sessão trata `auth.access-token-expired` (refresh + repete a request); login/logout são navegação de página inteira.
- `/api` na mesma origem: em dev, `proxy.conf.json` do `ng serve`; no cluster, o Ingress.
- O front pergunta à API o que o usuário pode fazer (endpoint de permissões); nunca reimplementa regra de papel.

## Segurança

IDs opacos (GUID) nas URLs; redirect só pra caminho interno; CSP e headers no nginx do template-ci (`inlineCritical: false`); `npm audit` no CI; nunca stacktrace na tela.
