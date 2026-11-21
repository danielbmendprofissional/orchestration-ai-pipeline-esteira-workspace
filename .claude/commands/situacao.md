---
description: Situação de todos os repositórios e áreas (workspace, api, frontend, worktrees, ai-base/ai-infra/ai-ops/template-ci): em que branch cada um está e o que fazer — commitar, mergear, alinhar, apagar — para começar a próxima fatia
argument-hint: "[--sem-mr]"
---
Somente leitura (faz `git fetch`; não altera nada). Rode da **raiz do workspace**. Argumento `$ARGUMENTS`: `--sem-mr` pula a consulta das MRs no GitLab; `--so-projeto` omite os repositórios do `orchestration-ai`.

## 1. Rodar

`node .claude/scripts/situacao.mjs $ARGUMENTS` — mostra, por repositório: branch atual, alterações não comitadas, cada branch local (mergeada, com MR aberta, sem MR, nunca enviada, remota sumida), branches só remotas e a "base" (`main` em todos) alinhada ou atrasada. Termina com **O QUE FAZER**, em quatro prioridades:

| # | Prioridade | Quem |
|---|---|---|
| 1 | commitar ou subir (alteração solta, commit não enviado, branch nunca enviada, commit local na `main`) | você |
| 2 | mergear MR aberta, ou abrir MR de branch que está no GitLab sem MR | você, no GitLab |
| 3 | alinhar (`switch` para a base e `pull --ff-only`) | seguro |
| 4 | limpar (apagar branch **já mergeada**, com `branch -d`, que recusa se não estiver mergeada) | seguro |

Antes do veredito mostra **"Pendências: N abertas em K arquivos"** (linhas `- [ ]` dos arquivos de pendência, `docs/agents/pendencias.md`): só informa, não muda o veredito. O detalhe: `node .claude/scripts/pendencias.mjs --lista`.

Fecha com uma linha **"Veredito: …"** em frase completa: tudo em dia (pode começar a próxima fatia), quase pronto (falta só alinhar, prioridade 3) ou ainda não (há prioridade 1 ou 2).

## 2. Responder

**A primeira linha da resposta é o veredito em uma frase completa, que se entende sozinha**, com o motivo e o que falta. Nunca comece com uma palavra solta (`SIM`, `QUASE`, `NÃO`). Exemplos:
- "Ainda não dá para começar a próxima fatia: há 2 coisas suas a resolver antes (1 commit solto no `ai-base` e 1 MR aberta)."
- "Quase pronto: a MR da `feature/x` já foi mergeada, falta só atualizar a `main` do `esteira-api` e apagar a branch. Depois, `/fatia B3`."
- "Tudo em dia, pode começar a próxima fatia: rode `/proximo`."

Só depois da frase vêm os itens, por prioridade.

Repita a saída em **poucas linhas**, na ordem de prioridade, e para cada item dê **o que fazer em palavras e, logo abaixo, o comando exato** em linha de código (o script já traz o comando de cada ação: `git -C "<repo>" branch -d <b>`, `git -C "<repo>" push origin --delete <b>`, `switch main && pull --ff-only`...). O humano deve poder copiar e rodar sozinho, sem pedir a você; o comando de **apagar a remota** aparece sempre, marcado "só com o seu ok". Exemplo de item: "apagar a branch local já mergeada" + `git -C "…\esteira-api" branch -d feature/x`. Exemplos de palavras: "commitar o que sobrou em `ai-base` (são arquivos do processo)", "mergear a MR !5 da B4". Não execute nada sozinho, **exceto** a prioridade 3 e 4 se o humano disser "pode alinhar e limpar": nesse caso rode os comandos da prioridade 3 e depois os da 4 (`branch -d`, nunca `-D`; apagar branch **remota** só com o ok explícito, item a item). Prioridade 1 e 2 são sempre do humano.

Casos que merecem uma frase a mais:
- **Branch à frente da base, sem MR** (ex.: `feature/d0-tema` com 1 commit solto): mostre `git log origin/<base>..<branch> --oneline` e pergunte se é trabalho a entregar (abrir MR) ou lixo (apagar). Nunca decida.
- **Commit local na `main`:** o push direto é bloqueado. Diga para mover o commit a uma branch de feature (`git switch -c feature/...`) antes de qualquer outra coisa.
- **Remota sumida mas há commits não mergeados:** pode ser MR mergeada com squash. Mostre os commits e peça confirmação antes de apagar.

## 3. Ligar ao fluxo

Quando mandar rodar `/fatia <código>` ou `/implement-task <código>`, acrescente o **título da fatia** (coluna "Fatia" do `specs/README.md`, sem links): `/fatia B3` — Sessão BFF: login, callback, refresh, logout e me.

Com `SIM`, diga: "Pronto. Rode `/proximo`." Com pendência de prioridade 1 ou 2, diga qual resolver primeiro e que depois basta rodar `/situacao` de novo.
