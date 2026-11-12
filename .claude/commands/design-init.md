---
description: Conduz o início do design do frontend (fundação, sem spec) — confirma projeto novo ou existente, confere referências e ADRs (grill se faltar) e abre a sessão de design com o prompt já montado
argument-hint: "[novo|existente]"
---
Argumento: `$ARGUMENTS` (`novo` ou `existente` pula a detecção do passo 0, mas a confirmação continua). Rode da **raiz do workspace**. É uma **fundação**: não tem spec nem tickets (`docs/workflow.md`, "Fechar a fatia"), e nada é commitado nem mergeado por aqui. As ferramentas (`impeccable`, `ui-ux-pro-max-skill`) já vêm instaladas pelo agent de ambiente: **não instale nada**; se faltar, pare e diga ao humano para rodar a Etapa 2 do `local-environment-config`.

Cadeia a seguir, sempre: `docs/design/principios.md` (referência → direção com `ui-ux-pro-max-skill` → `/impeccable init` → implementação → `detect`/`audit`). `docs/design/tokens.md` é só o seed.

## 0. Novo ou existente — confirmar

Levante, sem alterar nada:

| Sinal | Aponta para |
|---|---|
| `<projeto>-frontend/src` com telas/rotas além do esqueleto do bootstrap | existente |
| `<projeto>-frontend` sem telas, só o bootstrap (ou nem existe) | novo |
| `DESIGN.md`/`PRODUCT.md` na raiz do front ou do workspace | **já tem design**: diga isso e pergunte se é para refazer ou só auditar; **não sobrescreva** sem o ok |
| linha `D0` (ou a fundação de design) no `specs/README.md` com Status `feito` | já tem design |

Mostre o que achou e **pergunte**: "Isto é um projeto **novo** ou **existente**?" com a sua recomendação. Só siga com a resposta do humano.

## 1. Referências — perguntar

Olhe `docs/referencias/visual/` (prints e `README.md`), `docs/referencias/*/` (referência funcional) e `docs/design/prototipos/`.

- **Achou:** liste (arquivo → o que o README diz para observar) e pergunte: "É isto? Falta alguma referência (prints, links, sistema para herdar)?"
- **Não achou:** pergunte se há prints, links ou um sistema para imitar, e diga onde guardar: aparência em `docs/referencias/visual/` com um `README.md` (direção pedida com data + "o que observar" por print); funcional em `docs/referencias/<sistema>/` (`telas/`, `codigo/`, README com o que **não** copiar).
- **Referência nova que o humano passar** (link, print colado, descrição): grave em `docs/referencias/visual/` com a linha do README. Não precisa commitar.
- "Não tenho referência" é resposta válida: siga, e a direção sairá do grill do passo 2.

Não avance sem resposta.

## 2. ADRs de design — conferir, grill se faltar

Procure em `docs/adr/` a decisão de **frontend** (stack, biblioteca de componentes) e a **direção de design** (tom, cor de marca, tipografia, como o status aparece). Confira também `docs/agents/padrao-frontend.md`: o que ele já fixa não precisa de ADR nova.

- **Cobertos:** diga quais ADRs valem e siga.
- **Falta algo:** rode o `/grill-with-docs` **aqui mesmo, na mesma conversa**, com esta pauta (uma pergunta por vez; "não sei, recomende" vale), e continue o fluxo quando ele fechar:
  1. tom: denso ou espaçoso, claro ou escuro, perfil (`dashboard`/`app-component` ou outro);
  2. cor de marca e o que mais tem cor (cor só com significado);
  3. tipografia (decisão explícita, nunca o default);
  4. como cada status aparece (nunca só por cor);
  5. o que **não** queremos (os "tells" de IA de `principios.md`);
  6. (existente) manter o visual atual ou evoluir.

  Grave a ADR do que divergir de `padrao-frontend.md` e o resumo da direção no `README.md` de `docs/referencias/visual/`.

## 3. Abrir o design — prompt montado

Monte o prompt abaixo **com os caminhos reais** das referências e ADRs que o passo 1 e 2 confirmaram (cite o arquivo; não escreva "as referências"). **Mostre o plano e espere o ok antes de alterar qualquer arquivo.** Depois conduza: o humano é entrevistado com perguntas e exemplos (opções de paleta, tipografia, densidade) em vez de você decidir sozinho.

### Novo

> Faça o design system do `<projeto>-frontend` (fundação, sem spec).
> Leia: `<referências confirmadas>`, `<ADRs de frontend e de design>`, `CONTEXT-MAP.md`, `docs/design/` (o `tokens.md` é só ponto de partida).
> Direção de design com a skill `ui-ux-pro-max-skill` a partir das referências; depois `/impeccable init` para gerar `DESIGN.md` e `PRODUCT.md`, usando o `tokens.md` como seed consciente. Mapeie os tokens para `src/styles.css` (`@theme` do Tailwind e as variáveis do spartan no `:root`). Nada de tema de fábrica do spartan intocado, nem fonte ou cor default sem decisão.
> Perfil `<perfil>`, tom `<tom decidido>`.
> Entregue uma página de amostra (cores, tipografia, espaçamento, botões, formulário, tabela, badges de status, estados vazio/erro/carregando) para eu aprovar. Pergunte-me e dê exemplos nas escolhas em aberto. Trabalhe numa branch; não faça merge.

### Existente

> Registre o design do `<projeto>-frontend` que **já existe** (fundação, sem spec). Não invente um visual novo nem reescreva telas.
> Leia: o código atual do front (estilos, tema, componentes em uso), `<referências, se houver>`, `<ADRs>` e `docs/design/`.
> Rode `/impeccable init` descrevendo o que está em uso hoje (cores, fontes, espaçamento, componentes) e gere `DESIGN.md` e `PRODUCT.md`. Alinhe `src/styles.css` para que os tokens existam como variáveis, sem mudar a aparência atual.
> Depois, com a app rodando (`npm start`, `http://localhost:4200`), rode `/impeccable detect` e `/impeccable audit` e entregue o relatório por prioridade (P0/P1). **Não corrija nada**: eu decido o que vira fatia.

Se no passo 2 o humano escolheu **evoluir** o visual de um projeto existente, use o prompt de "Novo" com as referências novas, depois do relatório do `audit`.

## 4. Fechar

- **Novo:** o humano sobe o front, abre a amostra e responde `aprovo` ou `ajuste: <o que mudar>` (volte ao passo 3 com o ajuste). Aprovado: aponte que a branch precisa ser **mergeada em `dev` por ele**, e que depois ele pede "marque a fundação D0 como feita no mapa" (fundação não tem issue; é o que deixa a próxima spec partir de uma base que existe).
- **Existente:** entregue o relatório e diga: cada grupo de achados que ele quiser corrigir vira linha do mapa (`/mapa`, depois `/mapa aplicar`) e segue a rotina por fatia (`/fatia`).

Termine com **Você agora** (a decisão que falta) e **Depois** (o próximo comando). Nunca comite, dê push, mergeie nem edite o `specs/README.md` sem pedido.
