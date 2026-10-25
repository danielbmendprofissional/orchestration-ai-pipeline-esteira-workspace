# Mudanças necessárias no template-ci

Levantadas no discovery da Esteira (ADR-0008). Lista para aplicar no repositório `template-ci`; cada item diz o que muda e por quê.

## 1. Três chamadas à Esteira (HTTP, fail-closed)

| Job | Onde | Envia | Esteira responde |
|---|---|---|---|
| `esteira-abrir` | dentro/logo após o `controlar-pipeline`, antes de qualquer build | projeto (`CI_PROJECT_ID`), tag, ambiente (`PIPELINE_ENV`), pipeline id, processo (cut/promotion/final/hotfix) | OK + configuração do projeto para o ambiente (item 3), ou erro com motivo |
| `esteira-gate` | depois do stage `security`, antes do `deploy` (substitui a decisão do `security-gate`) | `consolidated.json` + análises dos agentes, `IMAGE_REFS` | OK / erro com motivo |
| `esteira-resultado` | depois do `deploy`/`verify` | rollout, smoke-test, ZAP, agente de qa | só registra (não barra este deploy; barra a próxima promoção) |

- Falha de rede/indisponibilidade = job vermelho em **todos** os ambientes, sem bypass.
- `security-gate` continua agregando e normalizando (gera `consolidated.json`), mas não decide mais. `SECURITY_FAIL_ON` só vale para projeto fora da Esteira (fallback).
- Fecha a pendência 1 do README ("report-api").

## 2. Autenticação por `id_tokens`

```yaml
id_tokens:
  ESTEIRA_ID_TOKEN:
    aud: esteira
```

Os três jobs mandam `Authorization: Bearer $ESTEIRA_ID_TOKEN`. Nenhum segredo da Esteira nos projetos.

## 3. Configuração vem da Esteira, não de variável do GitLab

- A resposta do `esteira-abrir` traz a configuração não secreta do projeto para o ambiente (hoje: `APP_TECHNOLOGY`, `DOTNET_APPS`, `K8S_NAMESPACE`, `APP_URL`, `SMOKE_EXTRA_URLS`…), repassada aos jobs seguintes.
- **Não é só dotenv:** uma aplicação pode publicar em mais de um **Destino** por ambiente (ex.: 2 nós, cada um com sua lista de deploys e configs). O formato é JSON estruturado (formato exato sai na spec da fatia de integração).
- **Deploy por Destino em child pipeline dinâmico:** a lista de Destinos só existe em runtime (vem do `esteira-abrir`) e `parallel:matrix` é estático. O stage `deploy` gera um YAML com um job de deploy (+ smoke/ZAP) por Destino e dispara como child pipeline — cada Destino com log, retry e status próprios. Análises que dependem só da imagem (security, gate) continuam rodando **uma vez**, antes do child.
- No GitLab ficam só segredos, segurança e globais.

## 4. Minor passa pelo fluxo normal

- Candidata aceita `vX.Y.0-rcN` com `MINOR` ≠ 0 (`PATCH` continua 0) — hoje `ValidateCandidateTag` rejeita.
- **Concorrência passa a ser por core (`MAJOR.MINOR`), não por MAJOR.** `OpenMajors`, `MajorFurthestStage` e `CrossMajorAncestors` procuram `v${m}.0.0-rc*` e agrupam por MAJOR: com minor no fluxo normal, `v4.1.0` e `v4.2.0` abertos ao mesmo tempo são fluxos distintos do mesmo MAJOR. Também a checagem "próximo MAJOR sequencial" da `rc1` precisa aceitar `rc1` de MINOR novo (mesmo MAJOR da última final, `MINOR + 1`).
- Remover a rota "minor direto em `main` sem candidata". Direto em `main` fica só o hotfix (`PATCH`), e ele também chama a Esteira (precisa de Fluxo hotfix aberto).

## 4.0 dev e qa deixam de ser o mesmo andar

Na Esteira DEV e QA são etapas distintas (gates e ocupação próprios); o template é a segunda barreira e hoje aceita pular o QA.

- `rc1` nasce só no **primeiro estágio existente** (`dev`; sem `dev`, `qa`).
- Predecessor de `hml` é `qa` quando `qa` existir (`TierPredecessorBranches`): promoção `dev → hml` bloqueada.
- Correção nascida em `qa` (`rcN` com origem `qa`) continua permitida.
- Cascata de rollback `main → hml → qa → dev`, sem pular `qa` (`TierSuccessorStages`/`TierStages`).
- Projeto sem branch `qa` continua funcionando: "primeiro estágio existente" cobre.

## 4.1 Sincronização (back-merge) não é rollback

Hoje, mesclar `main` em `dev` depois de um hotfix cai no caminho **ROLLBACK** do `controlar-pipeline`: a última coisa que entrou é a tag final `v3.3.1`, então ele trata como promoção de final para `dev`, exige que `hml` já a tenha (cascata `main → hml → qa → dev`) e **publica a imagem de produção no ambiente**. Com fluxos abertos isso derruba a candidata que está em `hml`/`qa`/`dev`. E a seção 4 do `fluxo-de-tags.md` ("mescle `main` no `dev`") não passa sem antes cascatear por `hml`.

- Novo processo **`sync`**: merge de `main` (ou de estágio à frente) trazendo só tag final já publicada e merges estruturais, **sem deploy, sem build, sem exigir cascata**. Quem diz que é sync é a Esteira: o bot registra o merge e o `esteira-abrir` responde `processo: sync` → pipeline encerra verde sem publicar.
- Rollback continua existindo, mas só quando a Esteira pede (ação explícita na tela).
- Depois de todo hotfix o bot sincroniza `main` em `dev`, `qa` e `hml`. Fluxos abertos ficam "precisa de nova candidata" (regra de descendência da Esteira) e o bot corta a próxima `rcN` no estágio onde cada um está.

## 4.2 Backup pré-publicação

- No deploy de **produção**, antes do Job de migrations (só quando `EF_PROJECT` estiver ligado), um `pg_dump` do banco da aplicação identificado pela versão (`<app>-vX.Y.Z-pre.dump`).
- Guardar os das **3 últimas publicações** (rotação). Onde guardar: `docs/mudancas-infra.md`, item 3.
- O `esteira-resultado` informa o nome/local do dump. É recuperação de desastre (restore manual, só MOR), **não** o rollback — rollback é só de imagem.

## 5. Agentes no CI

Disparo é por **candidata nova**, não por ambiente — cobre a correção nascida em `hml` (`rc2` cortada lá).

- **code-review**: roda em toda candidata nova, de qualquer origem (`dev`, `qa` ou `hml`), sobre o diff entre a candidata anterior do mesmo core (ou a última final publicada, se for `rc1`) e a nova. Resultado vai no `esteira-gate`. O gate local em `feature/*` (`.code-review-ok.json`) continua como filtro antes da MR.
- **security**: roda junto com as ferramentas do stage `security`, em toda pipeline. Achados entram no `consolidated.json` como as ferramentas.
- **qa**: roda depois do **primeiro deploy de cada candidata nova** (`qa` no caminho normal; `hml` quando a candidata nasceu em `hml`). Precisa da app no ar. Resultado vai no `esteira-resultado`; sem resultado positivo a Esteira não avança.

## 5.1 Insumos das Notas de entrega

- `.NET`: exportar o OpenAPI da versão como artefato do build (para `oasdiff` contra a versão anterior).
- Angular: exportar a lista de rotas da versão como artefato do build.
- Agente de qa: screenshots das rotas alteradas, enviados no `esteira-resultado`.

## 6. Falso positivo sai do repositório

- `.security-ignore` descontinuado para projetos da Esteira: exceções viram **Exceção** na Esteira (com aprovador e validade). O `security-gate` não aplica mais o ignore; a Esteira marca os achados cobertos por exceção na resposta do `esteira-gate`.
- O `.security-ignore` continua valendo só no modo fallback (projeto fora da Esteira).

## 6.1 Exceção: a própria Esteira

`esteira-api` e `esteira-frontend` consomem o template em **modo fallback** (sem chamadas à Esteira, gate local por `SECURITY_FAIL_ON` + `.security-ignore`, promoção manual com MR). Uma Esteira quebrada precisa conseguir publicar a própria correção. O template precisa de um jeito explícito de ligar/desligar a integração (ex.: `ESTEIRA_ENABLED`).

## 7. Promoções feitas pelo bot da Esteira

- Toda promoção vira MR aberta e mergeada pelo bot, com a **branch do estágio como origem** (`dev → qa`, `qa → hml`, `hml → main`) quando a tag está na ponta dela — o `FindPromotedTag` já reconhece tag + merges estruturais. Só quando a origem andou além da tag (outro fluxo já commitou em `dev`, caso comum com fluxos concorrentes) o bot usa `release/<tag>` descartável (`remove_source_branch`), que o template também já aceita. Nada a mudar no `controlar-pipeline` aqui.
- O `[AVISO]` do `CrossMajorAncestors` passa a ser informação enviada no `esteira-abrir` (a Esteira exibe; quem decide é a regra de descendência da Esteira).
- Tags `v*` protegidas: só o bot cria.
- Documentação (`docs/fluxo-de-tags.md`, seção 6 "passo a passo") passa a descrever o fluxo pela Esteira; o passo a passo manual vira referência de emergência.

## 8. Imagem `tools/agent-runner` (ADR-0012)

- Nova imagem no template rodando o Claude Code CLI (`claude -p`) com as definições de agente do projeto (`.claude/agents/review.md`, `security.md`, `tests.md`), modelo via OmniRoute (`ANTHROPIC_BASE_URL` + key em variável mascarada do grupo; nunca a assinatura) — ADR-0017.
- Jobs: `agent-code-review` e `agent-security` antes do `esteira-gate` (toda candidata nova / toda pipeline); `agent-qa` depois do primeiro deploy da candidata, por Destino, antes do `esteira-resultado`.
- Saída em JSON no formato de Análise (formato na spec E2). Respeitar o teto de custo por execução que a Esteira devolve no `esteira-abrir`.
- Substitui o princípio "nenhuma IA roda no CI" do README; o gate local em `feature/*` continua.

## 9. Toda MR referencia uma issue (Conferência de escopo)

- A Esteira cruza as issues declaradas na Entrega com as MRs mergeadas entre a última versão publicada e a candidata ("Closes #N" na MR ou número da issue no nome da branch).
- O template passa a recusar MR `feature/* → dev` sem issue referenciada (job no stage `review`, junto do gate de code review). Sem isso a conferência fica cega.
