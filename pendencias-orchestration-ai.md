# Pendências do orchestration-ai (mudança de modelo: trunk-based + Kubernetes local)

Gerado em 2026-11-12 na sessão `grill-with-docs` que decidiu mudar o modelo da Esteira. **Reescrito em 2026-11-15** para refletir tudo o que foi decidido depois (ADRs 0018 a 0024). **Este arquivo é a entrada para a sessão do orchestration-ai.** Ele lista tudo o que, nos repositórios compartilhados (`ai-base`, `ai-infra`, `ai-ops`, `template-ci`) e na configuração do GitLab, pressupõe o modelo antigo e precisa mudar.

Por regra do `CLAUDE.md` ("Melhoria em repositório compartilhado"), **nada foi editado nesses repositórios** a partir do projeto. Cada bloco abaixo vira issue no repositório certo, executada com `/issue-ai <n>` aberto dentro dele, com o sim do humano.

Fontes das decisões, neste workspace: `docs/adr/0018` a `0024`, `CONTEXT-MAP.md` e `docs/contrato-leitura-esteira.md`. Conceito de origem: `fundamentos-devops` (`0-conteudo/devops-cicd/ci-cd-fundamentos.md`, `estrategias-de-deploy.md`, `seguranca-no-pipeline.md`; `gitlab-pipelines/gitlab-ambientes-e-recursos-extras.md`), repositório público do próprio autor.

> **Atualização 2026-11-15 (ADR-0025).** Esta lista foi revisada depois de uma conversa que fechou nomes e travas novos: estados "Pronta para Entrega" e "Aguardando liberação", Fatia sem flag, Fatia de limpeza `<código>-L`, SHA verde, merge sem squash, reiniciar o pod para aplicar flag, e a Esteira fora do esquema de Entrega. O que mudou para o orchestration-ai está nos pontos marcados "ADR-0025" abaixo e resumido na **seção 12**.

> **Estado da execução (2026-11-16).** Feito, de dentro do orquestração, a pedido do dono: **`ai-base`** (docs, hook, scripts, comandos e agentes; `bash -n`/`node --check` ok), **cópias do workspace da Esteira** (patch aplicado sem rejeição), **`ai-ops`** (docs de Kubernetes, 2 clusters) e **`ai-infra`** (README), e o **`template-ci` v3** (controlador, regras, imagem por modos, deploy com flags, `flag`, `preview`, `limpeza`, ZAP ativo/passivo, MR para `main`, README e docs novos; YAML validado, 27 scripts com `bash -n` e o controlador testado em 16 cenários simulados). **Falta, e não é do orchestration-ai:** criar a tag `v3.0.0` do template (e só então os repositórios trocam o `ref`), implementar o servidor do contrato v2 na `esteira-api`, a configuração do GitLab (seção 5), o roteiro de migração (seção 8), reescrever as specs e protótipos da Esteira (seção 10) e **o primeiro teste ponta a ponta no GitLab real**, que nenhum teste local substitui. O texto das seções 2 a 4 abaixo é o levantamento original: leia-o como "o que mudou", não como pendência aberta.

> **Limite desta análise.** O mapa dos arquivos dos repositórios compartilhados foi feito por busca (grep) e leitura parcial, não por leitura integral. Onde está escrito "não li", confirme antes de agir. O `controlar-pipeline.yml` tem mais de 1000 linhas e só as partes com `rc`/branch foram vistas.

---

## 1. O modelo novo, do código à produção (para quem não leu as ADRs)

**Ramos.** Só `main`, `feature/*` e `hotfix/*`. **Ambiente não é branch.** Não existem `dev`, `qa` nem `hml`. A `main` aceita merge só do bot da Esteira.

**Fase 1, construir.** O agente monta uma Fatia por vez (`/fatia` → spec aprovada pelo humano → tickets automáticos → `/implement-task`), abre uma MR por repositório tocado, para `main`. O humano só aprova a spec e olha a MR.

**Fase 2, revisar.** A pipeline da MR faz build, testes, scans e o agente de revisão. O humano pode abrir o **review leve** (botão na Fatia): para a parte de front, um **preview estático** com sessão falsa e dados falsos tipados pelo contrato; para a parte de API, o diff do contrato e os testes; app real só em Fatia de `risco: alto`. O humano aprova ou reprova **na Esteira**: reprovar posta o comentário com o nome dele, **fecha a MR**, e a mesma MR é **reaberta** depois da correção; aprovar faz a Esteira **mergear** na `main` com o flag da Fatia **desligado**. A pipeline da `main` a cada merge faz **só CI** (build, testes, scans e um health check efêmero da imagem): sem deploy em ambiente e sem Artefato oficial. A Fatia vira **Pronta para Entrega** (ainda não validada em qa nem hml).

**Fase 3, Entrega.** O humano abre uma **Entrega** selecionando N Fatias aprovadas (só API, só front ou `api + frontend`) e declara o tipo da mudança de cada Fluxo (minor por padrão, major por marcação). A Esteira cria **um Fluxo por Projeto** tocado (a Fatia `api + frontend` entra nos dois). O Fluxo nasce **antes** do Artefato: a pipeline do Fluxo gera o **Artefato oficial** (imagem imutável, identificada pelo SHA) sobre o SHA mais recente da `main` do Projeto, faz **um deploy** no `qa` com os flags das Fatias do Fluxo **ligados no qa**, e roda o DAST ativo e o agente de qa. O aprovador técnico aprova o qa; o **mesmo Artefato** vai ao `hml` (flags ligados, DAST passivo) e, aprovado, à produção, que o Publicador confirma. Em produção o deploy sobe com **todos os flags desligados** e roda só a verificação de que subiu (rollout e health). Depois vem a **Liberação**, na tela da Entrega: o aprovador de negócio seleciona as Fatias a liberar, os flags ligam e rodam smoke e ZAP passivo, uma vez, para o conjunto. As Fatias não selecionadas ficam **aguardando liberação** num menu, de onde podem ser liberadas depois (sem smoke nem ZAP, por conta e risco de quem libera) ou excluídas.

**Versão.** `X.Y.Z`, **sem "v"**, a cada publicação em produção. O número só nasce na confirmação em produção, a partir da maior versão já publicada (sem buracos, mesmo depois de rollback); hotfix soma o Z.

**Dependência.** Uma Fatia de front que depende de uma de API (coluna `Depende de` do mapa) não abre Entrega sem a API na `main`, não confirma produção sem a API lá, e **não liga o flag** antes de a API estar liberada. A tela da Entrega tem o botão "liberar os Fluxos" que liga na ordem certa. O Atalho **não** pula essa trava.

**Atalho (ordem superior e hotfix).** O Publicador (ou o MOR) pula `qa` e `hml` registrando o **nome de quem ordenou** e o motivo, que a Esteira posta na MR. Não pula o gate de segurança com achado crítico ou alto, a não ser por **Exceção**, com a opção de **Exceção em lote** (cada achado vira Exceção individual com prazo obrigatório). Faz só o deploy; ligar o flag é um segundo ato.

**Ocupação por Projeto.** `qa` sem fila (o Artefato novo supera o anterior e a Entrega anterior não aprovada fica **Superada**, com as Fatias voltando para "aprovadas"); `hml` e produção, um Fluxo por vez, com fila e botão "substituir" no `hml`. Em rollback, nada novo entra no Projeto.

**Flags.** Nome `Features:<Fatia>` (o código da Fatia é o identificador único). **Só a Esteira liga e desliga**, como Ação do bot que dispara um job do GitLab (rastro lá). O estado pertence ao **Ambiente**, não à imagem. **Flag ausente conta como desligado, no código.** A Fatia que dispensa flag (refatoração, correção, infra, migração expand-only) declara `flag: não` na spec. Uma rotina de fundo detecta flag alterado fora da Esteira (nunca reverte sozinha).

**Merge fora da Esteira.** Não dá para impedir o Owner de mergear; ele é tornado inofensivo (o merge só roda CI e nenhum Artefato nasce sem Entrega) e visível (webhook registra "merge fora da Esteira").

**Papéis.** Abrir Entrega: Membro. Aprovar a MR, o qa e o hml: Aprovador técnico. Confirmar produção e usar o Atalho: Publicador. Liberar e excluir Fatias: Aprovador de negócio. **MOR** pode tudo (autoaprovação marcada, com motivo).

**DAST.** Ativo no `qa`, passivo no `hml` e na produção (depois da Liberação), nenhum no review. O que roda depois do deploy só registra e barra a próxima promoção; em produção vira alerta (desligar o flag, hotfix ou nova Fatia).

**Kubernetes.** Dois clusters k3d: `esteira-nao-prod` (namespaces `qa`, `hml` e, só para Fatia de `risco: alto`, `review-<fatia>`) e `esteira-prd-local` (produção). Produção é um **Destino** (`local` agora, `aws` depois). Motivo declarado: aprender Kubernetes.

**Repositórios da própria Esteira** (`esteira-api`, `esteira-frontend`): **fora do esquema** de Entrega, Fluxo e Painel de Fatias (ADR-0025). Merge e promoção são manuais (job `when: manual`), senão uma Esteira quebrada não publicaria a própria correção.

**Princípio de duas camadas.** Comandos e agentes continuam em markdown, git, issues e o bloco `<!-- execucao -->`. A Esteira só **lê** esses artefatos (contrato de leitura, seção 6) e executa no GitLab as decisões de processo, com o nome do humano no texto.

**Migração:** sem período de convivência dos dois modelos (a Esteira ainda não publica para terceiros).

---

## 2. `template-ci` (`ai-pipeline/template-ci`) — a maior e mais acoplada

Hoje o template constrói a imagem **uma vez, na tag**, e promove por **digest**. O princípio "mesmo artefato em todos os ambientes" já existe; o que muda é o **gatilho** (da tag para o Fluxo) e a **lógica de tag/branch** em volta.

### 2.1 `common/controlar-pipeline.yml` (mais de 1000 linhas; a parte mais acoplada)
- Pressupõe os estágios `dev`/`qa`/`hml`/`main` com `DEV_REAL_BRANCH`, `QA_REAL_BRANCH`, `HOMOLOG_REAL_BRANCH`, `MASTER_REAL_BRANCH`. *Não confirmei se esses nomes têm default ou aliases.*
- Regras de tag a **remover**: `rcN` só com `minor=0` e `patch=0`; `rcN` em sequência e descendente da anterior; a **origem da tag** (dev/qa/hml, por ancestralidade) decide onde o fluxo reinicia; "promotion = merge da tag"; commit direto em `qa`/`hml`/`main` bloqueia; **rollback em cascata** `main→hml→qa→dev`.
- Define `PIPELINE_PROCESS=tag|promotion|hotfix|minor` (o `promotion` perto da linha ~1026). Os modos passam a ser:
  - `mr`: CI da MR (build, testes, scans, agente de revisão) e, sob demanda, o preview.
  - `main`: CI no merge, **sem Artefato oficial e sem deploy** (build, testes, scans e health check efêmero).
  - `fluxo`: gera o Artefato oficial sobre um **SHA escolhido pela Esteira** (o último com pipeline verde, registrado no Fluxo) e faz o deploy no `qa`. **Só roda por trigger do bot** (disparo manual na tela do GitLab não funciona) e o `esteira-abrir` recusa sem Entrega aberta (ADR-0025).
  - `promocao`: play do deploy no `hml` e na produção, depois da aprovação na Esteira.
  - `flag`: altera o estado de um flag num Ambiente (e um modo só de leitura do estado real).
  - `hotfix`, `rollback` (redeploy do SHA anterior só no ambiente afetado) e `rotulo` (aplica `X.Y.Z` na ida a produção).
  - `liberacao`: liga os flags das Fatias escolhidas em produção e roda smoke (**só leitura**) e ZAP passivo, uma vez, para o conjunto. A liberação feita pelo menu "Aguardando liberação" usa o modo `flag` puro, sem smoke nem ZAP (ADR-0023, ADR-0025).
- Hotfix: continua só por humano; usa o mesmo pipeline, com o Atalho registrado na Esteira (`esteira-gate`).

### 2.2 `ci-template.yml` e `common/rules.yml`
- `workflow.rules` hoje roda em tags, em `qa|hml|main`, em `feature/*` (gate de review, se `REVIEW_GATE_ENABLED`) e em `dev` (só `fechar-fatia`, se `FECHAR_FATIA_ENABLED`). Passa a rodar em: MR/`feature/*`, `main`, `hotfix/*` e jobs manuais de promoção e de flag.
- `.rules-controlar-pipeline` roda em `tag` ou `/^(qa|hml|main)$/`; `.rules-fechar-fatia` só em `dev`; `.rules-review` só em `feature/*`; `.rules-build-*` só em tag/hotfix/minor. Tudo isso é reescrito.
- Como o alvo da MR vira a branch padrão, `fechar-fatia` não pode depender de "merge em `dev`", e o `Closes #n` volta a funcionar.

### 2.3 Build e imagem (`image/image.yml`, `build/*.yml`)
- Hoje `image/image.yml` tem modos `build`, `retag` e `resolve`. **Manter a ideia, trocar o gatilho:** o build do **Artefato oficial** acontece no modo `fluxo` (sobre o SHA escolhido), com tag da imagem = SHA; o "retag" vira "rótulo" `X.Y.Z` na ida a produção; `resolve` continua para promoção e rollback. **O merge na `main` não gera imagem oficial.**
- **Build de MR:** artefato **descartável** `<fatia>-<sha7>` só para o review com app real (Fatia de `risco: alto`), com **limpeza** das tags no registry. Para a parte de front de qualquer Fatia, o build de MR em **modo preview** gera um site estático (ver 2.6).
- `build/angular.yml` já afirma que a mesma imagem serve qa/hml/prod com config em runtime (`/config.json`, ADR-0006): **é por aí que os flags do front chegam** (`APP_RUNTIME_CONFIG`).

### 2.4 `deploy/kubernetes.yml`
- Hoje: migrations + kustomize + rollout via GitLab Agent. Precisa de:
  - **Destino por Ambiente** (`local` | `aws`) vindo da Esteira (`esteira-abrir`), sem mudar o pipeline.
  - Deploy nos namespaces `qa` e `hml` do cluster `esteira-nao-prod` e produção no `esteira-prd-local`. **Sem namespace `dev`.** `review-<fatia>` só para o review com app real.
  - Aplicar, junto com o deploy, o **estado dos flags** do Ambiente devolvido pela Esteira no `esteira-abrir` (ConfigMap).
  - **Migrations** só *expand* até a Fatia ser liberada (ADR-0019); `contract` em deploy posterior.

### 2.5 `review/code-review.yml` e `review/fechar-fatia.yml`
- `abrir-mr-dev` e `verify-code-review` rodam em `feature/*` e a MR vai para `dev`: trocar para `main`.
- `fechar-fatia` (fecha a issue-mãe e as filhas ao mergear em `dev`) passa a rodar no merge na `main` e **também quando a MR é fechada pela reprovação**, destruindo o preview e o namespace `review-<fatia>` se existirem.

### 2.6 **Novos jobs**
- **Preview estático por MR (parte de front):** build do front em modo preview (sessão falsa e dados falsos), publicado no Kubernetes (namespace `preview` de `esteira-nao-prod`), num nginx mínimo com endereço por Fatia, sem API nem banco (pergunta 7.10). Disparado pelo botão "Abrir review" da Esteira. **Destruição obrigatória** no merge ou fechamento da MR e prazo máximo (`auto_stop_in`): o GitLab não destrói sozinho, o destroy é script nosso.
- **DAST (OWASP ZAP):** job determinístico, imagem pública fixada por versão e digest (sem `tools/zap`). **Ativo em `qa`** (bloqueia crítica e alta, salvo Exceção), **passivo em `hml`** (mesma regra) e **passivo em produção, depois da Liberação**, quando o resultado só alerta. Nenhum no review. O ZAP roda no runner, fora do cluster, e alcança só a `APP_URL`; a NetworkPolicy não limita o ZAP (correção de 2026-11-20, ADR-0025). O agente `security` lê o relatório e produz o JSON de Análise; **quem bloqueia é a Política de segurança da Esteira** (ADR-0020).
- **Smoke em produção:** só depois da Liberação, junto com o ZAP passivo. Depois do deploy em produção roda apenas a verificação de rollout e health.
- **Rollback por SHA** (redeploy do digest anterior só no ambiente afetado).
- **Rótulo `X.Y.Z`** (sem "v") aplicado ao Artefato na ida a produção (pelo bot da Esteira, tags protegidas).
- **Jobs de flag** (alterar e ler o estado real), disparados pelo bot da Esteira.
- Todos os jobs que falam com a Esteira enviam o campo **`fatia`**, e `esteira-abrir` passa a **anexar o Artefato a uma Entrega já aberta** e **recusar** quando não há Entrega (fail-closed). As pipelines de MR e de `main` só fazem CI e não precisam chamar a Esteira para publicar. Contrato `/api/pipeline/v1` (ADR-0013): ver pergunta 7.6.

### 2.7 Documentação do template
- `docs/fluxo-de-tags.md`: **reescrito em 2026-11-16** como `template-ci/docs/pipeline-trunk-based.md` (o antigo foi removido); `docs/mudancas-template.md` atualizado para o v3.
- `README.md` e `.gitlab-ci.yml` do próprio template (releases por tag `vN.N.N`, build de `tools/*` por tag): conferir o que usa o fluxo antigo. *Não li.*
- O template já lida com a ausência de `qa` ("primeiro estágio existente"). Verificar se o novo modelo mantém essa tolerância.

---

## 3. `ai-base` (fonte das regras do processo; este workspace tem cópias)

### 3.1 Docs e instruções
- **`CLAUDE.md`** (linhas ~63–70): "Convenções de repo", fluxo `feature-x → MR → dev → qa → hml → main`; "MR pra `dev`"; "`dev → qa` é merge direto por tag feito por você"; "as 4 branches são protegidas". Reescrever para `main` única, merge só do bot. Atualizar também o parágrafo `/code-review` ("ponto fixo `origin/dev`").
- **`docs/agents/esteira-deploy.md`** (documento central): passos 1–10, convenção de tag `vX.Y.Z-rcN`, "regra crítica: `qa` nunca acima da tag", `release/vX.Y.Z-rcN`, hotfix, rollback em cascata. **Reescrever inteiro** conforme o capítulo 1 e as ADRs 0018, 0021, 0022 e 0023.
- **`docs/workflow.md`** (linhas ~13–48): `/implement-task` termina em MR para `dev`; "fechar a fatia" quando mergeada em `dev`; tag e promoção depois.
- **`docs/agents/workspace.md`** (linhas ~28, 44, 59): "uma MR por repositório, todas para `dev`"; "sem `Closes` porque o alvo não é a branch padrão" (**passa a haver `Closes`**, exceto nas Fatias `api + frontend`: o `fechar-fatia` fecha as issues só depois da última MR, ADR-0025); "cada repositório tem seu próprio dev→qa→hml→main". Acrescentar que uma Fatia pode ser `api + frontend`, com uma MR em cada repositório.
- **`docs/agents/orchestration.md`** (linhas ~29, 57, 65, 86–109): agente `qa` valida o ambiente `qa`; MR para `dev`; `fetch` antes de conferir `dev`/`main`; gate `verify-code-review`; `fechar-fatia` no push em `dev`.
- **`docs/agents/padrao-api.md` e `padrao-frontend.md`**: **nova seção sobre feature flags** (ADR-0019): critério "comportamento percebido", nome `Features:<Fatia>...`, nasce desligado em produção, **flag ausente = desligado**, vida curta, remoção, migração expand-only. Para o front, usar a config em runtime. *`padrao-frontend.md` casou no grep por dev/qa/hml; não li o contexto.*
- **`docs/agents/spec-format.md`**: campos novos por Fatia, todos **aditivos**: `flag:` (nome `Features:<Fatia>`, padrão "sim"; "não" para refatoração, correção, infra e migração expand-only), `preview:` (módulo e rota de entrada, obrigatório para quem toca o front) e o plano de cancelamento/limpeza (a limpeza é uma Fatia, ADR-0019).
- `README.md`, `docs-human/COMO-CRIAR-UM-PROJETO.md`, `docs-human/glossario-de-comandos.md`: mencionam dev/qa/hml. *Só o grep casou, não li.*
- `docs/agents/melhoria-orquestracao.md`, `security-review.md`, `issue-tracker.md`: conferir menções (`issue-tracker.md` explica por que o `Closes` não é usado).

### 3.2 Hook
- **`.claude/hooks/block-dangerous-git.sh`** (idêntico em `ai-base` e no esteira): `PROTECTED_BRANCHES="main|master|dev|qa|hml"`. A mensagem de bloqueio manda abrir MR para `dev`; o comentário diz "promoção `dev→qa` é do humano". Ajustar a lista (as branches `dev`, `qa`, `hml` somem) e as mensagens. **Manter** o bloqueio de push direto em `main`, `--force`, `reset --hard`, `clean -f`, `branch -D`, `checkout .`/`restore .`.

### 3.3 Scripts (`.claude/scripts/`, com cópias no esteira)
- **`worktree-fatia.mjs`** (linha ~61): cria worktree `feature/<slug>` a partir de `origin/dev` → `origin/main`.
- **`status-specs.mjs`** (linhas ~68, 82–99, 128–133): busca MRs `target_branch=dev` mergeadas; merge commit `into 'dev'` em `origin/dev`; testes em `origin/dev`; uma fatia só conta como feita se mergeada em `dev` → tudo para `main`.
- **`check-spec-drift.mjs`** (linhas ~2, 11, 27): drift = mudança em `origin/dev` de cada repositório de código depois da spec (o workspace usa `origin/main`) → `origin/main` em todos.
- **`situacao.mjs`** (linhas ~44, 66): protegidas = `dev|qa|hml|main|master`; base = `origin/dev` com fallback (*não vi qual*); no workspace e em `ai-*`, base `main`. Passa a ser `main` em todos.
- Conferir `check-tickets.mjs` e qualquer outro script que cite `dev`. *Não li todos.*

### 3.4 Commands, agents e skills
- **`/implement-task`** (`.claude/commands/implement-task.md`): `fetch origin`; `diff origin/dev...<branch>`; MR com `target dev`; saída `dev ← feature/b2-<slug>`. Trocar por `main`. Incluir o passo de **flag** (a Fatia declara e a implementação usa) e o **preview** da parte de front. **Passa a reabrir a MR fechada pela reprovação**, em vez de abrir outra.
- **`/fatia`**: precisa aceitar como ponto de partida a issue **"Limpeza da Fatia <código>"** criada pela Esteira quando o humano exclui uma Fatia (rótulo `ready-for-human`). O `/fatia` **cria a linha `<código>-L` no mapa** (ex.: `B2-L`), sem flag; a Esteira não escreve no mapa (ADR-0025). A spec de limpeza remove o código e o flag da Fatia original, sem mudança de comportamento, com migração só `contract` se houver, e segue o fluxo normal.
- **`/proximo`**: compara `feature/*` com `origin/dev` e roda `check-spec-drift` contra `dev`; "mapa vs. MRs mergeadas em dev".
- **`/situacao`**, `fatia.md`, `mapa.md`: usam os scripts acima; conferir menções diretas. *Não casaram o grep.*
- **Agente `ui`**: cria, como parte da Fatia, a **sessão falsa** (já logado) e os **dados falsos** da tela de preview, tipados pelos tipos gerados do OpenAPI (ADR-0005), de modo que dado fora do contrato quebre o build.
- **Agente `review`**: passa a **checar o flag** (existência quando exigido, **ausente = desligado**, nome `Features:<Fatia>`), a **remoção do flag e do código** numa Fatia de limpeza, e, na parte de API, o diff do contrato.
- **Agente `security`**: passa a **ler o relatório do ZAP** e produzir o JSON de Análise; não decide o bloqueio.
- **Agente `qa`**: "valida o ambiente `qa` publicado". Mantém o estágio, muda o gatilho (deploy do Fluxo, não a cada merge). Precisa saber ler o resultado do **DAST**.
- **Skills** (`git-guardrails-claude-code`, `create-branch`, `commit`): **não li**. Podem citar `dev`/`qa`/`hml`. Conferir.
- **`/issue-ai`** (raiz do orchestration-ai) usa a branch padrão (`origin/HEAD`) e **não** pressupõe o fluxo antigo.

### 3.5 `docs-human` (ai-base e `ai-ops/docs-human/ai-base`)
- `COMO-CRIAR-UM-PROJETO.md`, `glossario-de-comandos.md` e `ai-ops/docs-human/ai-base/{runbook,infra,comandos-para-rodar}.md`: mencionam dev/qa/hml. *Só o grep casou.* Atualizar.

---

## 4. `ai-ops` e `ai-infra` (infraestrutura)

### 4.1 `ai-ops`
- **`docs-human/infra/kubernetes-local.md`** e **`agents/infra/local-environment-config/docs/infra/kubernetes-local.md`**: hoje criam **2 clusters por ambiente** (`valuto-qa-local` e `valuto-hml-local`, "Opção 3") com k3d, cert-manager (Issuer self-signed), Traefik (já vem no k3s) e 4 operators (CloudNativePG, Redis Operator da OT-ContainerKit, RabbitMQ Cluster Operator, Keycloak Operator). **Mudar para os 2 clusters da ADR-0020**: `esteira-nao-prod` (namespaces `qa` e `hml`, mais `review-*` só para Fatias de `risco: alto`; **sem `dev`**) e `esteira-prd-local`. Os operators e o cert-manager precisam existir em ambos. O doc já avisa que URLs/versões dos operators são de memória e devem ser conferidas.
- **Novo:** **NetworkPolicy** isolando `qa`, `hml`, `preview` e `review-*` entre si (entrada só do próprio namespace e do Traefik). **Feito em 2026-11-20:** manifesto em `ai-ops/agents/infra/local-environment-config/docs/infra/manifests/networkpolicy-isolamento.yaml`, **não testado em cluster**. Não há política para o ZAP: ele roda no runner, fora do cluster.
- **Novo:** **GitLab Agent** nos dois clusters (o `kubernetes-local.md` já cita o agent; ver pergunta 7.5).
- **Novo:** rotina de criação e destruição de `review-<fatia>`, usada pelo `template-ci` só no review com app real.
- **Novo:** namespace `preview` em `esteira-nao-prod`, com NetworkPolicy própria, para o nginx do preview estático por MR, e o job diário que apaga os vencidos (pergunta 7.10).
- `docs-human/ai-base/{runbook,infra,comandos-para-rodar}.md` e `infra.md` (desenho EC2 + Let's Encrypt para a nuvem): continuam válidos como estágio posterior (Destino `aws`); conferir que não afirmam "um cluster por ambiente" como regra.
- `smoke-test`, `combos.md`: apareceram no grep, **provavelmente falsos positivos**. Não confirmei.

### 4.2 `ai-infra` (infra compartilhada)
- Hoje entrega Postgres, Redis, RabbitMQ, Keycloak e observabilidade numa "casa" isolada por projeto, em dev local. Com `qa`, `hml` e produção em Kubernetes (ADR-0020), **definir quem fornece esses serviços dentro do cluster**: os operators (como no `kubernetes-local.md`) ou a `ai-infra` fora do cluster. O contrato de chaves (`ConnectionStrings:Postgres`, `RabbitMQ:*`, `Keycloak:*`, `Redis:KeyPrefix`) **não muda** (CLAUDE.md, seção Infra).
- Para o review com app real: banco/vhost/prefixo Redis **por fatia**, ou serviços compartilhados com separação lógica. Pergunta 7.3.
- Isso é pedido para o agent `ai-ops/agents/infra/local-environment-config`, não código do projeto.

---

## 5. Configuração do GitLab (grupo e projetos)

- **Bot da Esteira:** escopo para comentar, fechar, reabrir e **mergear** MR, disparar jobs (play), criar o rótulo `X.Y.Z` e criar issues (pedido de limpeza). Um bot por grupo (ADR-0008). O autor técnico no GitLab é sempre o bot; o humano aparece no texto.
- **`main` de cada repositório de código:** protegida, com **merge permitido só ao bot** (nos repositórios da própria Esteira, o merge continua manual).
- **Método de merge (ADR-0025):** **merge commit, sem squash**, com "pipeline must succeed" e "todas as threads resolvidas" ativos. O contrato lê um commit por task e o `status-specs.mjs` procura o merge commit; squash apagaria esse rastro.
- **Tags de versão:** protegidas, criadas só pelo bot.
- **Webhooks para a `esteira-api`:** pipeline (status ao vivo), MR (merge e fechamento, inclusive para registrar "merge fora da Esteira") e push/alteração de flag, se o cluster informar.
- **Preview:** o bot e o GitLab Agent precisam de permissão para criar e apagar objetos no namespace `preview`. GitLab Pages não é necessário.

---

## 6. Contrato de leitura da Esteira (o que o `ai-base` precisa respeitar)

**`docs/contrato-leitura-esteira.md`** (v1, rascunho para aprovação). Os comandos e agentes continuam como estão; a Esteira lê o que eles produzem. O que isso pede do `ai-base`:

1. Cada comando que **escreve** um formato do contrato aponta para ele: `/implement-task` (bloco de execução, commit de task), `/fatia` e `/to-tickets` (título da mãe e das filhas, `Blocked by:`, `Cobre:`, mapa), `check-spec-drift --stamp` (linha `base:`). Regra: mudou formato, muda o contrato **e** as fixtures na mesma MR; quando o formato mora no `ai-base`, a mudança vira issue lá e a MR do contrato e das fixtures, na Esteira, fica ligada a ela.
2. `docs/agents/orchestration.md` ("Nomes", "Marca da fatia nos testes"), `docs/agents/spec-format.md` e `docs/agents/issue-tracker.md` passam a citar o contrato como a lista do que não pode mudar sem versão.
3. **Formatos novos, todos aditivos** (a acrescentar ao contrato quando forem escritos): `flag:` e `preview:` na spec; a issue de pedido **"Limpeza da Fatia <código>"**; a coluna `Repositório` do mapa com o valor `api + frontend`; o código `<código>-L` da Fatia de limpeza, com linha criada pelo `/fatia` (ADR-0025).
4. Confirmar, com `/fatia` e `/proximo`, **quais valores a coluna `Status` do mapa pode ter** (só `feito` e `—` apareceram).
5. Avaliar (sem urgência) o campo opcional `**Contrato:** v1` no cabeçalho do bloco de execução; é aditivo.
6. **Não tirar** o bloco de execução nem a coluna `Status` do mapa: a Esteira depende deles. Se alguém quiser removê-los um dia, isso vira v2 do contrato.

---

## 7. Decisões técnicas para a sessão do orchestration-ai

**Todas decididas em 2026-11-15.** Nada nesta seção é pergunta: cada item traz a decisão e, quando há, o que é *verificado ao construir* (isso é teste, não decisão em aberto).

1. **Alterar flag em produção.** **Decidido:** reiniciar o pod (rollout restart), sem build; o job espera o rollout terminar e isso é o sinal de "aplicado". No front vale o mesmo, com o `/config.json` em runtime.
2. **Retenção do registry. Decidido:** Artefato oficial: as **últimas 5 versões publicadas por Projeto**, mais o que estiver rodando em qualquer Ambiente. Descartáveis `<fatia>-<sha7>`: removidas pelo `fechar-fatia` e, como rede de segurança, por um job agendado diário que apaga as com mais de 7 dias.
3. **Dependências do review com app real** (Postgres/Redis/RabbitMQ/Keycloak), usado só em Fatia de `risco: alto`: **Decidido:** conjunto compartilhado com isolamento lógico (banco, vhost e prefixo Redis por Fatia; realm Keycloak compartilhado).
4. **Imagem do ZAP. Decidido:** imagem pública fixada por versão e digest, sem `tools/zap` no template.
5. **Runner alcançando o k3d local. Decidido:** o runner roda na própria máquina dos clusters (executor Docker) e o deploy passa pelo GitLab Agent, que é conexão de saída do cluster para o GitLab; nada da máquina é exposto. *Verificado no teste ponta a ponta da migração (seção 8, passo 9).*
6. **Contrato `/api/pipeline`:** o campo `fatia`, a troca de "candidata" por "artefato", o `esteira-abrir` que anexa a uma Entrega já aberta e os modos novos mudam a semântica do contrato. **Decidido:** `/api/pipeline` **v2** (a ADR-0013 aceita v1 e v2 ao mesmo tempo, para os repositórios ainda não migrados).
7. **Memória da máquina. Decidido:** no máximo **2 namespaces `review-*` simultâneos** (só Fatia de `risco: alto`); o limite é configuração. *A memória real é medida no teste ponta a ponta (seção 8, passo 9) e o limite se ajusta ali.*
8. **Como a Esteira lê o estado real dos flags. Decidido:** job do GitLab só de leitura (modo `flag` de leitura), disparado pelo bot. Comportamento: roda a cada poucos minutos e depois de cada deploy; divergência comum vira aviso no Painel, a grave (ligado em produção sem Entrega e Liberação) ganha destaque e alerta; nunca reverte sozinha, oferece **restaurar** ou **aceitar** (nome e motivo).
9. ~~Botão de aprovar nos repositórios da própria Esteira.~~ **Eliminada (ADR-0025):** esses repositórios ficam fora do esquema, com merge e promoção manuais.
10. **Preview estático. Decidido:** roda no **Kubernetes**, no cluster `esteira-nao-prod`, namespace `preview`. Cada MR com o botão "Abrir review" ganha um **nginx mínimo** (Deployment + Service + Ingress) servindo o front compilado em modo preview, com endereço próprio por Fatia; sem API nem banco. Prazo máximo de **7 dias** (rótulo de validade no objeto); destruído no merge ou fechamento pelo `fechar-fatia`, e um job agendado diário apaga os vencidos. Limite padrão de **5 previews simultâneos** (configuração; cada um é um nginx pequeno). Dados falsos podem divergir da API real; isso é aceito, porque os tipos gerados do OpenAPI quebram o build quando o formato muda (o conteúdo, não). GitLab Pages não é usado.

---

## 8. Roteiro de migração dos repositórios (ação **humana**, sem convivência)

Só depois de o `template-ci` novo existir (seção 2) e do `ai-base` atualizado (seção 3). O hook bloqueia o agente nesses passos de propósito. Para cada repositório de código (`esteira-api`, `esteira-frontend` e demais):

1. Garantir que **nada está pendente**: rodar `/situacao` (sem alterações soltas, sem branches não mergeadas).
2. Fechar ou retargetar as MRs abertas para `main`.
3. Mergear `dev` na `main` (o conteúdo de `dev` ainda não promovido entra de uma vez). Conferir que `qa` e `hml` não têm commit acima de `dev` que não esteja na `main`; se tiver, trazer.
4. Tornar `main` a branch padrão (se já não for), protegida, com merge só do bot (menos nos repositórios da própria Esteira).
5. Apagar as branches `dev`, `qa` e `hml` (e as regras de proteção delas) no GitLab e localmente.
6. Rebasear ou recriar as `feature/*` abertas sobre a `main`.
7. **Tags históricas** `vX.Y.Z-rcN` e `vX.Y.Z`: manter como histórico. O pipeline novo as ignora (nenhuma promove mais nada). A numeração nova `X.Y.Z` (sem "v") parte da maior versão já publicada.
8. Ajustar variáveis de CI (`DEV_REAL_BRANCH`, `QA_REAL_BRANCH`, `HOMOLOG_REAL_BRANCH`, `MASTER_REAL_BRANCH`) removendo as que não existem mais.
9. Rodar um teste ponta a ponta e confirmar: o merge na `main` roda **só CI** e não gera Artefato; abrir uma Entrega gera o Artefato por SHA e faz o deploy no `qa` (não há `dev`); `hml` e produção esperam a aprovação na Esteira; produção sobe com o flag desligado.

---

## 9. Ordem sugerida

1. `ai-ops`/`ai-infra`: 2 clusters, operators, NetworkPolicy, GitLab Agent (sem isso nada do `template-ci` novo testa).
2. `template-ci`: modo `main` (CI) e modo `fluxo` (Artefato e deploy no `qa`) primeiro; depois promoção, flag e rótulo; depois preview por MR e `fechar-fatia`; por último DAST e rollback. Quebrar em issues pequenas.
3. `ai-base`: docs, hook, scripts, commands e agentes, mais os campos `flag:` e `preview:` e o `/fatia` de limpeza (podem andar junto com o item 2).
4. Configuração do GitLab (seção 5), antes da primeira publicação pela Esteira.
5. Migração dos repositórios (seção 8).
6. Esteira: reescrever as specs `E*` e os protótipos; só então mexer no código.

---

## 10. O que é da própria Esteira (não passa pelo orchestration)

Itens que a sessão do projeto trata ou que viram specs:
- **Feito neste workspace (2026-11-12 a 15):** ADRs 0018 a 0024, atualização das ADRs 0001, 0004, 0006 a 0013, 0016 e 0019 a 0021 (notas de status e, na 0010, a lista de Ações), `CONTEXT-MAP.md` e `docs/contrato-leitura-esteira.md`.
- `docs/mudancas-template.md` (§4.0: "dev e qa são andares distintos, hml tem qa como predecessor, promoção virando MR aberta e mergeada pelo bot, agentes de code-review/security/qa no CI por candidata nova"): reescrever; parte já é entregue pelas seções 2 a 5.
- `CLAUDE.md` e `docs/agents/*` do workspace: cópias dos de `ai-base`; sincronizar quando o `ai-base` mudar.
- Specs `E*` do mapa (`specs/README.md`): rever com `/mapa`, agora com Entrega, Fluxo por Projeto, Painel de Fatias e Liberação por Fatia.
- **Protótipos** em `docs/design/prototipos/` (`prototipo-abrir-entrega`, `prototipo-entrega`, `prototipo-entregas`, `prototipo-aguardando`, `prototipo-auditoria`): citam dev/qa/hml/candidata e issues. Refazer com Fatias no lugar de issues, sem as etapas DEV e proposta, com a Liberação por Fatia e o **Painel de Fatias** novo (ADR-0024), partindo do que já foi aprovado visualmente.
- Código `esteira-api` (agregados `FluxoDeploy` e `Deploy`, noção de Candidata e ocupação) e `esteira-frontend`: **só depois** de as specs serem reescritas.
- **Adiado:** mostrar "o que a IA está codando agora" (exigiria o Claude Code enviar eventos à Esteira; hoje o único rastro é o bloco de execução).

---

## 11. Riscos já conhecidos

- **Flag desligado não é rede de segurança contra bug na `main`.** Hotfix e rollback por SHA assumem que a `main` inteira é implantável. Como o qa só sobe quando há Entrega, uma `main` quebrada pode passar despercebida até lá; o **health check efêmero** da pipeline da `main` cobre parte disso.
- **O rollback não desfaz o banco.** Por isso a regra expand/contract (ADR-0019) é pré-requisito, não opcional.
- **O Owner pode burlar a Esteira** (alterar a proteção da `main`, mexer no cluster). A resposta é registro e alerta, não bloqueio: "merge fora da Esteira" e "flag alterado fora da Esteira".
- **Review sem a evidência de que alguém olhou:** a Esteira registra a Análise, o preview e a aprovação, mas não "o humano abriu e olhou".
- **Custo assumido de aprendizado** (ADR-0020): cluster, operators, cert-manager e Agent. Se pesar, o plano B barato é rodar localmente a imagem do app real, e aprovar sem namespace.
- **Convivência zero:** se o `template-ci` novo atrasar, os repositórios ficam parados no modelo antigo; não há ponte.
- **Dados falsos do preview podem divergir da API real** (pergunta 7.10).
- **Hotfix leva código de Fatias Prontas para Entrega nunca validadas em qa**, sempre com o flag desligado. Risco aceito (ADR-0025).
- **Dependência `Depende de` e o SHA:** a Esteira confere, ao abrir a Entrega, que a Fatia de API de que a de front depende já está na `main` (ADR-0023).
- **Rollback não volta o banco, e uma migração `contract` invalida o rollback** para qualquer SHA anterior a ela (ADR-0025).

---

## 12. Acréscimos da ADR-0025 por repositório (resumo para as issues)

**`template-ci`**
- Modo `fluxo` só por trigger do bot; `esteira-abrir` recusa sem Entrega aberta para o Projeto e o SHA.
- O Fluxo constrói sobre o **SHA registrado** (último com pipeline verde), com lockfiles e imagem base por digest. Para fixar o SHA, o bot cria uma **ref temporária** (tag `fluxo/<id da Entrega>` apontando para o SHA), dispara o pipeline nela e a apaga ao fim do Fluxo.
- `resource_group` por Ambiente (nunca dois deploys simultâneos); Artefato novo no qa **cancela o teste em andamento** (ex.: DAST ativo) e marca o Fluxo antigo como Superado.
- Modo `liberacao` (flag + smoke só leitura + ZAP passivo); modo `flag` puro para a liberação pelo menu.
- Aplicar flag = **rollout restart** do pod, com o job esperando o rollout terminar. A Esteira, e não o cluster, é a fonte da verdade do estado do flag. Job de leitura do estado real só para detectar divergência.
- Ao superar uma Entrega no qa, a Esteira dispara o desligamento dos flags dela no qa.
- Aviso ou bloqueio de rollback quando o deploy atual rodou migração `contract`.
- `fechar-fatia`: em Fatia `api + frontend`, fechar issues só depois da última MR.
- A versão nova do `template-ci` sai como **major nova**, para os repositórios ainda não migrados continuarem fixados na anterior; a migração de cada repositório (seção 8) inclui trocar a referência do template para a major nova.

**`ai-base`**
- `/fatia` aceita a issue "Limpeza da Fatia <código>" e **cria a linha `<código>-L` no mapa** (sem flag).
- Hook, scripts e `status-specs.mjs`: procurar o **merge commit** em `origin/main` (sem squash).
- Spec: `flag: não` é a marca da Fatia sem flag, que a Esteira trava na seleção.

**GitLab (seção 5)**
- Merge commit sem squash; "pipeline must succeed"; "threads resolvidas".

**Esteira (próprio projeto, fora do orchestration-ai)**
- Estados e abas com os nomes novos; aba "Limpeza pendente"; lembrete de dívida (30 dias, configurável por Aplicação, comentário semanal do bot na issue de limpeza).
- Bloqueio de abertura de Entrega do Projeto quando há Fatia sem flag excluída com limpeza não mergeada (hotfix liberado) e quando a `main` está vermelha.
- Fatia sem flag pré-selecionada e travada na Abertura; vira Liberada ao chegar a produção.
- Rollback devolve as Fatias da versão revertida a "Aguardando liberação" ou "Pronta para Entrega", com flag desligado.
- `esteira-api` e `esteira-frontend` fora do esquema (merge e promoção manuais).

## 13. Conferência de 2026-11-20 (depois de o orchestration-ai aplicar as seções 2 a 5)

O humano executou as pendências; este bloco registra o que a conferência achou e o que foi corrigido. As alterações abaixo foram feitas **com autorização expressa do humano, só naquela sessão**, e ficaram **sem commit** nos repositórios compartilhados.

**Conferido e correto:** `ai-base` sem resíduo de `dev`/`rcN`/`candidata` (hook, scripts, comandos, agentes, docs, `docs-human`); cópias do workspace idênticas às do `ai-base`; `template-ci` v3 com os modos `fluxo`, `promocao`, `liberacao`, `flag`, `rollback`, `rotulo`, `preview`, `limpeza`, disparo manual recusado, `CI_COMMIT_SHA` conferido, `resource_group`, `rollout restart`, preview de 7 dias e no máximo 5, MR fechada reaberta e contrato v2; `ai-ops` com os dois clusters e sem `dev`.

**Corrigido nesta conferência (sem commit):**
- `template-ci/review/fechar-fatia.yml` e `common/controlar-pipeline.yml`: aceitam o código `-L` (`B2-L`, `feature/b2-l-…`, `preview` de `b2-l`). O **título** da MR manda sobre o nome da branch, senão `feature/b2-l-…` seria lida como `B2` e a issue de limpeza nunca fecharia.
- `ai-base/.claude/scripts/status-specs.mjs` (e a cópia do workspace): a MR e a branch de `B2-L` deixam de contar como da `B2`. Testado com 8 casos (`B2`, `B2-L`, `F0.5`, título sem código).
- `template-ci`: `ZAP_IMAGE` e `NGINX_IMAGE` agora por **versão e digest** (índices multi-arquitetura obtidos em 2026-11-20, não inventados). Comentários do `zap.yml` e do README corrigidos: o ZAP roda no runner, fora do cluster.
- `ai-ops`: criado o manifesto `networkpolicy-isolamento.yaml` que os docs diziam existir; os dois docs de Kubernetes foram corrigidos (sem "política do ZAP").

**Continua pendente (humano):**
1. **Commit e MR** dessas alterações em `ai-base`, `ai-ops` e `template-ci`; e o **1 commit local na `main`** do workspace (o hook bloqueia push direto: vai por branch de feature e MR).
2. **Testar a NetworkPolicy no cluster:** o k3s precisa ter o controlador de NetworkPolicy ligado e o Traefik em `kube-system`. Sem isso a política não é aplicada, ou bloqueia o Ingress.
3. **Outras imagens por digest:** só `ZAP_IMAGE` e `NGINX_IMAGE` foram fixadas; as demais (trivy, node, runtime .NET, runner) continuam por tag e não foram conferidas.
4. **`flags.yml` e `kubernetes.yml`** mantêm o regex de código sem `-L` **de propósito** (a limpeza é sempre `flag: não`). Se um dia uma Fatia de limpeza tiver flag, mudar junto.
5. **Código com ponto** (`F0.5`) não é aceito pelo preview nem pelo `fechar-fatia` (e ponto não vale em nome de recurso do Kubernetes). Hoje só afeta os repositórios da própria Esteira (fora do esquema); em projeto novo, evitar ponto no código da Fatia.
6. **Configuração do GitLab (seção 5):** escopo do bot, `main` só para o bot, merge sem squash, webhooks. **Não foi verificada**: não há como ver pelos arquivos.
7. **Migração dos repositórios (seção 8):** `esteira-api` e `esteira-frontend` ainda estão na branch `dev`.
8. **Teste ponta a ponta nunca rodado** (seção 8, passo 9). Nada do `template-ci` v3 foi executado: a conferência foi por leitura.

## 14. Documentação do `ai-base` a atualizar (levantado em 2026-11-20, depois do `/mapa`) — **feito em 2026-11-20 no `ai-base`: itens 1 a 9 aplicados (a conferir no diff)**

Itens para o `/issue-ai` no `ai-base` (`docs-human/COMO-CRIAR-UM-PROJETO.md`, `docs-human/glossario-de-comandos.md`) e, no workspace, para o `CONTEXT-MAP.md`. A migração de `esteira-api` e `esteira-frontend` para a `main` (item 7 acima) **foi feita pelo humano**; o `.gitlab-ci.yml` deles ficou para depois.

**`COMO-CRIAR-UM-PROJETO.md`:**
1. **Tabela "Estado da Esteira"** (fim do arquivo) está velha: diz "B3 em andamento", "fatias feitas B2, B1", ADRs 0001–0017 e próximas "F0.5 → A1 → E1 … E5". Trocar por ADRs 0001–0025 e pelo mapa novo (A1 → D1 → P1 → P2 → E1 …); a última linha já manda usar `/proximo`.
2. **Merge manual enquanto a Esteira não existe.** O B5 diz "aprove na Esteira (ela mergeia)", mas isso só vale depois da fatia P2 e **nunca vale** para `esteira-api`/`esteira-frontend` nem para projeto novo antes de ter a Esteira. Acrescentar: "sem a Esteira, mergear no GitLab (modo `ESTEIRA_FALLBACK=true`)".
3. **Configurar o GitLab de um projeto novo** (A2 ou seção nova): `main` como padrão e protegida (merge só do bot, quando houver Esteira; antes, só Maintainer), **merge commit sem squash**, "pipeline must succeed" e "todas as threads resolvidas", bot por grupo com escopo `api`, `ref: v3.0.0` do template (a tag ainda precisa ser criada). Hoje o guia não diz isso.
4. **B5/B6: o Painel de Fatias** (abas Em andamento, Prontas para Entrega, Em Entrega, Aguardando liberação, Liberadas), o botão **Abrir review** (preview leve; app real só em `risco: alto`) e a Liberação por flag `Features:<Fatia>`. Hoje o B6 resume a Entrega em um parágrafo.
5. **Nomes:** acrescentar a Fatia de limpeza `B3-L` (mãe `B3-L — …`, tickets `B3-L.1`, branch `feature/b3-l-…`, o **título** da MR decide a Fatia) e a linha `flag: sim|não` na spec.
6. **Colisão de nomes:** os passos do design se chamam D1, D2, D3 no guia e agora existe a **fatia D1** no mapa da Esteira. Renomear os passos do guia (ex.: "Passo 1, 2, 3") ou escolher outro código para a fatia.
7. **A3 e "Conferir o mapa":** dizer que o `/mapa` deve ser rodado de novo **quando o modelo de processo mudar** (foi o que revelou E1 a E5 no modelo antigo).

**`glossario-de-comandos.md`:**
8. Seção 8 (CI): citar os processos novos do `template-ci` v3 (`fluxo`, `promocao`, `liberacao`, `flag`, `rollback`, `rotulo`, `preview`, `preview-destroy`, `limpeza`; só por trigger do bot) e que `fechar-fatia` aceita `-L`.
9. Seção 7: `status-specs.mjs` agora trata `B2-L` como Fatia à parte.

**`CONTEXT-MAP.md` do workspace (glossário de termos):** os verbetes **Painel de Fatias**, **Review da Fatia**, **Feature flag**, **Fatia de limpeza (`-L`)** e **Em fila / Superado** foram **acrescentados em 2026-11-20**. A "Conferência de escopo" continua marcada "a rever" e depende do D1.
