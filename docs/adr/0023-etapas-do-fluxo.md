# ADR-0023 — Etapas do Fluxo: Abertura, QA, HML, PRD e Liberação

Status: Aceito · 2026-11-15 · **ADR-0025:** nomes novos ("Pronta para Entrega", "Aguardando liberação"), Fatia sem flag, limpeza e bloqueio de Entrega · Substitui a lista de Etapas do `CONTEXT-MAP.md` (ABER → AET-1 → DEV → QA → HML → AAN → AET-2 → PRD) · Refina a ADR-0021 (DAST e verificações depois do deploy)

A **Entrega** é o processo que o humano abre; cada **Fluxo** (a faixa de um Projeto dentro dela, ADR-0022) percorre as etapas abaixo. A Abertura é da Entrega; QA, HML e PRD são de cada Fluxo; a Liberação é por Fatia, na tela da Entrega. Cada etapa só começa depois da anterior e tem um ato humano claro.

## Etapas

1. **Abertura** (Painel de Fatias, aba "Prontas para Entrega"): um humano seleciona N Fatias Prontas para Entrega, de qualquer mistura (API, front ou as duas), e declara o **tipo da mudança de cada Fluxo** (minor por padrão, major por marcação). A Esteira abre a Entrega e um Fluxo por Projeto tocado; ainda não há Artefato.
2. **QA:** a pipeline do Fluxo gera o Artefato sobre o SHA mais recente da `main` e faz um deploy único no `qa`, com os flags das Fatias selecionadas **ligados no `qa`**. Rodam o DAST ativo e o agente de qa. O **aprovador técnico aprova o qa** olhando os resultados.
3. **HML:** a Esteira faz o deploy do **mesmo Artefato** no `hml`, com os flags ligados, e roda o DAST passivo. O aprovador aprova o `hml` para liberar a ida a produção.
4. **PRD:** o Publicador confirma. A tela mostra a **versão `X.Y.Z` calculada** e os flags que o Artefato carrega; ele pode corrigir o tipo antes de confirmar. A Esteira faz o deploy em produção com **todos os flags desligados** e aplica a versão. Depois do deploy roda **só a verificação técnica de que subiu** (rollout e health), que informa se é caso de rollback.
5. **LIB (Liberação):** na tela da Entrega, o aprovador de negócio **seleciona as Fatias que vai liberar**; a Esteira liga os flags delas em produção e roda smoke e ZAP passivo **uma vez, para o conjunto**. Só então a feature chega ao usuário. As Fatias não selecionadas ficam **aguardando liberação** (código em produção, flag desligado) e vão para o menu de **Aguardando liberação**. A Entrega termina aqui. Uma Fatia `api + frontend` só pode ser liberada quando os dois Fluxos dela estão em produção.

## Regras

- **Smoke e ZAP passivo em produção rodam depois da Liberação**, quando o flag expõe a feature. Antes disso testariam o mesmo código de antes. O resultado só alerta e nunca reverte sozinho; o alerta se trata desligando o flag (sem deploy, ADR-0019) ou com hotfix ou nova Fatia.
- **Atalho e hotfix** continuam como na ADR-0021: o Publicador pula `qa` e `hml`, com o nome de quem ordenou e o motivo registrados. O hotfix é uma Entrega de tipo hotfix, de um Projeto só, com o Atalho **opcional** e sem seleção de Fatias; o pedido, a correção e a MR vêm antes da Entrega, que só abre depois da MR na `main` (ADR-0027).
- **A AET-1 sai:** a aprovação técnica da proposta já acontece na **aprovação da spec**, antes de qualquer código.
- **A AET-2 deixa de ser etapa:** a aprovação do `hml` e a confirmação do Publicador cobrem esse papel.
- **A AAN passa a ser a Liberação**, depois do deploy em produção, e não mais antes.
- **Fatias aguardando liberação** (antes "publicadas, não liberadas"): num menu à parte, o aprovador pode **liberar** ou **excluir** em outro momento. Liberar assim **não roda smoke nem ZAP**: esses recursos são do Fluxo, gastá-los por uma Fatia só não compensa, e liberar dessa forma é conta e risco de quem escolhe, registrado com o nome dele. Excluir é o Cancelamento da ADR-0019 (o flag segue desligado e a limpeza é uma Fatia). Estratégias de review e segurança para essas Fatias em produção ficam para depois.

## Excluir uma Fatia

A Esteira não escreve spec nem issue-mãe (isso é dos comandos), e a limpeza de uma feature que já está na `main` é uma **Fatia** com spec e tickets, nunca um commit solto (ADR-0019). Então:

1. O humano clica **Excluir** numa Fatia aguardando liberação (ou numa pronta para Entrega que não quer mais). Fatia sem flag excluída bloqueia a abertura de Entrega nova do Projeto até a limpeza ser mergeada (ADR-0025).
2. A Esteira pede um **motivo** e registra o cancelamento com o nome dele. A Fatia fica **Excluída**, e o flag segue desligado.
3. A Esteira cria no GitLab uma **issue de pedido**, "Limpeza da Fatia <código>", com o motivo e os links, e o rótulo `ready-for-human`. A Fatia de limpeza tem o código `<código>-L`, e o `/fatia` cria a linha dela no mapa (ADR-0025).
4. O humano roda o `/fatia` nessa issue quando quiser, e a limpeza segue o fluxo normal. Até lá o código fica na `main`, inerte.

## Dependência entre Projetos

Uma feature que atravessa Projetos (API e front) é uma **Entrega** com um Fluxo por Projeto, e a ordem vem da coluna **`Depende de`** do mapa de fatias, que a Esteira lê. Só o Fluxo do front espera; o da API nunca espera o do front.

- **Abertura da Entrega:** se uma Fatia selecionada depende de uma Fatia de API que ainda não está na `main`, a Esteira avisa e **impede** de abrir. Se a da API está na `main` mas ainda não foi publicada em produção, avisa e deixa abrir (o front pode estar em qa enquanto a API está em hml).
- **Produção:** o Fluxo do front só confirma produção se a API de que depende já está lá (a regra do workspace "API retrocompatível, promovida antes").
- **Liberação:** a Esteira **bloqueia ligar o flag** de uma Fatia enquanto a Fatia da qual ela depende não estiver **liberada** em produção, e a mensagem diz qual é e onde liberar. A tela da **Entrega** tem o botão **"liberar os dois Fluxos"**, que liga a API e depois o front na mesma ação, na ordem certa.
- **O Atalho não pula essa trava.** Ela é de integridade (uma tela chamando um endpoint que não existe), não de teste. Na ordem superior usa-se o botão de liberar os dois Fluxos.

## Versão

- **Declaração:** na Abertura, o campo **Tipo da mudança** começa em **minor** (funcionalidade ou ajuste). Uma opção, desligada por padrão ("esta mudança quebra compatibilidade com a versão anterior?"), troca para **major**; a tela mostra a versão resultante ao lado. No hotfix não há campo: é patch.
- **Sem buracos na numeração:** o número `X.Y.Z` (sem "v") **só nasce na confirmação em produção**, calculado a partir da **maior versão já publicada**, mesmo depois de um rollback (o número de uma versão revertida fica no histórico e nunca é reaproveitado). Fluxo que desiste antes de produção não gasta número.
- **Tipo de Fluxo desistido:** só passa adiante se o código ficou (Cancelamento **absorver**, ADR-0019). Se foi **reverter**, a Fatia de limpeza remove o código e o tipo some junto.
- **Cálculo:** minor soma 1 no Y e zera o Z; major soma 1 no X e zera Y e Z; hotfix soma 1 no Z. O Publicador vê o resultado e pode corrigir o tipo antes de confirmar.

## Papéis por etapa

- **Abrir a Entrega (selecionar as Fatias):** Membro.
- **Aprovar a MR da Fatia, o qa e o hml:** Aprovador técnico.
- **Confirmar produção e usar o Atalho:** Publicador.
- **Liberar Fatias (na LIB e no menu de não liberadas) e excluir:** Aprovador de negócio.
- **MOR:** pode tudo em todas as Aplicações. Quem abriu o Fluxo não aprova as etapas dele, exceto o MOR, e aí fica marcado como **autoaprovação**, com motivo obrigatório (regra já existente).

## Estados

**De cada etapa:** Não iniciado, Executando, **Aguardando aprovação** (o trabalho automático terminou e espera um humano com o papel; é aqui que o botão de aprovar aparece), **Bloqueada** (o gate de segurança barrou por achado crítico ou alto sem Exceção; saídas: corrigir, pedir Exceção ou usar o Atalho), **Pulada** (o Atalho passou por cima; mostra o nome de quem ordenou e o motivo), **Falhou** (erro técnico de deploy ou pipeline; oferece reexecutar), Concluído e Cancelado.

**Do Fluxo, no topo da tela:** **Em fila** (hml ou produção ocupado por outro Fluxo do mesmo Projeto), **Superado** (um Artefato mais novo tomou o qa antes da aprovação) e **Em rollback** (o Projeto voltou ao Artefato anterior; nada novo entra até a correção).

**Da Entrega:** derivado dos Fluxos, calculado pela Esteira (nunca escolhido à mão). A tela mostra **um estado só**, o mais urgente, nesta ordem: **Em rollback** (algum Fluxo voltou ao Artefato anterior); **Bloqueada ou com falha** (gate de segurança ou erro técnico em algum Fluxo); **Aguardando aprovação** (algum Fluxo espera um humano; a lista mostra de quem é a vez: Você, Técnico, Publicador ou Negócio); **Em andamento**; **Em fila** (todos os Fluxos esperam vaga no hml ou na produção); **Publicada, aguardando Liberação** (todos os Fluxos em produção, Fatias ainda não liberadas); **Concluída** (Liberação feita; as Fatias não selecionadas seguem no menu de publicadas não liberadas); **Cancelada** (reverter ou absorver, ADR-0019); **Superada** (um Artefato mais novo tomou o `qa` antes da aprovação: a Entrega é encerrada e suas Fatias **voltam para "Prontas para Entrega"**, com a marca "vinha de uma Entrega superada"). Filtros da lista: **Abertas** (os seis primeiros), **Concluídas** e **Canceladas** (cancelada e superada).

A tela mostra a barra das cinco etapas com o estado de cada uma e, embaixo, o painel da etapa ativa com os resultados e o botão de aprovar para quem tem o papel.

## Em aberto

- ~~Como o "excluir" vira a Fatia de limpeza~~ **Resolvido** (seção "Excluir uma Fatia").
- **Desenho das duas telas** (a decisão de estados da Entrega está em "Estados"), que partem dos protótipos `prototipo-abrir-entrega.html` e `prototipo-entrega.html` já aprovados, trocando issues por Fatias e tirando as etapas que deixaram de existir.
- **Desenho visual da tela do Fluxo** (a decisão de estados está em "Estados" abaixo; o layout fica para a etapa de protótipo).
- ~~Feature que atravessa Projetos~~ **Resolvido** na seção "Dependência entre Projetos". O Atalho não pula a trava (confirmado).
