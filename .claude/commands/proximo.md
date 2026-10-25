---
description: Tutor — diz em que pé está o projeto, qual o seu próximo passo e de onde vem cada fatia (mapa, ADR, spec), a qualquer momento
argument-hint: "[B3]"
---
Somente leitura: não altera arquivo, issue, label nem branch. Argumento `$ARGUMENTS`: vazio = visão geral; `B3` = explica essa fatia (de onde vem, o que depende dela, o que ler).

## 1. Levantar o estado real (nada de memória)

1. `git -C <repo> fetch origin` em cada repositório de código e no workspace.
2. `specs/README.md`: a tabela de fatias (código, repositório, quem executa, depende de, toca em, risco, feito ou não).
3. GitLab (`-R <grupo>/<projeto>-workspace`): mães abertas (`glab issue list --search "—" -O json`, título `^<código> — `) com seus labels e o painel `<!-- execucao -->`; MRs abertas e mergeadas recentes em cada repositório (`glab mr list -R <grupo>/<repo> --search "<código> —"`).
4. Branches `feature/*` locais com commits à frente de `origin/dev` e arquivos de spec em `specs/feature/` sem mãe.
5. `node .claude/scripts/check-spec-drift.mjs` (sem argumento): o desvio de cada spec pendente do mapa em relação a `dev`.
6. Melhorias abertas no `orchestration-ai` (`docs/agents/melhoria-orquestracao.md`): para `ai-base`, `ai-infra`, `ai-ops` e `ai-pipeline/template-ci`, `glab issue list -R orchestration-ai/<repo> --label "origem:<projeto>" -O json` (estado aberto), separando as com label `bloqueia:<projeto>` e a MR aberta de cada uma (`glab mr list -R … --search "#<n>"`).

## 2. Classificar cada fatia

`feita` · `mergeada, falta fechar` · `MR aberta — aguarda você` · `em execução` (label `em-execucao`, com a área e o executor do painel) · `parou` (linha `⚠` no painel) · `spec escrita — aguarda sua aprovação` · `spec aprovada, sem tickets` · `tickets prontos — falta executar` · `livre` (todo "Depende de" feito) · `bloqueada` (diga por qual).

## 3. Responder — no máximo ~15 linhas

A **primeira linha** é sempre o placar do mapa, contado das classificações do passo 2 (todas as linhas de `specs/README.md`, uma fatia = uma linha):

```
Mapa: 50 fatias · 7 feitas · 1 em execução · 1 spec aguardando seu ok · 41 sem spec (3 livres agora, 38 bloqueadas)
```

"Sem spec" = a linha não tem arquivo de spec. "Livres" = todo "Depende de" feito (podem receber `/fatia` agora); "bloqueadas" = esperam alguma fatia ainda não feita (diga as que mais bloqueiam: `B3 libera 4`). Se o mapa ganhou ou perdeu linhas desde a última vez, diga (`+2 fatias novas`). Depois do placar:

```
Você está em: B2 — MR aberta, aguardando seu merge (<link>)
Já pronto:    M0, F0, D0 ✔ em dev
Seu próximo passo: <UMA ação humana concreta: revisar/mergear a MR, aprovar a spec, responder a decisão que travou…>
  ou o comando: /fatia B3   (ou /implement-task B3, conforme a classificação)

Próxima fatia: B3 — Sessão BFF (login/callback/refresh/logout/me)
  Origem:    linha B3 de specs/README.md · ADR-0004 (docs/adr/0004-….md)
  Depende:   B2 ✔ mergeada
  Vai para:  libera F0.5 e A1
  Ler antes: CONTEXT-MAP.md §Sessão · docs/agents/padrao-api.md §Sessão BFF · <o "Contexto necessário" da spec, se já existe>
  Toca em:   api + infra (agent local-environment-config) · risco alto
  Decisões:  ADR-0004 cobre — direto no /fatia B3 (sem grill)
Em paralelo agora: D0 (não toca em B3)   ← precisa de uma área: node .claude/scripts/worktree-fatia.mjs <fatia> <slug>
```

Regras da resposta:
- **Origem sempre dita:** o arquivo e a linha/seção onde a fatia nasce — uma ADR citada na linha do mapa (confira com `grep` em `docs/adr/` pelo código e pelos termos), o `docs/agents/padrao-*.md`, o `PENDENCIAS.md`, ou "definida em conversa, sem documento" (e então recomende registrar o porquê antes da spec). Nunca invente uma origem: se não achou, diga que não achou.
- **Para onde vai:** as fatias que listam esta em "Depende de" e o artefato que ela cria que outras vão citar (ADR, contrato, `DESIGN.md`).
- **Em paralelo:** só fatias livres cujo "Toca em" não cruza com nenhuma `em-execucao`; sem a coluna, diga que não dá pra garantir.
- Uma única ação humana em "Seu próximo passo"; se há várias pendentes (duas MRs, uma spec), liste em ordem de desbloqueio e destaque a que destrava mais fatias.
- Estado ambíguo (MR mergeada sem fechar, branch sem mãe, mãe `em-execucao` sem painel): diga o que viu e o que fazer, sem corrigir.
- **Repositórios sujos:** rode `node .claude/scripts/situacao.mjs --sem-mr` (rápido) e, se o fim disser `NÃO` ou `QUASE`, diga em uma linha ("2 pendências suas, 6 branches para limpar") e que o próximo passo é `/situacao`, antes de qualquer `/fatia`.
- **Melhorias:** liste cada uma (`ai-infra#7 — verify prova aud e PKCE · MR !3 aberta`). Fatia que uma delas **bloqueia** (`bloqueia:` + a fatia no corpo) **não é recomendada como próxima** enquanto a issue não estiver fechada pelo merge: diga "B4 espera ai-infra#7" e o seu próximo passo é abrir aquele repositório e rodar `/issue-ai 7` (ou mergear a MR). As que não bloqueiam aparecem como lembrete, com a fatia sugerida para resolvê-las antes.
- **Specs desatualizadas:** uma linha por spec pendente com a saída do passo 5 (`A1: ⚠ desatualizada — 11 commits em esteira-api, citados que mudaram: …`, ou `sem base registrada`; `B3: ✔ em dia`). Spec desatualizada que é a próxima fatia vira o seu próximo passo: `/fatia <código>` revalida.
- **Mapa sem conferir:** `git log -1 --format=%ct -- specs/README.md` contra o último commit em `docs/adr/`, `docs/design/prototipos/`, `docs/mudancas-*.md` e `PENDENCIAS.md`. Algum desses é **mais novo** que o mapa → "Mapa: ADR/protótipo/mudança alterados depois do último ajuste do mapa — rode `/mapa`". Só avisa; quem confere é o `/mapa`.
- **Mapa desatualizado:** compare a coluna Status do `specs/README.md` com o git (MRs mergeadas em `dev`); divergência → diga qual linha está velha. Quem corrige é o `/fatia` (no commit da spec).
- **Decisões em aberto:** para a próxima fatia, procure em `docs/adr/` e nos `docs/agents/padrao-*.md` o que cobre o assunto dela. Coberto → "Decisões: ADR-000X cobre — vá direto no `/fatia`". Há lacuna → "Decisões: falta <assunto> — o `/fatia` fará um grill curto"; fatia fora do mapa ou só uma frase vaga → "rode `/grill-with-docs` antes". Nunca invente cobertura: se não achou ADR, diga que não achou.

Com `B3`: a mesma ficha da "Próxima fatia", mais o conteúdo do "Contexto necessário" da spec (se existir), as ADRs citadas com uma linha cada sobre o que decidem, e as filhas com o executor de cada uma (se já houve execução).
