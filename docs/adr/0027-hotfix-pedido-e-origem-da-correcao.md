# ADR-0027 — Hotfix: pedido, origem da correção e Entrega depois da MR

Status: Aceito · 2026-11-22 · Refina as ADRs 0018, 0021, 0023 e 0025 (o que não é citado aqui continua valendo) · Decidido no grill da D1, com o dono

## Contexto

As ADRs 0018 e 0023 dizem que o hotfix é uma Entrega de tipo hotfix, de um Projeto só, com o Atalho e sem seleção de Fatias. O `docs/agents/esteira-deploy.md` descreve o caminho do código (branch `hotfix/*` a partir da `main`, MR, aprovação humana, e só depois a Entrega). Nenhum dos dois diz **como o hotfix nasce**, **quem executa a correção**, **se ele tem issue** (o template-ci vai recusar MR sem issue referenciada, item 9 de `docs/mudancas-template.md`) nem **em que momento** a Entrega abre. O protótipo da D1 chegou a desenhar a Entrega abrindo antes da correção, o que contradiz o fluxo do `esteira-deploy.md` e a regra da ADR-0025 de que o Fluxo usa o último SHA verde da `main`.

## Decisão

- **O hotfix tem uma fase antes da Entrega**: pedido, correção e MR `hotfix/*`. Nessa fase ele não é Fatia (não está no mapa) nem Entrega. A **Entrega do hotfix só abre depois da MR `hotfix/*` mergeada na `main`**, e já nasce com o Artefato sobre o SHA que contém a correção. Uma Entrega aberta antes ocuparia a vaga do HML e da produção do Projeto sem Artefato.
- **O pedido é feito na Esteira** (tela **Entregas**, botão **Pedir hotfix**): Aplicação, Projeto, motivo (obrigatório) e **quem executa**. A Esteira **sempre cria a issue** `Hotfix: <motivo>` no GitLab, com o rótulo `ready-for-human`, nos dois casos. Ela só cria o pedido e não executa comandos (ADR-0021), como na issue de limpeza `<código>-L` (ADR-0025). O template-ci não ganha exceção: toda MR `hotfix/*` cita uma issue.
- **Quem executa** é uma escolha, não duas rotas: **o agente**, quando o humano pede a ele, em uma sessão do Claude Code, que implemente a issue de hotfix; ou **o humano**, que escreve o código numa branch `hotfix/*` e cita a issue na MR. O agente nunca inicia um hotfix sozinho.
- **O agente vai só até a MR aberta.** Aprovar a MR (Aprovador técnico), abrir a Entrega (Membro), usar o Atalho e confirmar a produção (Publicador) continuam atos humanos na Esteira (ADR-0021). O hotfix passa pelo mesmo `/code-review` e pelo mesmo gate de revisão de qualquer MR.
- **Estados do pedido de hotfix**, derivados pela Esteira do que ela lê no GitLab: **Aguardando a correção** (issue criada), **MR aberta** e **Pronto para Entrega** (MR mergeada, ainda sem Entrega). Só neste último aparece o botão **Abrir Entrega**. A tela **Entregas** mostra o bloco "Hotfixes pedidos" acima da lista, e o **Aguardando você** mostra "Hotfix pronto para abrir a Entrega".
- **O que vai junto.** A `main` é cumulativa, então o Artefato do hotfix leva também as Fatias Prontas para Entrega que nunca passaram por QA, com o flag desligado (risco já aceito na ADR-0025). A Abertura mostra "Vão junto", "MRs mergeadas sem Fatia" e "Limpezas pendentes" como avisos, sem bloquear. O hotfix continua permitido com limpeza pendente de Fatia sem flag.
- **O Atalho é opcional no hotfix.** A Entrega do hotfix nasce com QA e HML normais; o Publicador decide usar o Atalho (nome de quem ordenou e motivo, sem pular o gate de segurança sem Exceção, faz só o deploy). A frase "hotfix com o Atalho" das ADRs 0018, 0021 e 0023 passa a ser "hotfix **pode** usar o Atalho".
- **Quem pediu não aprova.** A regra existente (quem abriu o Fluxo não aprova as etapas dele, exceto o MOR, como autoaprovação com motivo) vale também para quem **pediu ou escreveu** o hotfix: não aprova a MR nem o QA e o HML dele. Quem abriu a Entrega não confirma a produção. O nome de quem ordenou o Atalho pode ser outra pessoa.
- **Versão:** continua patch (+1 no Z), calculada na confirmação em produção (ADR-0023). Sem campo de tipo da mudança.

## Consequências

- O `CONTEXT-MAP.md` ganha o termo **Hotfix** e ajusta **Atalho** e **Entrega**. O `docs/agents/esteira-deploy.md` descreve o fluxo novo.
- A API precisa ler o pedido de hotfix (issue com rótulo, branch `hotfix/*`, MR). Isso entra no contrato de leitura (`docs/contrato-leitura-esteira.md`) quando a fatia correspondente for especificada (P1 ou E1a).
- Os protótipos da D1 mudam: `prototipo-pedir-hotfix.html` (novo), a Abertura (escolhe um hotfix pronto), a lista de Entregas, o Aguardando você e o cenário de hotfix da tela da Entrega.
- **Em aberto:** o comando de entrada do agente para uma issue de hotfix ainda não existe (os comandos `/fatia` e `/issue-ai` não servem para isso). Hoje é um pedido direto na sessão do Claude Code. Decidir se vira um comando próprio quando a fatia for especificada.
