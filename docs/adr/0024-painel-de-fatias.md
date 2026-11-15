# ADR-0024 — Painel de Fatias

Status: Aceito · 2026-11-15 · Complementa a ADR-0022 (Fatias aprovadas, Entrega por seleção) e a ADR-0023 (etapas e estados) · Segue o contrato de leitura (`docs/contrato-leitura-esteira.md`): o que vem do mapa, da spec, das issues, do bloco de execução e da MR é lido; o que é da Esteira (review, Entrega, flag) é dela

O Painel de Fatias é a tela em que o humano **acompanha a implementação** e **escolhe o que vai para uma Entrega**. Ele existe antes de qualquer Entrega (a Fatia existe antes do Fluxo).

## Estados da Fatia

Deduzidos pela Esteira do que ela lê, sem ninguém marcar:

- **Planejada:** está no mapa, ainda sem spec.
- **Com spec:** a spec existe e foi aprovada; a execução não começou.
- **Em execução:** o `/implement-task` roda (label `em-execucao` e bloco de execução com tasks).
- **Em revisão:** a MR está aberta. Reprovada e fechada, mostra "em correção".
- **Aprovada:** a MR foi mergeada na `main` com o flag desligado, e ela ainda não está numa Entrega.
- **Em Entrega:** foi selecionada numa Entrega aberta (mostra qual).
- **Publicada, não liberada:** em produção com o flag desligado.
- **Liberada:** o flag está ligado em produção.
- **Excluída:** cancelada (reverter ou absorver, ADR-0019).

Fatias no formato anterior ao padrão aparecem com a marca "formato anterior" (regra do contrato de leitura).

## Abas

- **Em andamento:** de Com spec até Em revisão.
- **Aprovadas:** as que esperam seleção, com caixa de seleção por linha e o botão **Abrir Entrega** com as selecionadas. As que voltaram de uma Entrega superada têm a marca "vinha de uma Entrega superada".
- **Em Entrega:** com o link para a Entrega.
- **Publicadas não liberadas:** com os botões Liberar e Excluir (ADR-0023).
- **Liberadas** e **Todas**.

## Cada linha

Código e título (`B2 — Result pattern…`), **Projeto** (API, front ou os dois), **risco** da spec, **estado** e um **progresso** por estado: "3 de 5 tasks" em execução; "CI verde, aguardando você" em revisão. Em revisão aparecem também **Abrir review** (ou o link, se já aberto) e **Aprovar** ou **Reprovar**.

Clicar na linha abre uma **gaveta lateral**, como nos protótipos aprovados, com os links montados na hora (spec, issue-mãe, branch, MR, commit de cada task), a lista de tasks, o estado do flag por ambiente e o link "ver na auditoria".

## Em aberto

- **O que o `/implement-task` mostra em tempo real** ("o que a IA está codando agora"): exigiria o Claude Code enviar eventos à Esteira; hoje o único rastro é o bloco de execução. Adiado.
- **Desenho visual** do Painel: parte dos protótipos aprovados (`docs/design/prototipos/`).
