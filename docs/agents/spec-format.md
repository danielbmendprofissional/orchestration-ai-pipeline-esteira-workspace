# Formato de spec

Vale para o `/to-spec` neste repositório. **Substitui o template e o processo da skill** (Problem Statement, User Stories, "sem caminho de arquivo", "não entreviste", publicar a spec inteira na issue): onde a skill disser o contrário, vale este arquivo.

O humano pode chamar só `/to-spec` ou `/to-spec <ID ou nome da fatia>` (uma ou várias). Montar o resto sozinho é trabalho seu, nesta ordem:

## 1. Achar a fatia

- Com ID/nome: a linha dela em `specs/README.md`.
- Sem argumento: a **próxima desbloqueada** do mapa — primeira não feita cuja coluna "Depende de" está toda feita. Se houver mais de uma independente, proponha especificar juntas e pergunte.
- Várias fatias no mesmo pedido: **um arquivo e uma issue-mãe por fatia**, mesmo escritas na mesma sessão.
- Fatia que não está no mapa: pare e proponha a linha nova (repositório, quem executa, depende de) antes de qualquer spec.

## 2. Gate — pronto para especificar

Confira com `git`, não pela memória, e só depois de `git -C <repo> fetch origin` em cada repositório (e no workspace): `origin/main` local é a última sincronização, não o GitLab de agora. Cada fatia de "Depende de" está mergeada na `main` em cada repositório que tocou, e o que o `## Contexto necessário` vai citar existe na branch principal do workspace. Se não estiver, diga o que falta e pare — spec sobre base que não está na `main` vira retrabalho.

## 3. Juntar o contexto

Leia, nesta ordem, e só o que a fatia toca:
1. A linha da fatia e as vizinhas no mapa (o que vem antes e o que depende dela — define o que fica fora).
2. ADRs: as citadas na linha + as que mencionam a fatia ou o assunto (`grep` em `docs/adr/` pelo ID e pelos termos; a seção "Impacto" costuma dizer "vira spec").
3. `docs/agents/padrao-frontend.md` / `padrao-api.md` na parte que a fatia toca, e o `CONTEXT-MAP.md` pros termos.
4. O **código atual** de cada repositório tocado, na branch `main`: o que existe hoje e vai mudar, com arquivo e linha (é daí que sai o `## Checklist` ou o Backend/Frontend concreto). Mais `docs/PENDENCIAS.md` do repositório.
5. A última spec da mesma área em `specs/feature/`, como exemplo de nível de detalhe.

## 4. Perguntar só o que falta

Liste as decisões que a spec precisa e que nem ADR, nem padrão, nem código, nem a conversa respondem. **Nenhuma** → escreva direto. **Alguma** → pergunte uma por vez, com a sua recomendação, antes de escrever (é o grill, só sobre a lacuna). Decisão nova que vale além da fatia → proponha ADR.

## 5. Mostrar antes de publicar

Escreva o arquivo, mostre ao humano a Ideia (o que fica fora), a lista de critérios/checklist e o `risco`, e **pare**: a spec é o único documento que o humano aprova. Nada além do arquivo existe até o ok — nem issue, nem ticket —, então ajuste de spec não gera retrabalho. Grave a linha `base:` (`node .claude/scripts/check-spec-drift.mjs --stamp <spec>`): o sha de `origin/main` de cada repositório e do workspace em que a spec foi escrita. Só depois de aprovado abra a issue-mãe (título `<fatia> — <nome>`, ex.: `B2 — Result pattern + Problem Details`), atualize o mapa com o link da spec e o `#<mãe>` e **crie os tickets na sequência, sem pedir outra aprovação** ("Tickets de uma spec" em `issue-tracker.md`): cada filha declara `Cobre: <critérios>` e `.claude/scripts/check-tickets.mjs` confere que nenhum critério ficou sem filha. Só `risco: alto` mostra os tickets ao humano.

Antes do passo 1, feche as fatias já mergeadas (`docs/agents/orchestration.md`, "Fechar a fatia"); a linha delas vira "feito" neste mesmo commit de docs.

## Spec que já existe: conferir o desvio

Spec escrita em outro momento envelhece: o código ou as ADRs mudam na `main` depois dela. Antes de executar ou reaproveitar uma spec, rode `node .claude/scripts/check-spec-drift.mjs [<spec>]` (sem argumento: todas as pendentes do mapa). Ele compara a linha `base:` com `origin/main` e aponta commits novos, arquivos e tipos citados que **mudaram ou sumiram**; spec sem `base:` conta como velha. `⚠ desatualizada` → **revalide, não reescreva do zero**: releia só os arquivos apontados, atualize **só esses pontos da spec com `Edit`** (nunca `Write` do arquivo inteiro: custa minutos de geração e pode perder decisão que o humano já aprovou), mostre ao humano o que mudou (antes → depois) e peça o ok; com o ok, `--stamp` renova a base. Spec **sem `base:`** não é mais "velha por definição": o script estima a base pela data do último commit da spec e aponta o que mudou desde então; só sem commit da spec (arquivo novo, nunca commitado) ele não consegue estimar. `✔ em dia` → siga. O script mede só o código e as ADRs; decisão de produto que mudou continua sendo a leitura do humano ao aprovar.

## Arquivo

`specs/feature/<área>/NN-nome.md` é a **fonte de verdade**, versionada no workspace. Termos do `CONTEXT-MAP.md`; decisão transversal é citada pela ADR, não repetida.

```markdown
# NN — Nome da fatia

risco: baixo | alto   <!-- alto = toca auth, sessão, segredo, permissão, migração de banco ou dependência nova -->
flag: sim | não   <!-- padrão "sim" (nome Features:<Fatia>). "não" só para correção, refatoração, infra e migração expand-only; a Esteira trava essas Fatias na seleção da Entrega -->
preview: <módulo e rota de entrada>   <!-- obrigatório se a Fatia toca o front: a rota que o preview estático abre -->
base: workspace@<sha> · <projeto>-api@<sha> · <projeto>-frontend@<sha> · AAAA-MM-DD   <!-- gerada por `check-spec-drift.mjs --stamp`, nunca à mão -->

## Contexto necessário
- cada .md que o executor tem que ler (CONTEXT-MAP.md com a seção, ADRs, DESIGN.md e protótipos se tem tela, PENDENCIAS)

## Ideia
o que a fatia entrega e por quê, em poucas frases; o que fica de fora e em qual fatia entra

## Dados
## Backend
## Frontend
## Infra

## Critérios (EARS)
1. Quando <gatilho>, a <sistema> deve <resposta>.
2. Se <condição indesejada>, a <sistema> deve recusar (`codigo.do-erro`).
3. Enquanto <estado>, a <sistema> deve/não deve <comportamento>.

## Testes
por camada: o que cobre cada critério e onde (unitário, integração, API, front, E2E + axe nas telas novas)
```

- Seção que não se aplica fica escrita `N/A`, nunca omitida.
- **`risco`** é decidido por quem escreve a spec e confirmado quando o humano aprova. `alto` → o `/fatia` mostra os tickets antes de executar e o `/implement-task` roda o `security` sobre a fatia inteira; `baixo` → só spec e MR passam pelo humano.
- **Mapa (`specs/README.md`):** além de "Depende de", cada linha tem **"Toca em"** — módulos/pastas que a fatia altera (ex.: `api:Application/Auth`, `front:shell`). Duas fatias só rodam em paralelo se "Depende de" não as liga e "Toca em" não cruza.
- **Status:** a **primeira** coluna do mapa, sempre antes do `#`, pra ficar visível de relance (`feito` ou `—`). Mapa novo nasce com ela ali; mapa que a tenha em outro lugar, mova. Quem mantém é o `/fatia`, reconciliando com o git (MRs de todos os repositórios da fatia mergeadas na `main`) no commit de docs da próxima spec; nunca se edita à mão nem em commit avulso. O texto livre "Em dev: …" não existe mais — o status é a coluna.
- Caminho de arquivo e nome de tipo são permitidos (o executor precisa deles); trecho de código só quando fixa uma decisão melhor que texto.
- Cada critério EARS é testável e vira pelo menos um teste. Critério vago ("deve ser bonito") volta pro grill.
- **Concorrência:** fatia que grava agregado com token de concorrência (`xmin`/versão), reserva recurso com índice único ou faz "ler → decidir → gravar" leva um critério EARS próprio pra corrida: "Se duas requisições simultâneas <…>, a API deve aceitar uma e recusar a outra com `codigo.do-erro` (4xx), nunca 500." O critério vale para **todo** caminho que grava (handler, `UnitOfWork`, repositório com `SaveChanges` direto), não só o principal, e o teste é de integração com PostgreSQL real e barreira (duas chamadas de verdade). Não se aplica → `Concorrência: N/A` na seção Backend. É barato aqui e caro depois: na E1 a corrida só apareceu no review e custou duas rodadas de correção.
- Todo teste da fatia leva a **marca da fatia** (código do mapa, ex.: `B2`) — é o que liga a spec ao teste e deixa conferir, por script, se ela está de fato implementada. Formato por stack em `docs/agents/orchestration.md`, "Marca da fatia nos testes".
- Fatia de fundação/infra/limpeza troca `Critérios (EARS)` por `## Checklist` com `- [ ]`.
- **`flag:`** — toda mudança de comportamento percebido pelo usuário (tela nova, regra de negócio nova ou alterada, endpoint novo consumido pelo front) usa flag `Features:<Fatia>` (`docs/agents/padrao-api.md`, "Feature flags"). Correção de bug, refatoração, infra e migração expand-only declaram `flag: não`. Nome do flag = código da Fatia.
- **`preview:`** — a Fatia que toca o front declara o módulo e a rota que o preview estático abre; o agente `ui` cria a sessão falsa e os dados falsos dessa tela, tipados pelos tipos gerados do OpenAPI (dado fora do contrato quebra o build).
- **Fatia de limpeza** (`<código>-L`, ex.: `B2-L`): nasce da issue "Limpeza da Fatia <código>" que a Esteira cria quando o humano exclui uma Fatia (rótulo `ready-for-human`). O `/fatia`, rodado nessa issue, **cria a linha `<código>-L` no mapa** e a spec: remove o código e o flag da Fatia original, sem mudança de comportamento, com migração só `contract` se houver. `flag: não`. Segue o fluxo normal.
- **Fatia `api + frontend`:** coluna `Repositório` do mapa com o valor `api + frontend`; a `Depende de` entre as duas metades é a ordem API → front.

## Issue-mãe

No workspace (`docs/agents/issue-tracker.md`): título da fatia, link relativo pro arquivo + resumo de 2–3 linhas, label de área (`backend`/`frontend`). **Sem `ready-for-agent`** — quem recebe esse label são as issues filhas do `/to-tickets`.

Depois de publicar: na linha da fatia em `specs/README.md`, linkar o arquivo.
