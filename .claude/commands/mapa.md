---
description: Confere se o mapa de fatias (specs/README.md) cobre tudo que o projeto já definiu — telas, ADRs, mudanças de template/infra, pendências — e aponta lacunas, fatias grandes demais e inconsistências
argument-hint: "[aplicar]"
---
Somente leitura: o relatório **não altera** o mapa. Com `aplicar` (depois do ok do humano a uma proposta que você mostrou), edita o `specs/README.md`. Rode da raiz do workspace.

Por que existe: o mapa nasce no discovery e envelhece — protótipos, ADRs e `docs/mudancas-*.md` aparecem depois, e nada garante que viraram fatia. Este comando é a conferência que faltava.

## 1. Levantar as fontes (só o que existir)

| Fonte | O que vira "item a cobrir" |
|---|---|
| `docs/design/prototipos/README.md` (tabela de telas e "Regras de negócio decididas…") | cada tela e cada regra |
| `docs/adr/*.md` | cada decisão que exige código, tela, infra ou mudança de template (a seção "Impacto"/"Consequences"; ADR puramente de convenção não gera item) |
| `docs/mudancas-template.md`, `docs/mudancas-infra.md` | cada item numerado |
| `PENDENCIAS.md` do workspace e dos repositórios de código | cada pendência que é trabalho (não "como rodar") |
| `CONTEXT-MAP.md` (Linguagem) | operações e conceitos que precisam de funcionalidade (ex.: Cancelamento, Rollback, Sincronização, Notas de entrega) |
| `specs/README.md` | as fatias existentes (código, repositório, depende de, toca em, status) |

## 2. Cruzar

Para cada item, ache a fatia que o cobre: citada no texto da linha ou na spec dela (`specs/feature/…`). Classifique:
- **coberto** — uma fatia entrega isso;
- **parcial** — a linha só cita de passagem, ou cobre uma parte (diga qual falta);
- **sem fatia** — nenhuma linha cobre.

## 3. Conferir o mapa em si

- **Fatia grande demais:** linha que junta mais de ~3 assuntos distintos (telas, agregados, mudanças de template, infra) ou lista tudo com "+" — proponha o corte.
- **Dependências:** "Depende de" que cita código inexistente, ciclo, ou dependência faltando (fatia que usa algo que outra entrega).
- **Estrutura:** coluna Status é a primeira; "Toca em" preenchida; cada fatia tem repositório e quem executa.
- **Ordem:** fatia que bloqueia muitas outras está cedo no mapa?

## 4. Responder

```
Cobertura do mapa: 42 itens · 25 cobertos · 9 parciais · 8 sem fatia
Fatias grandes demais: E1 (6 assuntos), E2 (4)

SEM FATIA
  Auditoria (protótipo: prototipo-auditoria.html; README dos protótipos, regra "Auditoria")   → proposta: X1
PARCIAL
  Painel de indicadores (protótipo entregas) — a E1 cobre a lista, falta o painel            → proposta: ajustar E1 / X2
...

PROPOSTA DE MAPA (só as linhas que mudam)
| Status | # | Fatia | Repositório | Quem executa | Depende de | Toca em |
...
```

Cada item aponta a **origem** (arquivo e seção). Não invente cobertura: na dúvida, "parcial" e diga o que ficou sem resposta. Proposta de fatia nova traz código, título, repositório, "depende de" e "toca em"; fatia de uma só tela ou de um só agregado, nunca "o módulo inteiro".

Termine com a decisão que é do humano: quais linhas entram, saem ou mudam de ordem, e se algum item precisa de `/grill-with-docs` antes (decisão que nenhuma ADR cobre).

## 5. `aplicar`

Só depois de o humano aprovar a proposta (linha a linha, ou "aprovo tudo"): edite `specs/README.md` — Status na primeira coluna, "Toca em" preenchido — e deixe a alteração para o commit de docs do workspace (nunca comite sozinho). Item aprovado que exige decisão nova → registre no relatório que antes vem um `/grill-with-docs`.
