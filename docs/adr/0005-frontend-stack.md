# ADR-0005 — Stack e arquitetura do esteira-frontend

Status: Aceito · 2026-10-21 · Base: Valuto ADR-029/030/032 + exemplo fluxo-deploy do sistema legado

## Stack

| Peça | Escolha |
|---|---|
| Framework | Angular **22.x** (estável em 2026-10; `ng update` pra 23 quando sair) · standalone · **zoneless** (`provideZonelessChangeDetection`) |
| Componentes | **spartan/ui** (brain + helm copiado em `shared/ui`) com as variáveis do helm apontando pros tokens — ver **ADR-0015** (PrimeNG 22 deixou de ser MIT) |
| Estilo | Tailwind 4, tokens no `@theme` de `src/styles.css` (fonte única pros utilitários e pro helm) |
| Estado | Signals (`signal`/`computed`, `effect` só pra side effect real) |
| Dados | `resource()`/`httpResource` pra leitura; Promise/`firstValueFrom` pra comando |
| Contrato | `openapi-typescript` gera tipos do OpenAPI da `esteira-api` (`npm run generate:api-types`); CI falha se divergir do commitado |
| Testes | **Vitest** (runner padrão do Angular CLI) + Angular Testing Library · Playwright (E2E) · axe-core (WCAG 2.1 AA). Chromatic fora por enquanto |
| i18n | **Nenhum** — texto direto em pt-BR no template |
| Mobile | Ionic/Capacitor **adiado** (ver ADR futura) |

Diferença consciente do Valuto: Vitest no lugar de Jest (padrão do CLI desde a v21), sem Ionic, sem Chromatic.

## Arquitetura — 3 camadas + smart/dumb (Valuto `frontend/CLAUDE.md`)

| Camada | Arquivo | Pode | Não pode |
|---|---|---|---|
| 1. API | `{feature}-api.service.ts` | `HttpClient`, URL, tipos gerados | regra, signal, toast/mensagem |
| 2. Domínio | `{feature}.service.ts` | orquestrar a API, `signal`/`computed`/`resource`, regra de exibição | `HttpClient` direto |
| 3a. Smart | `pages/*.page.ts` | injetar o serviço de domínio e o Router | API service, `HttpClient` |
| 3b. Dumb | `components/*.component.ts`, `shared/ui/` | só `input()`/`output()` | injetar qualquer serviço |

- Serviço de domínio em `providedIn: 'root'` pra catálogo/lista; **escopo de rota** (`providers: [...]` no componente da rota) pro que é de uma instância (ex.: `DetalheFluxoService`) — padrão já usado no sistema legado.
- Rotas filhas por etapa com `loadComponent` (`fluxo-deploy/:id/<etapa>`).
- Mensagens/toasts saem da camada API (no sistema legado, `exibirMensagemRetorno` no controller-service) e vão pro interceptor de erro (ADR-0003) e pra page (sucesso).
- as bibliotecas internas do sistema legado não existem aqui: http → `core/http`, form-control → `shared/ui/form-field`, pipes → `shared/pipes`.

```
src/app/
  core/        http/ (interceptors: sessão, erro, paginação) · config/ (runtime, ADR-0006) · auth/
  layout/      shell (sidebar + header), sem regra de negócio
  features/
    fluxo-deploy/   fluxo-deploy-api.service · fluxo-deploy.service · pages/ · components/
      detalhe/      detalhe-fluxo.service (escopo de rota) · etapas/<etapa>/ · components/steps-bar
    deploys/        análises, artefatos, severidade
    aplicacoes/     cadastro de aplicação + variáveis GitLab (ADR-0007)
  shared/      ui/ · pipes/ · guards/
```

## Nomenclatura

Arquivos kebab-case; `*.page.ts` (smart), `*.component.ts` (dumb), `*-api.service.ts`, `*.service.ts`; constantes `UPPER_SNAKE_CASE`; guards `camelCase` (`authGuard`).

## Segurança (Valuto ADR-027)

IDs opacos nas URLs quando a API expuser GUID; redirect só pra caminho interno; CSP/headers no nginx do template-ci (`inlineCritical: false`); `npm audit` no CI; nunca stacktrace na tela.
