# ADR-0018 — Trunk-based: `main` única e artefato por SHA

Status: Aceito · 2026-11-12 · **Refinada pela ADR-0025** (a Esteira fica fora do esquema de Entrega; SHA verde; merge sem squash) · Supera da ADR-0008 as MRs de promoção `release/<tag>` → `qa|hml|main` e as convenções de branch do `CLAUDE.md`/`docs/agents/esteira-deploy.md` · Troca "Candidata" por "Artefato" na ADR-0012 · Tira o merge `dev → qa` da ADR-0017 · **ADR-0021:** `dev` não existe (o Artefato percorre qa, hml e produção; o rollback em cascata cita `dev` só por herança); o Fluxo nasce antes do Artefato, na aprovação do review; a versão é `X.Y.Z` sem "v" e o hotfix soma o Z; hotfix e ordem superior usam o Atalho · **ADR-0022:** o qa não recebe deploy a cada merge e o Artefato oficial é gerado pela pipeline do Fluxo, não no merge

Só existem `main`, `feature/*` e `hotfix/*`. **Ambiente não é branch.** O artefato oficial (a imagem) nasce **uma vez**, no merge na `main`, é identificado pelo **SHA do commit** e é imutável; o mesmo artefato, por digest, percorre dev, qa, hml e produção. Não há `rcN`, nem branch `dev`/`qa`/`hml`. A versão `vX.Y.Z` é só um rótulo (tag git) aplicado a esse mesmo artefato quando ele vai para produção. Referência de conceito: `fundamentos-devops/0-conteudo/devops-cicd/ci-cd-fundamentos.md` (seção "O recomendado").

## Regras

- **MR:** `feature/*` → `main`. O CI do MR faz build, test e scan e gera um artefato **descartável** (ADR-0020), nunca o oficial. Como o alvo passa a ser a branch padrão, o `Closes #n` volta a funcionar.
- **Promoção:** `dev` e `qa` são automáticos a cada merge na `main`, com os gates da Esteira. `hml` e produção exigem **aprovação humana registrada na Esteira** (Entrega Contínua, não Implantação Contínua). A aprovação é sobre o **artefato**, não sobre um merge.
- **Hotfix:** só a pedido direto de um humano. `hotfix/*` a partir da `main`, MR para `main`, **mesmo pipeline**. Na aprovação o humano pode **pular `qa` e `hml` de forma explícita**, e a Esteira registra que pulou. Só é seguro por causa da ADR-0019 (flag desligado em produção, migração expand-only).
- **Rollback:** redeploy do **SHA anterior** (por digest, já no registry), **só no ambiente afetado**. A cascata `main → hml → qa → dev` acaba, porque esses ambientes não são branches. Só o humano executa. A correção na `main` vai depois, por MR (fix-forward ou `git revert`).
- **Repositórios da própria Esteira** (modo fallback da ADR-0008): mesmo modelo, mas a promoção é feita por **você**, com job `when: manual` no GitLab, sem o bot — senão uma Esteira quebrada não publicaria a própria correção.
- **Migração:** sem período de convivência dos dois modelos. A Esteira ainda não publica nada para terceiros, então conviver só custaria complexidade. Cada repositório vira de uma vez, depois que o `template-ci` novo existir. Roteiro em `pendencias-orchestration-ai.md`.

## O que continua valendo da ADR-0008

A Esteira é a única autoridade sobre publicar, fail-closed, `esteira-abrir`/`esteira-gate`/`esteira-resultado` com `id_token` do GitLab, política de severidade por Aplicação e Ambiente. O bot deixa de abrir MR `release/<tag>` e de cortar candidatas. Passa a disparar o play dos jobs de promoção depois da aprovação humana na Esteira, e a criar o rótulo `vX.Y.Z` na ida a produção.

## Considered Options

- **Gitflow** (`develop` + `release/*` + `main`): serve a quem precisa escolher exatamente o que entra em cada versão ou manter versões em paralelo. Nada na Esteira pede isso. Custa mais merges, release que diverge da develop e features mais tempo longe de produção.
- **Manter `dev → qa → hml → main` com tag `rcN`**: a imagem já era construída uma vez (o `template-ci` constrói na tag), mas o preço era o ritual: merge de tag entre branches, a regra crítica "`qa` nunca acima da tag", back-merge manual de correção nascida em `qa`/`hml` e uma branch por ambiente divergindo.

## Consequences

- Depende da ADR-0019: sem flag, "tudo na `main`" não se sustenta.
- O `template-ci` é reescrito no ponto mais acoplado: `controlar-pipeline.yml` (regras de `rcN`, origem da tag por ancestralidade, nomes de branch, rollback em cascata) e o gatilho do build, que sai da tag e vai para o merge na `main`.
- Hook, scripts e comandos que assumem `origin/dev` passam a assumir `origin/main`.
- A ADR-0009 (ocupação do Ambiente) e o glossário (Fluxo, Etapa, Candidata, Sincronização) precisam ser revistos. Ver `CONTEXT-MAP.md`.
