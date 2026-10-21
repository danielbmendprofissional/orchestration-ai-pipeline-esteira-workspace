# ADR-0006 — Configuração do frontend em runtime (`/config.json`)

Status: Aceito · 2026-10-21 · Imposto pelo template-ci (build once / deploy many)

## Problema

No Angular "clássico", URL da API e afins ficam em `environment.qa.ts`, `environment.prod.ts`… e entram **no bundle na hora do build**. Isso obriga um build por ambiente — e o template-ci compila **uma vez só** e promove a **mesma imagem** (mesmo digest) de qa → hml → produção.

## Decisão

- O bundle não tem nada de ambiente. No boot, o app faz `GET /config.json` (`provideAppInitializer`, antes do `auth.service`) e guarda num signal (`core/config/app-config.service.ts`).
- Quem responde o `/config.json` é o nginx do container (`nginx/app.conf.template` do template-ci): devolve o conteúdo da variável de ambiente `APP_RUNTIME_CONFIG` (JSON), definida no Deployment (ConfigMap por ambiente no cluster).
- Em dev, `public/config.json` local.
- Com `/api` na mesma origem (ADR-0004), o `config.json` quase não tem URL — fica pra flags e textos de ambiente (ex.: `ambiente: "HML"` mostrado no header).

## Regra

Nunca segredo no `config.json` (é público). Nunca `environment.<ambiente>.ts`.
