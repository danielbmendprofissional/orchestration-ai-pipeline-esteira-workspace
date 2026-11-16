# Mudanças necessárias no template-ci

Levantadas no discovery da Esteira (ADR-0008) e **reescritas em 2026-11-16** para o modelo trunk-based (ADRs 0018–0025). O template-ci **v3** (tag `v3.0.0`, ainda a criar) implementa o cliente; a Esteira ainda precisa implementar o servidor. Contrato e modelo do lado do template: `template-ci/docs/contrato-pipeline-v2.md` e `template-ci/docs/pipeline-trunk-based.md` (substituem o antigo `fluxo-de-tags.md`).

## Situação por item

| Item | Situação |
|---|---|
| 1. Chamadas à Esteira | **Parcial.** `esteira-abrir` feito (v3, `/api/pipeline/v2/abrir`). `esteira-gate` e `esteira-resultado` seguem a definir (item 1.1) |
| 2. `id_tokens` | **Feito** no `controlar-pipeline` (`aud: esteira`) |
| 3. Configuração vem da Esteira | **Pendente** (item 3) |
| 4, 4.0, 4.1, 7 (candidatas `rcN`, dev/qa, sync, promoção por MR de estágio) | **Superados**: não há branches de ambiente nem tags `rcN` (ADR-0018/0019). Ver "O que substituiu" |
| 4.2 Backup pré-publicação | **Pendente** |
| 5, 5.1 Agentes e insumos das Notas | **Pendente**, ajustado ao Artefato por SHA |
| 6, 6.1 Falso positivo e Esteira fora do esquema | **Feito**: `ESTEIRA_FALLBACK=true` (ADR-0025) |
| 8. `tools/agent-runner` | **Pendente** (ADR-0012/0017) |
| 9. Toda MR referencia uma issue | **Pendente**, agora para `feature/*` e `hotfix/*` → `main` |

## O que substituiu os itens 4, 4.0, 4.1 e 7

- Só `main`, `feature/*` e `hotfix/*`. O merge na `main` roda só CI (sem imagem publicável); o Artefato nasce no processo **`fluxo`**, com a imagem identificada pelo **SHA de 40 caracteres**, e é promovido por digest (qa → hml → produção).
- Os processos do controlador: `mr`, `main`, `fluxo`, `promocao`, `liberacao`, `flag`, `rollback`, `rotulo`, `preview`, `preview-destroy`, `limpeza`. Os que publicam só rodam por **trigger do bot**; push/tag manual é recusado. Tag `vX.Y.Z` só é criada pelo job `rotulo`, **sem "v"** (`X.Y.Z`).
- O Fluxo usa o último SHA verde da `main`, fixado pela tag temporária `fluxo/<id>`; o controlador confere `CI_COMMIT_SHA == FLUXO_SHA`.
- Não existe `sync`/back-merge nem cascata de rollback por branch: rollback é por SHA, só no Ambiente afetado, sem migrations.
- `main` só aceita merge do bot (merge commit, sem squash, "pipeline must succeed"). O bot cria, mergeia, fecha e reabre a MR.
- Quem usa o template troca `ref` para `v3.0.0`, remove `DEV_REAL_BRANCH` e variáveis de branches de ambiente (README do template, "Migrar da v2 para a v3").

## 1. Chamadas à Esteira (HTTP, fail-closed)

| Job | Onde | Esteira responde |
|---|---|---|
| `esteira-abrir` (**feito**) | `controlar-pipeline`, antes de qualquer build/deploy dos processos do bot | OK + `feature_flags` do Ambiente, ou `4xx` com motivo (sem Entrega aberta, Ambiente ocupado, rollback em curso, papel, Atalho, dependência front/API) |
| `esteira-gate` (a definir) | depois do stage `security`, antes do deploy | OK / erro; a Política de segurança passa a ser a autoridade do bloqueio |
| `esteira-resultado` (a definir) | depois do deploy/verify | só registra; barra a próxima promoção |

- Falha de rede = job vermelho em **todos** os ambientes, sem bypass. Exceção explícita: `ESTEIRA_FALLBACK=true` (repositórios da própria Esteira).
- Até `esteira-gate` existir, o `security-gate` local decide (`SECURITY_FAIL_ON`) e o relatório é só artifact; isso fecha a pendência 1 do README ("report-api") quando o envio das Análises for implementado.

### 1.1 O que falta definir

- Formato do envio de `consolidated.json` + análises dos agentes no `esteira-gate`.
- Formato do `esteira-resultado` (rollout, smoke de leitura, DAST ativo no qa / passivo no hml, agente de qa).

## 2. Autenticação por `id_tokens`

Mantido: `ESTEIRA_ID_TOKEN` com `aud: esteira`, enviado como `Authorization: Bearer`. Nenhum segredo da Esteira nos projetos.

## 3. Configuração vem da Esteira, não de variável do GitLab (pendente)

- A resposta do `esteira-abrir` hoje devolve só `feature_flags`. Falta devolver a configuração não secreta do projeto por Ambiente (`APP_TECHNOLOGY`, `DOTNET_APPS`, `K8S_NAMESPACE`, `APP_URL`, `SMOKE_EXTRA_URLS`…) em JSON estruturado, porque um Ambiente pode ter mais de um **Destino** (produção `local`/`aws`).
- **Deploy por Destino em child pipeline dinâmico:** a lista só existe em runtime e `parallel:matrix` é estático; o stage `deploy` gera um job por Destino (log, retry e status próprios). Análises que dependem só da imagem rodam uma vez, antes.
- No GitLab ficam só segredos, segurança e globais.

## 4.2 Backup pré-publicação (pendente)

- No deploy de **produção**, antes do Job de migrations (só com `EF_PROJECT`), um `pg_dump` identificado pelo SHA/versão (`<app>-X.Y.Z-pre.dump`); manter os das 3 últimas publicações. Onde guardar: `docs/mudancas-infra.md`, item 3.
- O `esteira-resultado` informa nome/local. É recuperação de desastre (restore manual, só MOR), **não** rollback. Migração `contract` invalida o rollback anterior (ADR-0025).

## 5. Agentes no CI (pendente)

Disparo é por **Artefato novo** (um `fluxo`), não por ambiente.

- **code-review**: no `fluxo`, sobre o diff entre o último Artefato publicado em produção e o SHA do Fluxo. O gate local em `feature/*`/`hotfix/*` (`.code-review-ok.json`, job `verify-code-review`) continua como filtro antes da MR.
- **security**: junto das ferramentas do stage `security`, em toda pipeline; achados entram no `consolidated.json`.
- **qa**: depois do deploy no **qa** (app no ar; lê o relatório do DAST ativo). Sem resultado positivo a Esteira não promove para hml.

### 5.1 Insumos das Notas de entrega

- `.NET`: exportar o OpenAPI do Artefato (para `oasdiff` contra o anterior).
- Angular: exportar a lista de rotas do Artefato.
- Agente de qa: screenshots das rotas alteradas, no `esteira-resultado`.

## 6. Falso positivo sai do repositório (feito no fallback)

- Para projetos da Esteira, exceção vira **Exceção** na Esteira (aprovador e validade); o `security-gate` deixa de aplicar `.security-ignore` e a Esteira marca os achados cobertos na resposta do `esteira-gate` (depende do item 1.1).
- `.security-ignore` continua valendo só no modo fallback.

### 6.1 A própria Esteira

`esteira-api` e `esteira-frontend` ficam **fora do esquema de Entrega/Fatia**: consomem o template com `ESTEIRA_FALLBACK=true` (sem chamadas à Esteira, gate local, promoção manual). Uma Esteira quebrada precisa publicar a própria correção. Implementado no controlador (ADR-0025).

## 8. Imagem `tools/agent-runner` (ADR-0012, pendente)

- Imagem rodando o Claude Code CLI (`claude -p`) com as definições de agente do projeto (`.claude/agents/review.md`, `security.md`, `qa.md`), modelo via OmniRoute (`ANTHROPIC_BASE_URL` + key em variável mascarada do grupo; nunca a assinatura) — ADR-0017.
- Jobs: `agent-code-review` e `agent-security` antes do `esteira-gate`; `agent-qa` depois do deploy no qa, antes do `esteira-resultado`.
- Saída em JSON no formato de Análise (spec E2). Respeitar o teto de custo por execução devolvido pelo `esteira-abrir`.
- Substitui o princípio "nenhuma IA roda no CI" do README; o gate local continua.

## 9. Toda MR referencia uma issue (pendente)

- A Esteira cruza as issues da Entrega com as MRs mergeadas entre a última versão em produção e o Fluxo ("Closes #N" na MR ou número da issue no nome da branch).
- O template passa a recusar MR `feature/*` ou `hotfix/*` → `main` sem issue referenciada (job no stage `review`, junto do `verify-code-review`). Sem isso a Conferência de escopo fica cega.
