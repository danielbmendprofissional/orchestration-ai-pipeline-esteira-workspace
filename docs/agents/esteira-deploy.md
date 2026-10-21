# Esteira de deploy: dev → qa → hml → main

**Nunca alterar `.gitlab-ci.yml`.**

A esteira é **por repositório de código** (`<projeto>-api`, `<projeto>-frontend`), cada um com suas branches, tags e promoções; o workspace não tem esteira. Rodada que tocou os dois gera tag nos dois — a da API promove antes (ou junto) da do frontend que depende dela. Ver `docs/agents/workspace.md`.

## Convenção de tag

`vX.Y.Z-rcN`, sequencial. `rc` incrementa a cada correção dentro do mesmo ciclo de candidata.

1. `X` — só pra feature grande no sistema, avaliar se altera.
2. `Y` — alteração dentro de uma feature existente; se `X` não mudar, é ela quem muda.
3. `Z` — só hotfix em `main`, mantém sempre 0 fora desse caso.

## Fluxo normal

1. Cada agente-pai termina sua spec e sobe pra `dev` (MR normal, ver `docs/workflow.md`).
2. Quando todas as specs da rodada estiverem em `dev`, o último agente-pai a terminar cria a tag (`vX.Y.Z-rc1`, ou o próximo `rcN` do ciclo).
3. Promoção `dev → qa` é merge direto, sem Merge Request:
   ```
   git checkout qa
   git pull
   git merge vX.Y.Z-rcN
   git push origin qa
   ```
4. O agente de QA testa o ambiente `qa` publicado.
5. Se achar bug: volta pra `dev`. O agente-pai dono da spec com o bug corrige em `dev`, cria a próxima tag `vX.Y.Z-rc(N+1)` (mesmo `X.Y.Z`, só incrementa `rc`), repete o passo 3.
6. **Regra crítica:** a branch `qa` nunca pode ter commit acima do commit da tag — exceto commit estrutural de merge conflict resolvido pelo próprio git. Qualquer outro commit acima quebra a pipeline.
7. Quando QA passar, abrir Merge Request `qa → hml`. Esperar aprovação humana (pode aprovar ou mandar de volta pra `dev`). Funciona porque a tag está na ponta do `qa` (regra do passo 6). Se o `qa` tiver andado além da tag, usar `release/vX.Y.Z-rcN` criada a partir da tag como origem da MR.
8. Depois do `hml` publicado (deploy feito), esperar segunda aprovação humana antes de seguir.
9. Após essa aprovação, abrir Merge Request `hml → main` (mesma condição: tag na ponta do `hml`). O merge **não publica nada**.
10. Dali em diante é humano: corta a tag final `vX.Y.Z` em `main` e libera o deploy manual de produção (mesma imagem da candidata, sem rebuild). Regras completas em `template-ci/docs/fluxo-de-tags.md`.

## Hotfix

Só acontece por solicitação direta de um humano — o agente nunca inicia um hotfix por conta própria.

1. Agente faz `git checkout -b hotfix/xxxx` a partir de `main` (produção).
2. Implementa a demanda pedida.
3. Abre Merge Request e espera aprovação humana.
4. Aprovado: fim do trabalho do agente ali — humano publica.
5. Reprovado: agente corrige o que o humano apontou e atualiza o mesmo MR.

## Rollback em cascata

Só o humano executa, nunca o agente.

1. Deploy novo em produção apontando pra última tag publicada sem erro.
2. Propagar essa mesma tag em cascata, nessa ordem: `main → hml → qa → dev`.