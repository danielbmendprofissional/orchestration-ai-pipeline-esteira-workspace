# ADR-0019 — Feature flags, Liberação e cancelamento de feature

Status: Aceito · 2026-11-12 · **ADR-0025:** Fatia sem flag, limpeza `<código>-L`, lembrete de dívida e como o flag é aplicado (reiniciar o pod) · **ADR-0021:** a Esteira controla (ativar e desativar por Ambiente, via job do GitLab) e rastreia o estado dos flags, no lugar de só registrar a aprovação

Com `main` única (ADR-0018), o que ainda não deve chegar ao usuário entra na `main` atrás de um **feature flag** configurado por Ambiente. **Deploy não é Liberação**: o artefato chega a produção com a feature desligada, e ligar o flag é outro ato, decidido pelo negócio.

## Regras

- **Obrigatório** para toda mudança de comportamento que o usuário percebe: tela nova, regra de negócio nova ou alterada, endpoint novo consumido pelo front. **Ficam de fora:** refatoração, correção de bug, infra e migração expand-only. É um critério que o agente `review` consegue checar.
- **Nome:** `Features:<Fatia>...` (ex.: `Features:B2`), com o código da fatia (ADR-0020). Uma busca por `Features:B2` lista tudo o que a fatia espalhou. No .NET a variável de ambiente é `Features__B2`. No front, a configuração em runtime da ADR-0006.
- **Nasce desligado em produção**, vida curta, removido depois de liberado para todos. Flag esquecido é dívida. **Flag ausente conta como desligado, no código** (ADR-0021): uma feature nunca entra no ar por omissão; o agente `review` confere. O estado do flag pertence ao Ambiente, não à imagem.
- **Banco:** migração incompatível com a versão anterior segue **expand/contract**. O `contract` nunca sai no mesmo deploy da feature nem com o flag ligado.
- **Liberação:** a aprovação de negócio (AAN) é da Liberação, não do deploy. Hoje o flag é configuração do Ambiente alterada por um humano. A Esteira **controla e rastreia o estado do flag** (ADR-0021; o texto original só registrava a aprovação).

## Cancelamento ("o negócio não quer mais")

*Reverter* e *absorver* são os dois destinos do glossário (`Cancelamento`). Esta é a mecânica de cada estágio:

| Onde a feature está | Como reverter |
|---|---|
| MR ainda aberto | Fecha o MR e apaga a branch. Nada chegou à `main`. |
| Na `main`, flag desligado em todo lugar | Mantém desligado e remove código e flag em um MR de limpeza. Nenhum deploy desfaz nada. |
| Em produção, flag ligado | Desliga o flag (configuração, sem build nem deploy) e depois faz o MR de limpeza. |
| Sem flag, ou o problema é do artefato | `git revert` na `main` (artefato novo percorre o pipeline) ou rollback para o SHA anterior (ADR-0018), se nada bom entrou depois. |
| Com mudança de banco | Só vale se a migração foi expand-only. O `expand` fica sem uso e sai num `contract` posterior. |

*Absorver*: código e flag continuam na `main` e passam a ser declarados no Fluxo seguinte.

O **MR de limpeza é uma fatia** (spec e tickets) como qualquer outra, nunca um commit solto: deixa rastro e evita código morto escondido atrás de flag desligado para sempre.

## Considered Options

- **Branch longa por feature** (sem flag): nega o trunk-based, deixa o código sem integrar por semanas e vira merge doloroso.
- **Flag só para o que é "arriscado"**: cada pessoa julga de um jeito. "Comportamento percebido pelo usuário" é checável.
- **Esteira rastreando o estado do flag agora**: adiado nesta ADR, adotado na ADR-0021.

## Consequences

- `docs/agents/padrao-api.md` e `padrao-frontend.md` ganham uma seção curta sobre flags.
- A posição da AAN nas Etapas do Fluxo muda (CONTEXT-MAP).
- Alterar um flag em produção é mudança de ConfigMap/variável; no .NET a configuração lida no start exige reiniciar o pod (sem build). Para o front, o `/config.json` em runtime evita isso. Detalhe do mecanismo em `pendencias-orchestration-ai.md`.
