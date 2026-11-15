# Pendências do orchestration-ai (mudança de modelo: trunk-based + Kubernetes local)

Gerado em 2026-11-12, na sessão `grill-with-docs` que decidiu mudar o modelo da Esteira. **Este arquivo é a entrada para a sessão do orchestration-ai.** Ele lista tudo o que, nos repositórios compartilhados (`ai-base`, `ai-infra`, `ai-ops`, `template-ci`), pressupõe o modelo antigo e precisa mudar.

Por regra do `CLAUDE.md` ("Melhoria em repositório compartilhado"), **nada foi editado nesses repositórios** a partir do projeto. Cada bloco abaixo vira issue no repositório certo, executada com `/issue-ai <n>` aberto dentro dele.

Fontes das decisões: `docs/adr/0018`, `0019` e `0020` e `CONTEXT-MAP.md` deste workspace. Conceito de origem: `fundamentos-devops` (`0-conteudo/devops-cicd/ci-cd-fundamentos.md`, `estrategias-de-deploy.md`, `seguranca-no-pipeline.md`; `gitlab-pipelines/gitlab-ambientes-e-recursos-extras.md`), repositório público do próprio autor.

> **Limite desta análise.** O mapa dos arquivos foi feito por busca (grep) e leitura parcial, não por leitura integral. Onde está escrito "não li", confirme antes de agir. O `controlar-pipeline.yml` tem mais de 1000 linhas e só as partes com `rc`/branch foram vistas.

---

## 1. O que mudou (resumo para quem não leu os ADRs)

| Antes | Depois |
|---|---|
| `feature-x → MR → dev → qa → hml → main`, uma branch protegida por ambiente | `feature/*` e `hotfix/*` → MR → `main`. **Ambiente não é branch.** |
| Imagem construída na **tag** `vX.Y.Z-rcN` (build once por tag) | Imagem construída **uma vez, no merge na `main`**, identificada pelo **SHA**. Sem `rc`. |
| Promoção `dev→qa` por merge de tag feito pelo humano; `qa→hml` e `hml→main` por MR | `dev` e `qa` automáticos a cada merge. `hml` e produção por **aprovação humana na Esteira** (Entrega Contínua). |
| Hotfix: `hotfix/*` a partir da `main`, MR, aprovação | Igual, mas pelo **mesmo pipeline**; a aprovação pode **pular qa/hml explicitamente** (registrado). |
| Rollback em cascata `main → hml → qa → dev` | Redeploy do **SHA anterior** só no ambiente afetado. |
| Sem validação por feature antes do merge | `review-<fatia>` num cluster k3d, API+front juntos, **DAST (ZAP)**. |
| Nada atrás de flag | **Feature flag obrigatório** para comportamento percebido (`Features:<Fatia>...`); **Deploy ≠ Liberação**. |
| `dev` = `ai-infra` local, hml/prd = Kubernetes na AWS | **Todos Kubernetes**, em **2 clusters k3d**: `esteira-nao-prod` (dev, qa, hml, review-*) e `esteira-prd-local` (produção). Produção é um **Destino** (`local` agora, `aws` depois). |
| Termo "Candidata" (`-rcN`) | **Artefato** (imagem imutável por SHA). |

**Decisões fechadas** (vindas das perguntas Q1–Q22 da sessão):
trunk-based (Q1); escopo vale para todos os projetos que herdam o `ai-base`, o `template-ci` e o produto Esteira (Q2); registro em ADR novo que supera parte da 0008 (Q3); leitura do `fundamentos-devops` pela URL pública (Q4); artefato por SHA sem `rc` (Q5); `dev`/`qa` automáticos, `hml`/prod com aprovação humana (Q6); flags com estratégia de cancelamento (Q7, Q9, Q10, Q17); validação em Kubernetes local com DAST (Q8, Q15); hotfix expresso registrado (Q11); rollback por SHA (Q12); repositórios da Esteira promovem por job manual (Q13); `dev` em cluster k3d com `review-<fatia>` (Q14, Q19, Q20); produção como Destino configurável (Q21); 2 clusters (Q22); "Candidata" vira "Artefato" (Q16); Liberação separada de Deploy e AAN é da Liberação (Q18).

**Migração: sem período de convivência** dos dois modelos (a Esteira ainda não publica para terceiros).

---

## 2. `template-ci` (`ai-pipeline/template-ci`) — a maior e mais acoplada

Hoje o template constrói a imagem **uma vez, na tag**, e promove por **digest**. Nada constrói por branch. O princípio "mesmo artefato em todos os ambientes" já existe; o que muda é o **gatilho** e a **lógica de tag/branch** em volta.

### 2.1 `common/controlar-pipeline.yml` (mais de 1000 linhas; **a parte mais acoplada**)
- Pressupõe os estágios `dev`/`qa`/`hml`/`main` com `DEV_REAL_BRANCH`, `QA_REAL_BRANCH`, `HOMOLOG_REAL_BRANCH`, `MASTER_REAL_BRANCH`. *Não confirmei se esses nomes têm default ou aliases.*
- Regras de tag a **remover**: `rcN` só com `minor=0` e `patch=0`; `rcN` em sequência e descendente da anterior; a **origem da tag** (dev/qa/hml, por ancestralidade) decide onde o fluxo reinicia; "promotion = merge da tag"; commit direto em `qa`/`hml`/`main` bloqueia; **rollback em cascata** `main→hml→qa→dev`.
- Define `PIPELINE_PROCESS=tag|promotion|hotfix|minor` (o `promotion` perto da linha ~1026). Os modos precisam ser redesenhados em torno de: `merge` (build na `main`), `mr` (build descartável da fatia), `promocao` (play após aprovação), `hotfix`, `rollback` (redeploy do SHA), `rotulo` (aplica `vX.Y.Z` na ida a produção).
- Hotfix: continua só por humano; passa a usar o mesmo pipeline, com a opção de **pular qa/hml** registrada na Esteira (`esteira-gate`).

### 2.2 `ci-template.yml` e `common/rules.yml`
- `workflow.rules` hoje roda em tags, em `qa|hml|main`, em `feature/*` (gate de review, se `REVIEW_GATE_ENABLED`) e em `dev` (só `fechar-fatia`, se `FECHAR_FATIA_ENABLED`). Push em `dev` sem a flag não dispara nada. Passa a rodar em: MR/`feature/*`, `main`, `hotfix/*` e jobs manuais de promoção.
- `.rules-controlar-pipeline` roda em `tag` ou `/^(qa|hml|main)$/`; `.rules-fechar-fatia` só em `dev`; `.rules-review` só em `feature/*`; `.rules-build-*` só em tag/hotfix/minor. Tudo isso é reescrito.
- Como o alvo do MR vira a branch padrão, `fechar-fatia` não pode depender de "merge em `dev`".

### 2.3 Build e imagem (`image/image.yml`, `build/*.yml`)
- Hoje `image/image.yml` tem modos `build`, `retag` e `resolve`: tag candidata compila + `docker build` + push `:$PIPELINE_TAG`; tag final vinda de candidata faz **retag** (mesmo digest); promotion/rollback só `resolve`. **Manter a ideia, trocar o gatilho:** build no merge na `main`, tag da imagem = SHA; o "retag" vira "rótulo" na ida a produção; `resolve` continua para promoção e rollback.
- **Novo:** build em **MR** gerando o artefato **descartável** `<fatia>-<sha7>` (a fatia vem do nome da branch `feature/<fatia>-*`), com **limpeza** dessas tags no registry (política de retenção).
- `build/angular.yml` já afirma que a mesma imagem serve qa/hml/prod com config em runtime (`/config.json`, ADR-0006). **Reaproveitar** para apontar o front do review para a API do mesmo namespace.

### 2.4 `deploy/kubernetes.yml`
- Hoje: migrations + kustomize + rollout via GitLab Agent. Precisa de:
  - **Destino por Ambiente** (`local` | `aws`) vindo da Esteira (`esteira-abrir`), sem mudar o pipeline.
  - Deploy em **namespace `review-<fatia>`** (idempotente, label `esteira/fatia=<fatia>`) e `dev|qa|hml` no cluster `esteira-nao-prod`; produção no `esteira-prd-local`.
  - **Repositório sem branch da fatia** entra com o artefato atual de `dev` (a última `main`) no mesmo namespace.
  - **Migrations** só *expand* até a fatia ser liberada (ADR-0019); `contract` em deploy posterior.

### 2.5 `review/code-review.yml` e `review/fechar-fatia.yml`
- `abrir-mr-dev` e `verify-code-review` rodam em `feature/*` e a MR vai para `dev`: trocar para `main`.
- `fechar-fatia` (fecha a issue-mãe e as filhas ao mergear em `dev`) passa a rodar no merge na `main` **e a destruir o namespace `review-<fatia>`** quando a última MR da fatia é mergeada ou fechada.

### 2.6 **Novos jobs**
- **DAST (OWASP ZAP)**: job determinístico, imagem própria (`tools/zap` ou similar, a decidir). Passivo em `review-<fatia>` (só avisa) e em `hml`; **ativo em `qa`** (bloqueia crítica e alta, salvo Exceção). Nunca em produção nem ativo em `hml`. NetworkPolicy limita o ZAP ao namespace alvo. O agente `security` lê o relatório e produz o JSON de Análise; **quem bloqueia é a Política de segurança da Esteira** (ADR-0020).
- **Rollback por SHA** (redeploy do digest anterior só no ambiente afetado).
- **Rótulo `vX.Y.Z`** aplicado ao artefato na ida a produção (pelo bot da Esteira, tags `v*` protegidas).
- Todos os jobs enviam o campo **`fatia`** nos chamados `esteira-abrir`/`esteira-gate`/`esteira-resultado` (contrato `/api/pipeline/v1`, ADR-0013: compatível com a versão anterior; avaliar se vira `v2`).

### 2.7 Documentação do template
- `docs/fluxo-de-tags.md`: hoje documenta "dev → qa → hml → main, sem aliases", a regra "a `rc` pode ser cortada em dev, qa ou hml (a tag tem que estar na ponta do branch)", "tag final só em main" e o back-merge manual quando a correção nasce em `qa`/`hml`. **Reescrever inteiro** (some a maior parte).
- `README.md` e `.gitlab-ci.yml` do próprio template (releases por tag `vN.N.N`, build de `tools/*` por tag): conferir o que usa o fluxo antigo. *Não li.*
- O template já lida com a ausência de `qa` ("primeiro estágio existente"). Verificar se o novo modelo mantém essa tolerância.

---

## 3. `ai-base` (fonte das regras do processo; este workspace tem cópias)

### 3.1 Docs e instruções
- **`CLAUDE.md`** (linhas ~63–70): "Convenções de repo", fluxo `feature-x → MR → dev → qa → hml → main`; "o agente sempre sobe em `feature-x` e abre MR pra `dev`"; "`dev → qa` é merge direto por tag feito por você"; "as 4 branches são protegidas". Reescrever para `main` única. Atualizar também o parágrafo `/code-review` ("ponto fixo `origin/dev`").
- **`docs/agents/esteira-deploy.md`** (documento central): passos 1–10, convenção de tag `vX.Y.Z-rcN` (X/Y/Z), "regra crítica: `qa` nunca acima da tag", `release/vX.Y.Z-rcN`, hotfix, rollback em cascata. **Reescrever inteiro** conforme ADR-0018.
- **`docs/workflow.md`** (linhas ~13–48): `/implement-task` termina em MR para `dev`; "fechar a fatia" quando mergeada em `dev`; tag e promoção depois.
- **`docs/agents/workspace.md`** (linhas ~28, 44, 59): "uma MR por repositório, todas para `dev`"; "sem `Closes` porque o alvo não é a branch padrão" (**passa a haver `Closes`**); "cada repositório tem seu próprio dev→qa→hml→main".
- **`docs/agents/orchestration.md`** (linhas ~29, 57, 65, 86–109): agente `qa` valida o ambiente `qa`; MR para `dev`; `fetch` antes de conferir `dev`/`main`; gate `verify-code-review`; `fechar-fatia` no push em `dev`.
- **`docs/agents/padrao-api.md` e `padrao-frontend.md`**: **nova seção sobre feature flags** (ADR-0019): critério "comportamento percebido", nome `Features:<Fatia>...`, nasce desligado em produção, vida curta, remoção, migração expand-only. Para o front, usar a config em runtime. *`padrao-frontend.md` casou no grep por dev/qa/hml; não li o contexto.*
- **`docs/agents/spec-format.md`**, `README.md`, `docs-human/COMO-CRIAR-UM-PROJETO.md`, `docs-human/glossario-de-comandos.md`: mencionam dev/qa/hml. *Só o grep casou, não li.*
- **Novo:** o `spec-format` deve prever, por fatia, a declaração do **flag** (nome `Features:<Fatia>`) e do **plano de cancelamento/limpeza** (a limpeza é uma fatia, ADR-0019).
- `docs/agents/melhoria-orquestracao.md`, `security-review.md`, `issue-tracker.md`: conferir menções (`issue-tracker.md` explica por que o `Closes` não é usado).

### 3.2 Hook
- **`.claude/hooks/block-dangerous-git.sh`** (idêntico em `ai-base` e no esteira): `PROTECTED_BRANCHES="main|master|dev|qa|hml"`. A mensagem de bloqueio manda abrir MR para `dev`; o comentário diz "promoção `dev→qa` é do humano". Ajustar a lista (as branches `dev`, `qa`, `hml` somem) e as mensagens. **Manter** o bloqueio de push direto em `main`, `--force`, `reset --hard`, `clean -f`, `branch -D`, `checkout .`/`restore .`. O agente continua só abrindo MR.

### 3.3 Scripts (`.claude/scripts/`, com cópias no esteira)
- **`worktree-fatia.mjs`** (linha ~61): cria worktree `feature/<slug>` a partir de `origin/dev` → `origin/main`.
- **`status-specs.mjs`** (linhas ~68, 82–99, 128–133): busca MRs `target_branch=dev` mergeadas; merge commit `into 'dev'` em `origin/dev`; testes em `origin/dev`; uma fatia só conta como feita se mergeada em `dev` → tudo para `main`.
- **`check-spec-drift.mjs`** (linhas ~2, 11, 27): drift = mudança em `origin/dev` de cada repositório de código depois da spec (o workspace usa `origin/main`) → `origin/main` em todos.
- **`situacao.mjs`** (linhas ~44, 66): protegidas = `dev|qa|hml|main|master`; base = `origin/dev` com fallback (*não vi qual*); no workspace e em `ai-*`, base `main`. Passa a ser `main` em todos.
- Conferir `check-tickets.mjs` e qualquer outro script que cite `dev`. *Não li todos.*

### 3.4 Commands, agents e skills
- **`.claude/commands/implement-task.md`**: `fetch origin`; `diff origin/dev...<branch>` (ponto fixo do review); MR com `target dev`; saída `dev ← feature/b2-<slug>`. Trocar por `main`. Incluir o passo de **flag** (a fatia declara e a implementação o usa) e a criação/uso do ambiente `review-<fatia>`.
- **`.claude/commands/proximo.md`**: compara `feature/*` com `origin/dev` e roda `check-spec-drift` contra `dev`; "mapa vs. MRs mergeadas em dev".
- **`.claude/commands/situacao.md`**, `fatia.md`, `mapa.md`: usam os scripts acima; conferir menções diretas. *Não casaram o grep.*
- **`.claude/agents/qa.md`**: "valida o ambiente `qa` publicado". Mantém o estágio, muda o gatilho (deploy automático em `qa` a cada artefato). Precisa saber ler o resultado do **DAST** (ADR-0020).
- **`.claude/agents/review.md`**: passa a **checar o flag** para comportamento percebido (ADR-0019).
- **`.claude/agents/security.md`**: passa a **ler o relatório do ZAP** e produzir o JSON de Análise; não decide o bloqueio.
- **Skills** (`git-guardrails-claude-code`, `create-branch`, `commit`): **não li**. Podem citar `dev`/`qa`/`hml`. Conferir.
- **`/issue-ai`** (raiz do orchestration-ai) usa a branch padrão (`origin/HEAD`) e **não** pressupõe o fluxo antigo.

### 3.5 `docs-human` (ai-base e `ai-ops/docs-human/ai-base`)
- `COMO-CRIAR-UM-PROJETO.md`, `glossario-de-comandos.md` e `ai-ops/docs-human/ai-base/{runbook,infra,comandos-para-rodar}.md`: mencionam dev/qa/hml. *Só o grep casou.* Atualizar.

---

## 4. `ai-ops` e `ai-infra` (infraestrutura)

### 4.1 `ai-ops`
- **`docs-human/infra/kubernetes-local.md`** e **`agents/infra/local-environment-config/docs/infra/kubernetes-local.md`**: hoje criam **2 clusters por ambiente** (`valuto-qa-local` e `valuto-hml-local`, "Opção 3") com k3d, cert-manager (Issuer self-signed), Traefik (já vem no k3s) e 4 operators (CloudNativePG, Redis Operator da OT-ContainerKit, RabbitMQ Cluster Operator, Keycloak Operator). **Mudar para os 2 clusters da ADR-0020**: `esteira-nao-prod` (namespaces `dev`, `qa`, `hml`, `review-*`) e `esteira-prd-local`. Os operators e o cert-manager precisam existir em ambos. O doc já avisa que URLs/versões dos operators são de memória e devem ser conferidas.
- **Novo:** **NetworkPolicy** isolando `qa`, `hml` e `review-*` entre si; política própria para o ZAP alcançar só o namespace alvo.
- **Novo:** **GitLab Agent** nos dois clusters (o `kubernetes-local.md` já cita o agent; confirmar como o runner alcança um cluster local, ver pergunta aberta 6.5).
- **Novo:** rotina de criação e destruição de `review-<fatia>` (usada pelo `template-ci`).
- `docs-human/ai-base/{runbook,infra,comandos-para-rodar}.md` e `infra.md` (desenho EC2 + Let's Encrypt para a nuvem): continuam válidos como estágio posterior (Destino `aws`); conferir que não afirmam "um cluster por ambiente" como regra.
- `smoke-test`, `combos.md`: apareceram no grep, **provavelmente falsos positivos** (dev/qa como ambiente, não como branch). Não confirmei.

### 4.2 `ai-infra` (infra compartilhada)
- Hoje entrega Postgres, Redis, RabbitMQ, Keycloak e observabilidade numa "casa" isolada por projeto, em dev local. Com `dev` em Kubernetes (ADR-0020), **definir quem fornece esses serviços dentro do cluster**: os operators (como no `kubernetes-local.md`) ou a `ai-infra` fora do cluster. O contrato de chaves (`ConnectionStrings:Postgres`, `RabbitMQ:*`, `Keycloak:*`, `Redis:KeyPrefix`) **não muda** (CLAUDE.md, seção Infra).
- Para o review por fatia: banco/vhost/prefixo Redis **por fatia**, criados na abertura e removidos no fechamento, ou serviços compartilhados no namespace com separação lógica. **Pergunta aberta 6.3.**
- Isso é pedido para o agent `ai-ops/agents/infra/local-environment-config`, não código do projeto.

---

## 5. Próprio workspace Esteira (não é do orchestration; fica aqui só para a sessão não se perder)

Itens que **eu** (a sessão do projeto) vou tratar ou que viram specs, sem passar pelo orchestration:
- `CONTEXT-MAP.md`: **Fluxo, Entrega, Etapa, Aprovação da candidata, Notas de entrega, Conferência de escopo, Papéis e a regra de ocupação** ainda dependem da redefinição do Fluxo (rodada em andamento).
- `docs/mudancas-template.md` (§4.0: "dev e qa são andares distintos, hml tem qa como predecessor (dev→hml bloqueado), projeto sem qa continua funcionando; promoção virando MR aberta e mergeada pelo bot; agentes de code-review/security/qa no CI por candidata nova"): reescrever; parte já é entregue pelas pendências acima.
- ADRs: 0009 (ocupação do Ambiente: "um Fluxo por vez em cada Ambiente" precisa de revisão), 0010 (ações do bot: hoje abre MR `release/<tag>`), 0013 (contrato da pipeline: campo `fatia`, "candidata" nos payloads), 0006 (já alinhada).
- `CLAUDE.md` e `docs/agents/*` do workspace: cópias dos de `ai-base`; sincronizar quando o `ai-base` mudar.
- Specs `E*` do mapa (`specs/README.md`, fatias do Fluxo): rever com `/mapa`.
- Protótipos em `docs/design/prototipos/` (`prototipo-abrir-entrega`, `prototipo-entrega`, `prototipo-entregas`, `prototipo-auditoria`): citam dev/qa/hml/candidata. Redesenhar conforme o novo Fluxo.
- Código `esteira-api` (agregados `FluxoDeploy` e `Deploy`, noção de Candidata e ocupação) e `esteira-frontend`: **só depois** de as specs serem reescritas.

---

## 6. Perguntas abertas para a sessão do orchestration-ai

1. **Alterar flag em produção:** no .NET a configuração por variável de ambiente é lida no start, então ligar um flag exige reiniciar o pod (sem build). Aceitável? Ou usar um provedor de configuração recarregável (ConfigMap montado como arquivo + `reloadOnChange`)? Definir antes da primeira fatia com flag.
2. **Retenção do registry:** quantas tags `<fatia>-<sha7>` manter, e quem limpa (job agendado ou `fechar-fatia`)?
3. **Dependências do review por fatia** (Postgres/Redis/RabbitMQ/Keycloak): um conjunto compartilhado no cluster com isolamento lógico por fatia, ou um conjunto por namespace? O segundo é mais fiel e bem mais pesado. **Recomendação:** compartilhado com isolamento lógico (banco, vhost, prefixo Redis por fatia; realm Keycloak compartilhado no review).
4. **Imagem do ZAP:** `tools/zap` no template, ou imagem pública fixada por versão e digest?
5. **Runner alcançando o k3d local:** o GitLab Agent é uma conexão de saída do cluster para o GitLab; confirmar se isso resolve o deploy a partir de um runner (e onde o runner roda) sem expor a máquina.
6. **Memória da máquina:** não foi medida. Dois clusters k3d + operators + review + ZAP é pesado. Definir um limite de namespaces `review-*` simultâneos (hoje, na prática, 1 a 3).
7. **Contrato `/api/pipeline/v1`:** o campo `fatia` e a troca de "candidata" por "artefato" cabem em `v1` retrocompatível ou exigem `v2` (ADR-0013 aceita a atual e a anterior ao mesmo tempo)?
8. ~~Tag `vX.Y.Z`~~ **Resolvida (ADR-0021):** versão **`X.Y.Z` sem "v"** a cada publicação em produção. Z automático (hotfix soma 1). O tipo (minor por padrão, major por marcação) é declarado por quem aprova o review; na ida a produção vale o maior tipo dos Fluxos incluídos, e o aprovador de produção pode corrigir antes de confirmar. A regra antiga de `esteira-deploy.md` (Z sempre 0 fora de hotfix) deixa de valer.

---

## 7. Roteiro de migração dos repositórios (ação **humana**, sem convivência)

Só depois de o `template-ci` novo existir (seção 2) e do `ai-base` atualizado (seção 3). O hook bloqueia o agente nesses passos de propósito. Para cada repositório de código (`esteira-api`, `esteira-frontend` e demais):

1. Garantir que **nada está pendente**: rodar `/situacao` (sem alterações soltas, sem branches não mergeadas).
2. Fechar ou retargetar as MRs abertas para `main`.
3. Mergear `dev` na `main` (o conteúdo de `dev` ainda não promovido entra de uma vez). Conferir que `qa` e `hml` não têm commit acima de `dev` que não esteja na `main`; se tiver, trazer.
4. Tornar `main` a branch padrão (se já não for) e deixá-la protegida (sem push direto).
5. Apagar as branches `dev`, `qa` e `hml` (e as regras de proteção delas) no GitLab e localmente.
6. Rebasear ou recriar as `feature/*` abertas sobre a `main`.
7. **Tags históricas** `vX.Y.Z-rcN` e `vX.Y.Z`: manter como histórico. O pipeline novo as ignora (nenhuma promove mais nada).
8. Ajustar variáveis de CI (`DEV_REAL_BRANCH`, `QA_REAL_BRANCH`, `HOMOLOG_REAL_BRANCH`, `MASTER_REAL_BRANCH`) removendo as que não existem mais.
9. Rodar um merge de teste e confirmar: build na `main` gera o artefato por SHA; `qa` recebe o deploy (não há `dev`, ADR-0021); `hml` e produção esperam a aprovação na Esteira.

---

## 8. Ordem sugerida

1. `ai-ops`/`ai-infra`: 2 clusters, operators, NetworkPolicy, GitLab Agent (sem isso nada do `template-ci` novo testa).
2. `template-ci`: primeiro build na `main` e promoção; depois `review-<fatia>` e `fechar-fatia`; por último DAST e rollback. Quebrar em issues pequenas.
3. `ai-base`: docs, hook, scripts, commands e agentes (podem andar junto com o item 2).
4. Migração dos repositórios (seção 7).
5. Esteira: reescrever o Fluxo, as specs `E*` e os protótipos; só então mexer no código.

## 10. Contrato de leitura da Esteira (novo)

Decisão da sessão: **os comandos e agentes continuam como estão** (markdown, git, issues, bloco `<!-- execucao -->`). A Esteira é a camada visual do humano e **só lê** esses artefatos (nunca os escreve); as decisões de processo ela executa no GitLab por Ação do bot (ADR-0021). O formato lido é um contrato estável: **`docs/contrato-leitura-esteira.md`** (v1, rascunho para aprovação).

O que isso pede do `ai-base` (nenhuma mudança de comportamento, só vínculo):

1. Cada comando que **escreve** um formato do contrato aponta para ele: `/implement-task` (bloco de execução, commit de task), `/fatia` e `/to-tickets` (título da mãe e das filhas, `Blocked by:`, `Cobre:`, mapa), `check-spec-drift --stamp` (linha `base:`). Regra: mudou formato, muda o contrato **e** as fixtures na mesma MR; quando o formato mora no `ai-base`, a mudança vira issue lá e a MR do contrato e das fixtures, na Esteira, fica ligada a ela.
2. `docs/agents/orchestration.md` ("Nomes", "Marca da fatia nos testes"), `docs/agents/spec-format.md` e `docs/agents/issue-tracker.md` passam a citar o contrato como a lista do que não pode mudar sem versão.
3. Confirmar, com `/fatia` e `/proximo`, **quais valores a coluna `Status` do mapa pode ter** (só `feito` e `—` apareceram).
4. Avaliar (sem urgência) o campo opcional `**Contrato:** v1` no cabeçalho do bloco de execução; é aditivo e não quebra quem lê o bloco hoje.
5. **Não tirar** o bloco de execução nem a coluna `Status` do mapa: a Esteira depende deles. Se alguém quiser removê-los um dia, isso vira v2 do contrato.

---

## 9. Riscos já conhecidos

- **Flag desligado não é rede de segurança contra bug na `main`.** Hotfix e rollback por SHA assumem que a `main` inteira é implantável; com `main` quebrada, o rollback é a saída.
- **O rollback não desfaz o banco** (já era assim). Por isso a regra expand/contract (ADR-0019) é pré-requisito, não opcional.
- **Review sem hospedagem externa** só existe na sua máquina: a evidência de que a feature foi vista rodando não fica no GitLab. A Esteira registra a Análise (DAST, smoke), mas não "o humano abriu e olhou".
- **Custo assumido de aprendizado** (ADR-0020): cluster, operators, cert-manager e Agent para validar features. Se pesar, o plano B barato é `docker run` local do artefato descartável.
- **Convivência zero:** se o `template-ci` novo atrasar, os repositórios ficam parados no modelo antigo; não há ponte.

## 11. Decorrências da ADR-0021 (2026-11-14)

Para o `template-ci`, `ai-base` e `ai-ops`/`ai-infra` (cada uma vira issue no repositório certo, com o sim do humano):

- **`template-ci`:** job de abrir review disparado pela Esteira (`review-<fatia>`); `fechar-fatia` também quando a MR é fechada pela reprovação; job de alterar flag; job de promoção e de rollback disparados pelo bot; `esteira-abrir` que **anexa** o Artefato a um Fluxo já aberto e recusa sem Fluxo; DAST ativo no `qa`, passivo em `hml` e produção, nenhum no review; smoke e ZAP em produção só alertam; aplicar a versão `X.Y.Z` (sem "v") na ida a produção.
- **`ai-base`:** `/implement-task` reabre a MR fechada pela reprovação em vez de abrir outra; `main` protegida para merge só do bot (hook e docs); `esteira-deploy.md`, `workflow.md` e `workspace.md` reescritos no modelo novo, sem `dev`.
- **`ai-base` — preview isolado por Fatia (decidido em 2026-11-14):** toda Fatia **de front** passa a registrar na própria spec o **módulo e a rota** em que está sendo trabalhada (campo novo no `spec-format.md`, por exemplo `preview:` com a rota de entrada). A coluna `Toca em (estimado)` do mapa **não serve**: é estimativa, e o preview precisa de valor exato. O agente `ui` (dentro do `/implement-task`) cria, como parte da Fatia, a **sessão falsa** (já logado) e os **dados falsos** da tela, tipados pelos tipos gerados do OpenAPI (ADR-0005), de modo que dado fora do contrato quebre o build. Fatia **de API** não tem preview: o `review` confere o contrato (diff do OpenAPI) e os testes; app real só em `risco: alto`. Efeito no contrato de leitura: a linha `preview:` da spec é um campo **aditivo** (acrescentar é livre).
- **`template-ci` — preview estático por MR:** build do front em modo preview (sessão e dados falsos), publicado como site estático com um endereço por MR (por exemplo GitLab Pages com `path_prefix` por branch), sem cluster, API nem banco. Destruição obrigatória no merge ou fechamento da MR e prazo máximo (`auto_stop_in`); o GitLab não destrói sozinho, o destroy é script nosso. Substitui o review com API e front reais da ADR-0020 para Fatias de front.
- **Esteira — verificação de flag alterado fora da Esteira (a definir):** rotina de fundo que compara o estado real de cada flag em cada Ambiente com o que a Esteira registrou. Ponto crítico: flag ligado em produção para uma Fatia que nunca teve Liberação. Comportamento acordado em 2026-11-14: roda a cada poucos minutos e depois de cada deploy; divergência comum aparece no Painel como "flag alterado fora da Esteira" (com quem alterou, se o cluster informar); a grave (ligado em produção sem Fluxo e Liberação) ganha destaque e alerta; **nunca reverte sozinha**, oferece **restaurar** para o registrado ou **aceitar** (registra nome e motivo). Em aberto: como a Esteira lê o estado real (job do GitLab só de leitura ou outro caminho).
- **GitLab (config do grupo):** escopo do bot para comentar, fechar, reabrir e mergear MR; `main` com merge permitido só ao bot; webhook de merge e fechamento de MR para registrar "merge fora da Esteira".
- **Decidido depois (2026-11-14, ADR-0022):** review sob demanda (botão) e leve; aprovar a MR só mergeia; Fluxo aberto por seleção de Fatias aprovadas do mesmo Projeto, que gera o Artefato; pipeline da `main` só com CI e health check; `template-ci` precisa de um modo "Fluxo" que builda o Artefato sobre um SHA escolhido pela Esteira.
- **Decidido depois (2026-11-14):** ocupação (`qa` sem fila, `hml` e produção um por vez, com fila e "substituir" no `hml`) e flag ausente = desligado; a tela de aprovação mostra os flags do Artefato.
- **Ainda em aberto (não tratar como decidido):** como a Esteira descobre os flags de um Artefato (busca por `Features:<Fatia>` ou declaração na spec); Fatia × Entrega; mecanismo técnico do flag (item 1 da seção 6); `/api/pipeline` v1 ou v2 (item 7); o botão de aprovar para os repositórios da própria Esteira (modo fallback, merge manual).
