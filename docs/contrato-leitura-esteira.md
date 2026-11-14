# Contrato de leitura da Esteira (v1)

Status: rascunho para aprovação · 2026-11-12

A Esteira mostra ao humano o acompanhamento das fatias **lendo** o que os comandos e agentes já produzem. Este documento é o contrato entre os dois lados: **quem escreve** (`/fatia`, `/implement-task`, o CI, o `check-spec-drift`) e **quem lê** (a Esteira). Os comandos continuam trabalhando sobre markdown, git e GitLab; a Esteira é a camada visual do humano.

## Princípios

1. **Duas camadas, uma direção.** Máquina (markdown, git, issues, bloco de execução) é a fonte de verdade. A Esteira **só lê**; nunca edita spec, issue, MR nem o bloco. Ela guarda apenas o que é dela: aprovações, deploys, análises, flags, auditoria.
2. **Sem cópia.** A Esteira guarda o código da fatia e o número da issue, e lê o resto quando precisa. Nada de título ou status da issue duplicado no banco dela.
3. **O leitor é tolerante.** Linha desconhecida é ignorada. Peça ausente aparece como "não disponível". Formato quebrado nunca derruba a tela.
4. **O escritor é cuidadoso.** O que está na tabela abaixo é estável. Mudança que só **acrescenta** é livre. Mudança que **altera ou remove** é uma nova versão do contrato.

## O que a Esteira lê (v1)

| # | Peça | Onde | Formato que a Esteira entende | Origem do formato |
|---|---|---|---|---|
| 1 | **Mapa de fatias** | `specs/README.md`, tabela "Mapa de fatias" | Colunas, nesta ordem: `Status`, `#`, `Fatia`, `Repositório`, `Quem executa`, `Depende de`, `Toca em (estimado)`. Status observado: `feito` ou `—`. A célula `Fatia` traz título, link para a spec (`[arquivo](caminho)`) e ` · #<mãe>`. | `specs/README.md` |
| 2 | **Spec** | `specs/feature/<área>/NN-nome.md` | Título `# NN — Nome`. Linha `risco: baixo \| alto`. Linha `base: …` (gerada por `--stamp`). Seção `## Contexto necessário`. O restante é markdown livre, exibido como está. | `docs/agents/spec-format.md` |
| 3 | **Issue-mãe** | GitLab, repositório do workspace | Título `<fatia> — <título>` (ex.: `B2 — Result pattern + Problem Details`). Label `em-execucao` enquanto roda. Filhas como *Child items*. | `orchestration.md`, "Nomes" |
| 4 | **Issue filha (task)** | GitLab | Título `<fatia>.<N> — <título>` (ex.: `B2.5 — …`). Descrição começa com `Part of #<mãe>`, depois `Blocked by: #n, #n` (ou `Blocked by: —`) e `Cobre: <critérios>`. Labels `backend`/`frontend` e `ready-for-agent`. | `issue-tracker.md` |
| 5 | **Bloco de execução** | Descrição da issue-mãe, entre `<!-- execucao -->` e `<!-- /execucao -->` | Ver abaixo. | `.claude/commands/implement-task.md`, passo 6 |
| 6 | **Branch** | Cada repositório de código tocado | `feature/<fatia minúscula>-<slug>` (ex.: `feature/b2-result-e-problem-details`). | `orchestration.md`, "Nomes" |
| 7 | **Commit de task** | Git | `<tipo>: <o que fez> (<fatia>.<N> · workspace#<filha>)`, trailer `Executed-by: <executor>`. Correção de MR: `fix: … (B2.N · workspace#<filha>)`. | `implement-task.md`, passos 7 e 1 |
| 8 | **Marca nos testes** | Código de teste | .NET `[Trait("Fatia","B2")]`; Vitest `describe('[B2] …')`; Playwright `tag: '@B2'`. Sempre o código da **fatia**, nunca o da filha. | `orchestration.md`, "Marca da fatia nos testes" |
| 9 | **MR** | GitLab | Título `<fatia> — <título da mãe>`; branch de origem do item 6. | `orchestration.md`, "Nomes" |
| 10 | **Prova do gate local** | Raiz do repositório de código | `.code-review-ok.json` | ADR-0017 |

### Bloco de execução (item 5), formato exato

```markdown
<!-- execucao -->
### Execução
**Área:** `<caminho>` · **Modo:** Claude | pago | free · **Início:** 2026-10-25
- [x] B2.1 #4 — `0b4bd79` · pai (Claude)
- [x] B2.2 #5 — `3fa91c2` · backend (omni-pago) · review PASS
- [ ] B2.3 #6 — em andamento · pai (Claude)
- [ ] Suite completa
- [ ] Review
- [ ] MR
<!-- /execucao -->
```

O que a Esteira extrai:

- **Cabeçalho:** `Área`, `Modo`, `Início`.
- **Cada linha de task:** `[x]` ou `[ ]`, o código `<fatia>.<N>`, o `#<issue filha>`, e o resto da linha como detalhe (sha entre crases, executor entre parênteses, `review PASS`, ou `em andamento`).
- **Linhas finais** `Suite completa`, `Review`, `MR`: só o estado `[x]`/`[ ]`.

Qualquer linha que não casar com isso é **ignorada**, e o bloco inteiro ausente significa "ainda não começou".

## Links para o GitLab (a Esteira monta, não guarda)

Os três lugares já se ligam pelo código da fatia (`B2`), pela filha (`B2.3`) e pelo `workspace#<filha>` do commit. Então a Esteira **monta o link na hora de mostrar**, a partir de dados que já lê. Nenhum link é salvo no banco dela (princípio 2).

A base vem do cadastro da Aplicação (A1): URL do GitLab e o caminho de cada Projeto (`<grupo>/<projeto>-workspace`, `-api`, `-frontend`).

| Quero abrir | Montado de | Link |
|---|---|---|
| A **spec** | caminho do arquivo no mapa (item 1) | `<workspace>/-/blob/main/<caminho da spec>` |
| A **issue-mãe** ou a **filha** | `#<n>` do mapa ou do bloco de execução | `<workspace>/-/issues/<n>` |
| O **código de uma task** | o `sha` da linha da filha no bloco (item 5); cada task é um commit | `<repo>/-/commit/<sha>` |
| **Tudo o que a fatia mudou** | a branch `feature/<fatia>-<slug>` (item 6) | `<repo>/-/compare/main...feature/<fatia>-<slug>` |
| A **branch** | item 6 | `<repo>/-/tree/feature/<fatia>-<slug>` |
| A **MR** | procurada pela branch de origem (item 9) | `<repo>/-/merge_requests/<iid>` |
| Os **commits das tasks** de uma fatia | trecho `<fatia>.<N> · workspace#<filha>` (item 7) | lista de commits da branch filtrada por esse texto (**a confirmar** o parâmetro de busca no GitLab) |

Pontos de atenção:

- **`<repo>` depende de qual repositório a task tocou.** A label `backend` ou `frontend` da filha (item 4) diz se é `-api` ou `-frontend`. Fatia que toca os dois tem dois links.
- **Hoje o alvo da MR é `dev`; com a ADR-0018 vira `main`.** O link `compare` usa a base atual do repositório, e só muda na migração.
- **Task sem `sha` ainda** (linha "em andamento") não tem link de commit. A Esteira mostra o link da branch no lugar.
- Link é só navegação: a Esteira abre o GitLab em outra aba e não embute nem edita nada de lá.

## Fatias e tasks antigas (anteriores ao padrão)

O padrão evolui a cada implementação, então parte do histórico está em formato antigo, e **o contrato não exige migrar nada**. A regra é de leitura:

1. **Formato reconhecido** → a Esteira mostra a peça completa.
2. **Formato antigo ou parcial** (ex.: spec sem `risco:`/`base:`, issue sem `Cobre:`, fatia sem bloco de execução) → mostra o que conseguir e marca a peça como **"formato anterior ao padrão"**, sem erro e sem esconder a fatia.
3. **A Esteira não corrige o legado.** Quem decide atualizar uma fatia antiga é você, quando mexer nela de novo.
4. **O padrão vale a partir da próxima fatia que usar o contrato.** O que já está feito continua feito.

## Regras de mudança

1. **Acrescentar é livre.** Nova coluna no fim do mapa, nova linha de detalhe no bloco, novo campo no cabeçalho: o leitor ignora o que não conhece.
2. **Alterar ou remover é quebra.** Renomear coluna, mudar o formato de `<fatia>.<N>`, trocar os marcadores `<!-- execucao -->`, mover o bloco, mudar o padrão de branch ou de commit: pede **versão nova do contrato** (v2).
3. **Quebra e ajuste do leitor andam juntos.** Quem muda o formato atualiza **este documento e as fixtures** (abaixo) na mesma MR. A Esteira aceita v1 e v2 ao mesmo tempo durante a transição (mesmo princípio da ADR-0013 para a pipeline).
4. **Cada comando que escreve um desses formatos aponta para este documento.** O comando dono do formato carrega a obrigação de manter o contrato.

## Como o contrato é verificado

- **Fixtures reais** no repositório da Esteira (`esteira-api`, pasta de testes): o mapa de fatias, o bloco de execução, um título de mãe, uma filha e um commit, copiados de casos reais (ex.: a B2). O parser da Esteira tem teste contra cada fixture.
- **Teste de contrato** em cada formato: o que o escritor gera hoje tem que ser lido hoje. Se o formato mudar sem a fixture mudar, o teste do lado do `ai-base` ou da Esteira falha.
- **Onde cada teste mora** é decisão de implementação da fatia que construir o leitor. Esta versão do contrato só exige que existam.

## Fora do contrato (livre)

O texto das seções da spec, o texto da descrição da issue fora do bloco de execução, os comentários de MR e o conteúdo dos commits fora do padrão acima. A Esteira pode mostrar, mas **não interpreta**.

## Pontos ainda abertos

- A coluna `Status` do mapa só mostrou `feito` e `—` nas linhas lidas, e o legado pode ter outros valores. **Não bloqueia:** valor desconhecido é exibido como texto, conforme a regra das fatias antigas. Quem implementar o leitor lista os valores reais que encontrar.
- O parâmetro de busca de commits por texto na URL do GitLab (link da última linha da tabela de links) não foi verificado. Se não existir, o link cai para a lista de commits da branch.
- A versão do contrato dentro do bloco de execução (`**Contrato:** v1`) seria um campo **novo e aditivo**. Fica opcional enquanto a v1 é a única.
- Os formatos acima moram em arquivos do `ai-base` (comandos e docs). Por isso a obrigação do item 4 das regras vira issue no `ai-base`: ver `pendencias-orchestration-ai.md`, seção 10.
