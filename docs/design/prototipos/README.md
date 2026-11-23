# Protótipos da Esteira — referência visual

Protótipos HTML aprovados nas fatias **D0** (design system e telas do modelo antigo) e **D1** (telas do modelo trunk-based: Fatia → Entrega → Fluxo → Liberação, ADR-0021 a 0025). São a **referência visual** para as specs e para quem implementa as telas. Não são código de produção: dados fictícios, JavaScript simples, sem Angular nem spartan.

Para ver: abra qualquer `prototipo-*.html` no navegador. Precisa de internet só para carregar as fontes (Google Fonts). Os protótipos têm um seletor **"Ver como"** que troca a pessoa logada e mostra o que cada papel vê e pode fazer. Alguns também têm um seletor de **cenário** (a Abertura e a Entrega mostram as travas e os estados).

## Telas

| Arquivo | Tela | O que mostra |
|---|---|---|
| `prototipo-painel-fatias.html` | Painel de Fatias (D1) | As 7 abas da ADR-0024, badge de estado da Fatia, seleção para abrir Entrega (Fatia sem flag travada), review e aprovar a MR, gaveta de Liberar e Excluir com links do GitLab, filtros (Aplicação com busca, Fatia, Projeto) e paginação com janela. Com 300 Fatias de teste. |
| `prototipo-abrir-entrega.html` | Abrir Entrega (D1) | Confirma as Fatias vindas do Painel, tipo da mudança por Fluxo (minor ou major, versão prevista), hotfix de um Projeto só, resumo com os blocos "Vão junto", "MRs sem Fatia" e "Limpezas pendentes". Cenários: dependência fora da main, dependência não publicada, main vermelha, limpeza pendente. |
| `prototipo-entrega.html` | Entrega (D1) | Mapa de etapas com uma faixa por Fluxo (Abertura, QA, HML, PRD, Liberação), estados da etapa e da Entrega, Atalho, Liberação por Fatia, Excluir. 10 cenários: normal, em fila, superada, gate bloqueou, falha, aguardando o Publicador, aguardando Liberação, hotfix, rollback, cancelada. |
| `prototipo-pedir-hotfix.html` | Pedir hotfix (D1) | Aplicação, Projeto, motivo e **quem executa** (o agente ou você). A Esteira cria a issue `Hotfix: <motivo>` nos dois casos. Mostra os próximos passos de cada caminho. |
| `prototipo-aguardando.html` | Aguardando você | Decisões, Para corrigir, Para acompanhar. **Versão de celular** (abaixo de 760 px): folha de decisão com a evidência na frente. O link do e-mail (`#item=<id>`) abre essa folha. |
| `prototipo-entregas.html` | Entregas | Lista paginada com as cinco etapas por Fluxo e os estados da ADR-0023, filtros Abertas, Concluídas e Canceladas, e painel com indicadores e gráficos. |
| `prototipo-aplicacoes.html` | Aplicações | Lista e detalhe com abas Projetos, Ambientes e destinos, Política de segurança (Review só avisa; QA, HML e produção bloqueiam), Pessoas e papéis. |
| `prototipo-excecoes.html` | Exceções | Lista por estado, detalhe com aprovar, reprovar, renovar e revogar, e o pedido que nasce do achado. |
| `prototipo-auditoria.html` | Auditoria | Linha do tempo só de leitura, com antes e depois de cada alteração. Categoria Fatias. |
| `prototipo-fontes.html` | Escolha da fonte | Comparação das 5 opções avaliadas; a escolhida está marcada. |
| `logo-cao.html` | Logo | Logo aprovado. |

`base.css` (estilos) e `comum.js` (ícones, menu lateral, fonte) são compartilhados por todas as telas.

## Decisões visuais

- Fundo preto/grafite. Azul `#0A4EE4` só em marca, ação principal e seleção.
- Fonte: **Mona Sans** no texto e **Geist Mono** em código (versões, hashes, regras).
- Ícones de status no estilo do GitHub Actions; status nunca só por cor.
- Abas logo abaixo do cabeçalho do bloco.
- Botões de ação fora do bloco, no canto inferior direito. Reprovar, Cancelar e Excluir à esquerda da ação principal. Sem texto explicativo ao lado do botão: o motivo de um botão desativado vai no `title`.
- Avisos no sino do topo.
- Histórico nunca dentro da tela: só um link "ver na auditoria", que abre a Auditoria já filtrada.
- Listas paginadas e enxutas, com o detalhe ao passar o mouse ou numa gaveta lateral. Edição de cadastro sempre em gaveta, não em campos abertos na tabela.
- Gráficos com azul `#2D6BFF` e laranja `#D9732A` (verde × vermelho reprova para daltonismo).
- Responsivo de 2560 a 320 px: conteúdo limitado a 1680 px e centralizado; menu vira só ícones abaixo de 1100 px e barra no topo abaixo de 760 px.

### Decididas na D1

- **Estado da Fatia:** badge pequeno com ícone e texto, sem barra de progresso. Neutro (Planejada, Com spec, Excluída riscada, Liberada com confirmado em cinza claro), azul (Em execução, Em revisão, Em Entrega) e âmbar (Pronta para Entrega, Aguardando liberação). O progresso é texto na linha.
- **Aplicação com 50 apps:** seletor com busca e várias escolhas (Recentes, contagem, 8 por vez), nunca um `select` com a lista inteira. Paginação com janela de páginas (`1 2 … 5 6 7 … 59 60`), "Ir para" e "Por página".
- **Liberação:** gaveta lateral com Notas de entrega, Fatias com caixa por Fatia e links do GitLab (issue, MR, commit, só o que existir), ordem API e depois front, **Liberar selecionadas** à direita e **Excluir** (reverter ou absorver, com motivo) à esquerda.
- **Conferência de escopo:** no resumo da Abertura, em blocos recolhidos de uma linha ("Vão junto, com o flag desligado", "MRs mergeadas sem Fatia", "Limpezas pendentes do Projeto"). Só avisam, nunca bloqueiam.
- **Celular:** só o Aguardando você ganha desenho próprio (folha de decisão com botões grandes). O e-mail leva por link a essa folha, já logado, e **nunca aprova direto**. As outras telas só não quebram ao estreitar.
- **Diálogos Aprovar e Reprovar do Painel (P2):** não existem nos protótipos. O desenho nasceu no agente `ui`, com spartan/ui e as regras do `DESIGN.md` (Aprovar lista as MRs, API primeiro; Reprovar pede o Comentário com contador de 2000 caracteres); o humano valida na MR da P2.

## Regras de negócio decididas junto com as telas

Ainda não estão todas nas specs; entram nelas na próxima etapa.

- **Abrir Entrega:** o tipo da mudança de cada Fluxo começa em **minor**; "esta mudança quebra a compatibilidade?" troca para **major**. A versão mostrada é **prevista**: o número definitivo só nasce na confirmação em produção, sobre a maior versão já publicada (ADR-0023). No hotfix (**ADR-0027**): um Projeto só, PATCH+1, sem seleção de Fatias. O hotfix tem uma fase **antes** da Entrega: o pedido (tela Entregas, **Pedir hotfix**), a issue `Hotfix: <motivo>` que a Esteira **sempre** cria (nos dois casos de **quem executa**: o agente ou o humano), a correção e a MR `hotfix/*`. A **Entrega só abre depois da MR na `main`**; o bloco **Hotfixes pedidos** (Aguardando a correção, MR aberta, Pronto para Entrega) fica acima da lista de Entregas. A Abertura avisa o que vai junto, o Atalho é opcional, e quem pediu ou escreveu o hotfix não aprova a MR nem o QA e o HML dele.
- **Uma Entrega é de uma Aplicação só:** no Painel, escolher Fatias de uma Aplicação desabilita as das outras.
- **Dependência entre Projetos:** declarada no cadastro da Aplicação (aba Projetos) e lida do mapa (`Depende de`); a API vem antes do front. Dependência que não está na `main` impede abrir; na `main` mas não publicada só avisa.
- **Exceção:** vale nos Ambientes escolhidos; prazo máximo por tipo (falso positivo até 180 dias, risco aceito até 90); renovar é um pedido novo, aprovado de novo; o pedido nasce do Achado (na tela da Entrega); reprovar e revogar exigem motivo; quem pediu pode cancelar o próprio pedido. O Atalho oferece a Exceção em lote.
- **Auditoria:** só leitura; cada pessoa vê os registros das Aplicações em que tem papel, o MOR vê tudo; além de pessoas, o bot da Esteira e as pipelines aparecem como autores.
- **Autoaprovação:** o MOR que abriu a Entrega aprova com o aviso "autoaprovação" e o motivo obrigatório.
- **Limpeza pendente:** a aba só lista as Fatias excluídas com a idade e o link para a issue `<código>-L`. Programar ou disparar a limpeza pela Esteira ficou de fora (a ADR-0025 só prevê o pedido e o lembrete de 30 dias).
