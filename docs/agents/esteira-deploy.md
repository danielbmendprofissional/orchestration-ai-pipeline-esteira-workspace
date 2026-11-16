# Esteira de deploy: trunk-based, Artefato por SHA, Entrega e Liberação

**Nunca alterar `.gitlab-ci.yml`.**

Modelo decidido nas ADRs 0018 a 0025 da Esteira (`orquestracao-ai/ai-pipeline/esteira/docs/adr/`). Substitui o fluxo antigo `dev → qa → hml → main` com tags `vX.Y.Z-rcN`, que **não existe mais**: não há branch `dev`, `qa` nem `hml`, nem `rcN`, nem "promoção por merge de tag".

A esteira é **por repositório de código** (`<projeto>-api`, `<projeto>-frontend`); o workspace não tem esteira. Ver `docs/agents/workspace.md`.

## Princípios

- **Ambiente não é branch.** Só existem `main`, `feature/*` e `hotfix/*`.
- **A `main` só aceita merge do bot da Esteira.** O agente nunca mergeia, nunca promove, nunca corta tag.
- **Artefato único.** A imagem oficial nasce uma vez, na pipeline de um Fluxo (não no merge), é identificada pelo SHA e é imutável. O mesmo Artefato (por digest) percorre qa, hml e produção.
- **Deploy não é Liberação.** O código chega a produção com o flag da feature desligado; ligar o flag é outro ato, humano, na Esteira.
- **Quem decide e registra é a Esteira.** O GitLab reflete (comentário na MR, fechar, reabrir, mergear, rótulo de versão), sempre com o nome do humano no texto.

## Do código à produção

1. **Construir (agente).** `/fatia` → spec aprovada pelo humano → tickets → `/implement-task`: uma MR por repositório tocado, de `feature/<fatia>-<slug>` para `main`. O agente nunca abre Entrega.
2. **Revisar (humano, na Esteira).** A pipeline da MR faz build, testes, scans e o agente de revisão. O humano pode abrir o **review leve**: para o front, um preview estático com sessão e dados falsos tipados pelo contrato; para a API, o diff do contrato e os testes; app real só em Fatia de `risco: alto`.
   - **Reprovar:** o comentário do humano é postado na MR com o nome dele e a MR é **fechada**. Depois da correção a **mesma MR é reaberta** (o `/implement-task` reabre, não abre outra). A branch nunca é apagada ao fechar.
   - **Aprovar:** a Esteira mergeia na `main` (merge commit, **sem squash**) com o flag da Fatia desligado. A Fatia vira **Pronta para Entrega**. A pipeline da `main` faz **só CI** (build, testes, scans e health check efêmero), sem deploy e sem Artefato oficial.
3. **Entrega (humano, na Esteira).** Um humano abre uma Entrega selecionando N Fatias Prontas para Entrega e declara o tipo da mudança (minor por padrão, major por marcação). A Esteira cria **um Fluxo por Projeto** tocado. A pipeline do Fluxo gera o Artefato sobre o último SHA da `main` com pipeline verde, faz **um deploy no `qa`** com os flags das Fatias do Fluxo ligados no `qa`, e roda o DAST ativo e o agente de qa. Aprovado o qa, o **mesmo Artefato** vai ao `hml` (flags ligados, DAST passivo) e, aprovado, à produção, que o Publicador confirma.
4. **Produção.** O deploy sobe com **todos os flags desligados** e roda só a verificação de que subiu (rollout e health).
5. **Liberação (humano, na Esteira).** O aprovador de negócio seleciona as Fatias a liberar; os flags ligam e rodam smoke (só leitura) e ZAP passivo, uma vez, para o conjunto. As não selecionadas ficam **Aguardando liberação** e podem ser liberadas ou excluídas depois.

Fatia **sem flag** (`flag: não`, ex.: correção, refatoração, infra): é selecionada e travada na Abertura, passa por qa e hml e vira Liberada ao chegar em produção. Fatia `api + frontend` só fica pronta com as duas MRs na `main`, a da API primeiro.

## Versão

`X.Y.Z`, **sem "v"**, a cada publicação em produção. O número só nasce na confirmação em produção, a partir da maior versão já publicada (sem buracos, mesmo depois de rollback). Minor soma 1 no Y e zera o Z; major soma 1 no X e zera Y e Z; hotfix soma 1 no Z.

## Dependência entre API e front

Uma Fatia de front que depende de uma de API (coluna `Depende de` do mapa) não abre Entrega sem a API na `main`, não confirma produção sem a API lá e **não liga o flag** antes de a API estar liberada. O Atalho não pula essa trava.

## Hotfix

Só por solicitação direta de um humano; o agente nunca inicia um hotfix por conta própria.

1. `git checkout -b hotfix/xxxx` a partir da `main`.
2. Implementa a demanda pedida.
3. Abre MR para a `main` e espera a aprovação humana (mesmo pipeline, mesmo gate de revisão).
4. A Esteira abre uma Entrega de tipo hotfix, de um Projeto só. O Publicador usa o **Atalho** (pula qa e hml), registrando o **nome de quem ordenou** e o motivo. O Atalho não pula o gate de segurança com achado crítico ou alto, a não ser por Exceção. Faz só o deploy; ligar o flag é um segundo ato.

## Rollback

Só o humano executa, nunca o agente. Redeploy do **SHA anterior**, por digest (já no registry), **só no ambiente afetado**: não há cascata. Enquanto o Projeto está em rollback nada novo entra nele, exceto o hotfix que corrige. O banco não volta: por isso toda migração incompatível segue **expand/contract**, e a Esteira avisa ou bloqueia o rollback se o deploy atual rodou um `contract`. A correção na `main` vem depois, por MR (fix-forward ou `git revert`).

## Feature flags

Regras para quem escreve código em `docs/agents/padrao-api.md` e `docs/agents/padrao-frontend.md` (seção "Feature flags"). Resumo: nome `Features:<Fatia>`, nasce desligado, **flag ausente conta como desligado**, vida curta, só a Esteira liga e desliga.

## Merge fora da Esteira

Não dá para impedir o Owner do projeto de mergear na `main`, então isso é tornado inofensivo (o merge só roda CI e nenhum Artefato nasce sem Entrega) e visível (a Esteira registra "merge fora da Esteira"). Os repositórios da própria Esteira (`esteira-api`, `esteira-frontend`) ficam **fora** desse esquema: merge e promoção manuais no GitLab.

## Excluir uma Fatia

É decisão do aprovador de negócio, na Esteira, com motivo. A Esteira cria a issue "Limpeza da Fatia <código>" (rótulo `ready-for-human`); o humano roda `/fatia` nela e a limpeza é uma Fatia comum, de código `<código>-L`. Regras completas em `docs/agents/spec-format.md`.
