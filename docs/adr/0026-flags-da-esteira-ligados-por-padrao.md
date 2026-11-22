# ADR-0026 — Flags da própria Esteira nascem ligados

Status: Aceito · 2026-11-22 · Refina as ADRs 0019 e 0025 (o que não é citado aqui continua valendo) · Decisão do dono, "por hora"

## Contexto

As ADRs 0019 e 0025 mandam toda Fatia com mudança percebida pelo usuário nascer atrás de `Features:<Fatia>`, desligada por padrão. A Esteira ainda está sendo construída: não há usuário final, e o fluxo de Liberação (E7) que liga e desliga flags só chega depois. Com o flag desligado, o dev local devolvia 404 em todo o cadastro (A1) e a tela ficava sem ações.

## Decisão

- **O mecanismo continua** (`[FeatureFlag("X")]` na API, `featureGuard` e `RotaData.feature` no front, `/features.json`), e as Fatias da Esteira continuam declarando `flag: sim` quando mudam o comportamento percebido.
- **Para a própria Esteira, o estado padrão do flag é ligado**: `Features:<Fatia>: true` no `appsettings.json` da API e `{"<Fatia>": true}` no `public/features.json` do front.
- **Quem manda é o Ambiente**: variável de ambiente ou ConfigMap (`Features__A1=false`, `APP_FEATURES_JSON`) sobrepõe o padrão e desliga o flag. A regra do código não muda: flag **ausente** continua contando como desligado.
- **Vale só para a Esteira.** Os projetos que ela gerencia seguem as ADRs 0019 e 0025: nascem desligados em produção.

## Consequências

- O `review` não reprova mais flag ligado por padrão na Esteira, desde que esteja na configuração e não no código.
- Reverter é trocar `true` por `false` no padrão (ou remover a chave); nenhum código muda.
- Quando a E7 existir e a Esteira se entregar pela própria Esteira, reavaliar: o padrão ligado esconderia o efeito do controle de flag nela mesma.
