# 03 — Ações do bot na MR

risco: alto   <!-- escreve no GitLab com o token do bot (escopo `api`), mergeia código na `main`, cria e apaga trigger token, e posta texto livre do humano numa MR -->
base: workspace@a20da2c · esteira-api@33a2447 · esteira-frontend@f6bf132 · 2026-11-23
flag: sim   <!-- reaproveita `Features:P2`: a P2b não cria flag próprio, é a fatia que deixa ligá-lo; a rota e o botão Reexecutar nascem atrás dele -->
preview: features/fatias — rota `/fatias`

## Contexto necessário
- CONTEXT-MAP.md (Fatia, Review da Fatia, Ação do bot, Papéis)
- docs/adr/0010-acoes-do-bot.md (a lista de Ações, retry com idempotência, "o nome do humano no texto"), 0021-esteira-autoridade-do-processo.md (Aprovar mergeia e comenta; Reprovar comenta e fecha; Reabrir), 0022-fatias-aprovadas-e-fluxo-por-selecao.md (review leve; preview estático; aprovar só mergeia), 0025-refinamentos-nomes-fatia-sem-flag-e-travas.md (API primeiro; a Esteira fora do esquema), 0008-esteira-decide-se-publica.md (token do bot, um por grupo, fail-closed)
- docs/adr/0003-erros.md, 0019-feature-flags-e-liberacao.md
- docs/agents/padrao-api.md (erros, flags, mensageria) e padrao-frontend.md (camadas, flags, preview)
- specs/feature/painel/02-review-e-aprovacao.md (a P2: `AcaoBot`, `AcaoBotPedida`, `RegistrarProgressoDaAcao`, permissões, flag `Features:P2`) · specs/feature/painel/01-painel-de-fatias.md (`IGitLab` só de leitura, instantâneo)
- docs/mudancas-infra.md (item 2: token do bot, `api` a partir da P2b) · docs/mudancas-template.md (processos `preview`, `preview-destroy`) · `template-ci/docs/pipeline-trunk-based.md` e `template-ci/README.md` ("Preview estático e limpeza", `fechar-fatia`)
- esteira-api/docs/PENDENCIAS.md · esteira-frontend/docs/PENDENCIAS.md (build `preview` só no ambiente de preview)
- docs/design/prototipos/prototipo-painel-fatias.html (linha Em revisão e gaveta) · esteira-frontend/DESIGN.md

## Ideia
A P2 **registra** a decisão e a Ação do bot; a P2b **executa**. O consumer de `AcaoBotPedida` lê a Ação, chama o GitLab como o bot do grupo e leva a Ação até `confirmada` ou `falhou` pelo `RegistrarProgressoDaAcao` que a P2 já entrega. É com a P2b que `Features:P2` passa a poder ligar ponta a ponta.

O que cada Ação faz no GitLab:
- **`abrir-review`**: no Projeto Angular, dispara a pipeline do template no processo `preview` sobre a branch da MR (nginx mínimo, sem API nem banco) e confirma quando a pipeline termina em `success`; no Projeto que não é Angular não há preview, e a Ação confirma sem chamar o GitLab (o review da parte de API é o contrato e os testes que a MR já rodou, ADR-0022).
- **`aprovar`**: confere que a MR segue aberta com a pipeline verde, **mergeia na `main`** (merge commit, sem squash, flag desligado) e comenta com o nome do humano.
- **`reprovar`**: comenta com o nome do humano e o comentário dele, e **fecha a MR**. Depois de confirmada, destrói o preview da Fatia.
- **Reabrir** existe só como capacidade da porta de escrita e do executor, com teste. Nenhuma rota nem botão a pede: quem reabre a MR continua sendo o `/implement-task`.

Decididas no `/fatia`:
- **Confirmação do `abrir-review` por consulta periódica** do status da pipeline, com prazo máximo. Sem webhook; a T1 depois troca a consulta pelo webhook sem mudar a Ação.
- **Falha da Ação:** o consumer repete sozinho as falhas transitórias do GitLab, com limite; esgotado, ou erro definitivo, a Ação vira `falhou` e a gaveta oferece **Reexecutar**, que cria uma Ação nova (tentativa + 1) para quem tem a mesma operação do pedido original.
- **Trigger token criado na hora:** o `preview` e o `preview-destroy` só rodam no template com origem `trigger`, não com o token do bot. O executor cria um trigger token do Projeto, dispara a pipeline e apaga o token em seguida. Nenhum segredo novo é guardado.

Fora desta fatia: webhook e tempo real (T1); rota ou botão para reabrir a MR; Entrega e Fluxo (E1); mergear MR de hotfix (E3c); os repositórios da própria Esteira, que ficam fora do esquema (ADR-0025); a criação do cluster `esteira-nao-prod`, do namespace `preview` e do domínio do preview (infra fora do mapa: sem eles o preview não sobe, e a P2b só entrega o código e o teste com GitLab falso); mudar o template-ci (já tem `preview`, `preview-destroy`, `limpeza` e `fechar-fatia`).

## Dados
Migration sobre a P2, **expand-only**, só colunas anuláveis em `AcaoBot`. Schema `esteira`.

| Entidade | Campos novos | Regras |
|---|---|---|
| `AcaoBot` | `PipelineId` (`long?`, só `abrir-review` de Projeto Angular), `ReexecucaoDeAcaoId` (`long?`, a Ação falhada que esta repete) | `PipelineId` é gravado quando o GitLab aceita criar a pipeline e é o que a consulta usa. A tentativa continua na chave de idempotência (`…:<tentativa>`); Reexecutar usa a próxima. As Ações já gravadas pela P2 ficam com os dois campos nulos |

O comentário do GitLab nunca é copiado para o banco; o texto do Reprovar continua só na `AcaoBot`.

## Backend
Em `Esteira.Application/Fatias/Decisoes/` (executor, regras) e `Esteira.AcL/GitLab/` (escrita no GitLab).

**Porta de escrita.** `IGitLab` **ganha** os métodos de escrita (a P2 dizia que ela era só leitura; a spec da P2 é o último lugar onde isso vale): ler a MR (estado, branch de origem, SHA da cabeça e pipeline da cabeça), comentar, fechar, reabrir, mergear, criar e apagar trigger token do Projeto, criar pipeline por trigger e ler o status de uma pipeline. Mesmos erros da P1 (`gitlab.bot-nao-configurado`, `gitlab.indisponivel`) mais os da tabela abaixo.

**Consumer de `AcaoBotPedida`.** Lê a Ação pelo `AcaoId`, faz `pedida → executando` pelo `RegistrarProgressoDaAcao` e executa. Mensagem repetida (reentrega) de Ação que já saiu de `pedida` não executa de novo. A Ação do front só passa a `executando` com a da API `confirmada`: o consumer só a retoma quando a da API confirma, e, se a da API falhou, ela já está `cancelada` (P2).

| Ação | Passos | `confirmada` quando |
|---|---|---|
| `abrir-review` (Projeto Angular) | lê a MR → cria trigger token (`descrição: esteira-acao-<chave>`) → cria a pipeline na branch da MR com `PIPELINE_PROCESS=preview` e `PREVIEW_FATIA=<fatia em minúsculo>` → apaga o trigger token → grava `PipelineId` | a consulta vê a pipeline em `success` |
| `abrir-review` (outro Projeto) | nenhum | na hora, sem chamar o GitLab |
| `aprovar` | lê a MR → exige aberta e pipeline `success` na cabeça → mergeia (merge commit, sem squash, sem apagar a branch de origem) → comenta | o GitLab devolve a MR `merged` |
| `reprovar` | lê a MR → exige aberta → comenta → fecha | o GitLab devolve a MR `closed` |

- **Estado encontrado no GitLab:** `aprovar` com a MR já `merged` confirma sem repetir; com a MR `closed`, falha (`gitlab.mr-nao-esta-aberta`). `reprovar` com a MR já `closed` confirma sem repetir; com a MR `merged`, falha. Isso cobre reentrega e o caso de alguém ter agido no GitLab antes.
- **Comentário da Ação:** abre com um marcador `<!-- esteira-acao:<chave> -->`; antes de comentar o executor procura o marcador na MR, para uma repetição não duplicar o comentário. O texto leva o **nome do humano** que decidiu. No `aprovar` o comentário vem **depois** do merge e, se falhar, só vai para o log: não desfaz o merge nem falha a Ação. No `reprovar` o comentário vem **antes** de fechar e é parte da Ação.
- **Texto do humano na MR:** o comentário do Reprovar entra em citação (cada linha com `> `), nunca solto, para que uma linha como `/merge` ou `/close` não vire ação rápida do GitLab executada como o bot; o nome também é neutralizado. O texto nunca vai para o log.
- **Preview e destruição:** depois de `aprovar` ou `reprovar` confirmada, para cada Projeto Angular da Fatia que teve `abrir-review`, o executor dispara o processo `preview-destroy` na `main` (mesmo trigger token na hora), **sem falhar a Ação** se isso falhar (o schedule `limpeza` do template apaga o vencido). O fechamento da Fatia no merge é do `fechar-fatia` do template, não da Esteira.
- **Consulta da pipeline:** serviço de fundo que, a cada `Review:IntervaloConsultaSegundos` (padrão 15), lê as pipelines das Ações `abrir-review` em `executando`. `success` confirma; `failed` ou `canceled` falha (`preview.pipeline-falhou`); passado `Review:PrazoMinutos` (padrão 30) desde o início, falha (`preview.prazo-esgotado`) e a pipeline é cancelada.
- **Retry:** erro transitório do GitLab (rede, timeout, 5xx, 429) repete com espera crescente, até `Bot:TentativasMaximas` (padrão 3). Esgotado, a Ação vira `falhou` com `gitlab.indisponivel`. Erro definitivo não repete.
- **Códigos de erro da Ação (`CodigoErro`):** `gitlab.indisponivel`, `gitlab.bot-nao-configurado`, `gitlab.sem-permissao` (401/403), `gitlab.mr-nao-encontrada` (404), `gitlab.mr-nao-esta-aberta`, `gitlab.ci-nao-verde` (a pipeline da cabeça deixou de ser `success` depois do pedido), `gitlab.merge-recusado` (conflito ou regra do projeto), `preview.pipeline-falhou`, `preview.prazo-esgotado`.
- **Trigger token:** apagado em todo caminho (sucesso, erro e cancelamento). Se apagar falhar, só log (sem o valor) e a Ação segue; no começo de cada `abrir-review` o executor apaga os trigger tokens com descrição `esteira-acao-*` mais velhos que uma hora. O valor do token nunca sai em resposta, log, erro nem auditoria.
- **Descarte do instantâneo:** já é do `RegistrarProgressoDaAcao` ao ir para `confirmada` ou `falhou`.

**Reexecutar.** `POST /api/v1/aplicacoes/{id}/fatias/{codigo}/acoes/{acaoId}/reexecutar`, 202 com as Ações criadas. Mesma operação do pedido original (`abrir-review`: AbrirReview; `aprovar` e `reprovar`: DecidirFatia), mesma regra de 404 sem papel e 403 `acesso.papel-insuficiente`, relê o estado fresco no GitLab como a P2, mesmo flag `Features:P2` (desligado: 404).
- Só vale para Ação em `falhou` que seja a **última** do tipo para aquela MR (`acao.nao-reexecutavel`, 409) e com a Fatia ainda Em revisão e a MR aberta (`fatia.sem-mr-aberta`, 409).
- Cria uma Ação `pedida` com tentativa + 1, `ReexecucaoDeAcaoId` apontando para a falhada, o mesmo comentário (Reprovar), auditoria e `AcaoBotPedida` no outbox na mesma transação. Se a falhada era a da API de uma Fatia `api + frontend` e a do front ficou `cancelada`, recria também a do front, dependendo da nova. Duplo clique cai na mesma chave.
- A decisão em andamento da P2 vale: com outra Ação da mesma decisão ainda viva, 409 `fatia.decisao-em-andamento`.

**Painel e gaveta** ganham, por Ação na gaveta, `podeReexecutar` (com o motivo quando não pode) e, na linha, `decisao = falhou` passa a dizer qual Ação reexecutar.

**Chaves de configuração novas:** `Bot:TentativasMaximas`, `Review:PrazoMinutos`, `Review:IntervaloConsultaSegundos`. O token do bot e a `Review:UrlModelo` já existem.

## Frontend
Mesma feature `features/fatias/`, só sob `data.feature: 'P2'`. Mudança pequena:
- Na **gaveta**, a seção Ações do bot ganha o botão **Reexecutar** nas Ações `falhou`, desativado com o motivo no `title` quando `podeReexecutar` for falso; o código do erro continua visível.
- Na **linha**, o texto "falhou, reexecutar na P2b" vira "falhou — reexecutar na gaveta", e o clique abre a gaveta.
- Depois do clique, o front mostra o 202 como estado e recarrega a lista uma vez (sem tempo real, T1). Erros de negócio (`acao.nao-reexecutavel`, `fatia.decisao-em-andamento`, `fatia.sem-mr-aberta`, `gitlab.indisponivel`) aparecem no aviso da gaveta com o texto da API.
- Texto vindo da API como texto, nunca `innerHTML`.
- **Preview:** a sessão falsa do `/fatias` ganha uma Fatia com Ação `falhou` (reexecutável) e uma com a Ação já reexecutada em andamento, tipadas pelos tipos gerados (`generate:api-types` depois da API).

## Infra
- **Token do bot com escopo `api`** e papel **Maintainer** nos projetos de código (precisa para mergear na `main` protegida e criar trigger token): `docs/mudancas-infra.md`, item 2, que já diz "`api` a partir da P2b". Pedido ao agent `local-environment-config`; sem ele, o consumer falha com `gitlab.sem-permissao` e nada mais.
- O preview ponta a ponta depende do cluster `esteira-nao-prod`, do namespace `preview` e do domínio (`PREVIEW_KUBE_CONTEXT`, `PREVIEW_DOMAIN`), infra fora do mapa; `Review__UrlModelo` só ganha valor quando existir.
- No Ambiente: `Bot__TentativasMaximas`, `Review__PrazoMinutos`, `Review__IntervaloConsultaSegundos`. `Features__P2` continua **desligado** até o humano ligar, depois do smoke manual (checklist).

## Critérios (EARS)
1. Quando uma Ação `aprovar` é pedida, o consumer deve conferir que a MR está aberta e com pipeline `success` na cabeça, mergear com merge commit (sem squash, sem apagar a branch de origem), levar a Ação a `confirmada` e comentar na MR com o nome do humano.
2. Se a MR deixou de estar com pipeline `success` entre o pedido e a execução, o consumer deve falhar a Ação com `gitlab.ci-nao-verde` sem mergear.
3. Quando uma Ação `reprovar` é pedida, o consumer deve postar o comentário do humano com o nome dele e depois fechar a MR, levando a Ação a `confirmada`; se o comentário falhar, não deve fechar a MR.
4. Se o comentário do humano trouxer uma linha como `/merge` ou `/close`, o consumer deve postá-lo em citação, de modo que o GitLab não o execute como ação rápida.
5. Quando uma Ação `abrir-review` de Projeto Angular é pedida, o consumer deve criar um trigger token do Projeto, criar a pipeline na branch da MR com `PIPELINE_PROCESS=preview` e `PREVIEW_FATIA` em minúsculo, apagar o trigger token e gravar o `PipelineId`.
6. Enquanto a pipeline do preview estiver em andamento, a Ação deve ficar `executando`; ao terminar em `success`, `confirmada`; em `failed` ou `canceled`, `falhou` (`preview.pipeline-falhou`); passado `Review:PrazoMinutos`, `falhou` (`preview.prazo-esgotado`) e a pipeline deve ser cancelada.
7. Quando uma Ação `abrir-review` é de Projeto que não é Angular, o consumer deve confirmá-la sem chamar o GitLab.
8. Quando a Ação `aprovar` ou `reprovar` é confirmada, o consumer deve disparar o `preview-destroy` da Fatia na `main` para cada Projeto Angular que teve `abrir-review`, sem falhar a Ação se esse disparo falhar.
9. Se o GitLab falhar de forma transitória (rede, timeout, 5xx, 429), o consumer deve repetir com espera crescente até `Bot:TentativasMaximas`; esgotado, a Ação deve ficar `falhou` com `gitlab.indisponivel`. Erro definitivo não repete e grava o código (`gitlab.sem-permissao`, `gitlab.mr-nao-encontrada`, `gitlab.merge-recusado`, `gitlab.mr-nao-esta-aberta`).
10. Quando a mesma mensagem chega de novo, ou o GitLab já mostra o resultado (MR já `merged` no `aprovar`, já `closed` no `reprovar`, comentário com o marcador da Ação), o consumer não deve repetir a escrita nem duplicar o comentário e deve confirmar a Ação.
11. Enquanto a Ação da API de uma Fatia `api + frontend` não estiver `confirmada`, o consumer não deve executar a do front; quando a da API confirma, deve executar a do front; se a da API falhar, a do front fica `cancelada` e não escreve nada.
12. Se o trigger token não puder ser apagado, o consumer deve registrar o fato sem o valor e seguir; no começo de cada `abrir-review`, deve apagar os trigger tokens `esteira-acao-*` com mais de uma hora.
13. Quando uma pessoa com a operação do pedido original pede **Reexecutar** de uma Ação `falhou` que é a última do tipo na MR, com a Fatia Em revisão e a MR aberta, a Esteira deve criar uma Ação `pedida` com tentativa + 1 e `ReexecucaoDeAcaoId`, auditar e publicar `AcaoBotPedida` na mesma transação, respondendo 202; se a falhada era a da API e a do front estava `cancelada`, deve criar também a do front dependente da nova.
14. Se a Ação não está `falhou`, não é a última do tipo na MR, ou já há Ação da mesma decisão viva, a Esteira deve recusar o Reexecutar (`acao.nao-reexecutavel` ou `fatia.decisao-em-andamento`); sem MR aberta ou Fatia fora de Em revisão, `fatia.sem-mr-aberta`; sem papel, 404; com papel mas sem a operação, 403 `acesso.papel-insuficiente`.
15. Quando o mesmo Reexecutar chega duas vezes seguidas, a Esteira não deve criar a segunda Ação e deve devolver o estado da primeira.
16. Enquanto `Features:P2` estiver ausente ou desligado, a rota Reexecutar deve responder 404 e o front não deve mostrar o botão.
17. Se o token do bot não estiver configurado, o consumer deve falhar a Ação com `gitlab.bot-nao-configurado`; o valor de nenhum token, nem o do bot nem o de trigger, pode aparecer em resposta, log, erro ou auditoria, e o texto do comentário nunca vai para o log.
18. Quando a gaveta é pedida, a Esteira deve devolver `podeReexecutar` por Ação com o motivo da recusa, e o front deve mostrar o botão **Reexecutar** só nas Ações `falhou`, desativado com o motivo no `title` quando não pode.
19. Quando o Reexecutar é aceito (202) ou recusado com erro de negócio, o front deve mostrar o estado ou o erro e atualizar a lista, sem oferecer nova decisão enquanto `decisao` ≠ `nenhuma`.
20. Quando uma Ação é confirmada ou falha, a Esteira deve descartar o instantâneo da Aplicação para que a próxima leitura mostre o merge, o fechamento ou o link do review.

## Testes
Todo teste leva a marca `P2b` (`docs/agents/orchestration.md`, "Marca da fatia nos testes"). Não há teste que chame o GitLab de verdade.
- **Domain/Application** (xUnit, NSubstitute para `IGitLab`): um teste por critério 1–3, 5–12 e 17, com a porta substituída; as transições e o `RegistrarProgressoDaAcao` já têm testes da P2 e só ganham os casos de reentrega (10). Regras do Reexecutar (13–15), em tabela por estado da Ação, papel e MR.
- **AcL** (`HttpMessageHandler` falso): o formato de cada chamada nova (MR, nota, fechar, reabrir, merge com merge commit e sem squash, criar e apagar trigger token, criar pipeline com as duas variáveis, ler pipeline), os códigos HTTP viram os erros da tabela, o texto em citação (4), o token fora de qualquer mensagem de erro e de log (17).
- **Integração** (Testcontainers + PostgreSQL, RabbitMQ/outbox, GitLab falso): mensagem → consumer → estado da Ação ponta a ponta; reentrega não repete a escrita (10); a Ação do front espera a da API (11); Reexecutar cria a Ação, a chave e a dependência na mesma transação (13, 15); migration expand-only.
- **API** (sessão simulada, `IGitLab` falso): 404, 403 e 202 do Reexecutar, flag desligado (14, 16), contrato OpenAPI da rota e do `podeReexecutar`.
- **Frontend** (Vitest + Testing Library): botão Reexecutar na gaveta e a linha com o novo texto, motivo no `title`, erro de negócio, flag desligado sem botão (16, 18, 19).
- **E2E** (Playwright, API simulada, tag `@P2b`): MOR abre a gaveta de uma Fatia com Ação `falhou`, clica Reexecutar e vê a Ação nova em andamento; Membro vê o botão desativado com o motivo; axe-core sem violação AA na gaveta.

## Checklist de entrega (fora dos critérios)
- [ ] **Smoke manual** com o GitLab de verdade num projeto de teste: Abrir review (depende do cluster `esteira-nao-prod`), Reprovar, depois reabrir pelo `glab` e Aprovar; só então ligar `Features:P2` e `Features:P1` nos ambientes.
- [ ] `docs/mudancas-infra.md`, item 2: registrar o pedido do escopo `api` e do papel Maintainer ao agent `local-environment-config` e marcar quando aplicado.
- [ ] `esteira-frontend/docs/PENDENCIAS.md`: fechar ou reapontar a pendência do build `preview` (só no ambiente de preview) conforme o que o template já garante (processo `preview` não roda em qa, hml nem produção).
- [ ] `docs/mudancas-template.md`: nada a mudar; se o smoke achar lacuna no `preview`, `preview-destroy` ou `fechar-fatia`, abrir issue no `template-ci` (`docs/agents/melhoria-orquestracao.md`).
- [ ] `esteira-api/docs/PENDENCIAS.md`: registrar o que ficou para a T1 (webhook no lugar da consulta) e para uma fatia futura (rota e botão de reabrir a MR).
