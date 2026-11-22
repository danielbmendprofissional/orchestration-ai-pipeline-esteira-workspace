---
description: Deixa uma passagem para a próxima sessão e lista/apaga de verdade as sessões do Claude Code da máquina (com resumo do gasto antes)
argument-hint: "[IDs separados por vírgula | mais-antigas <dias>]"
---
Argumento: `$ARGUMENTS`. Dois usos: (A) **encerrar esta conversa deixando uma passagem** para a próxima sessão e (B) **apagar sessões antigas** do disco. Sem argumento, pergunte primeiro o que o humano quer: "Deixar a passagem desta conversa? Apagar sessões antigas? Os dois?".

## A. Passagem da sessão (a próxima sessão nasce sabendo)

Uma conversa grande custa caro: cada mensagem relê tudo. Em vez de reexplicar o contexto numa sessão nova, esta conversa grava um resumo curto em `.claude/passagem.md` (fora do git), e a sessão nova o lê sozinha ao abrir (hook `SessionStart`, zero token).

1. Rode `node .claude/scripts/passagem.mjs --cabecalho` e use a linha que ele imprime como **primeira linha** do arquivo.
2. Escreva `.claude/passagem.md` (ferramenta Write), **no máximo ~40 linhas**, só com o que a próxima sessão precisa para não perguntar de novo:
   - **Estávamos fazendo:** a tarefa e o ponto exato em que parou.
   - **Decisões tomadas** (e o porquê, em uma frase cada) e o que o humano **recusou** (para não propor de novo).
   - **Estado do git:** o que está commitado e o que não está, por repositório (confira com `git -C <repo> status -s` e `log`, não de memória).
   - **Pendências abertas** (as que o humano ainda não decidiu) e a **próxima ação** concreta.
   - **Nunca** valor de senha, token ou segredo; nunca trecho grande de código (aponte `arquivo:linha`).
3. Mostre o arquivo ao humano em uma linha ("passagem gravada em `.claude/passagem.md`, N linhas") e diga: "Abra uma sessão nova; ela lê a passagem sozinha. Esta pode ser fechada." Não apague esta sessão (está aberta).

## B. Apagar sessões antigas

Apaga arquivos fora do repositório (`~/.claude`): **nunca apague sem o "sim" do humano a um plano que ele viu.** Transcrito antigo não gasta token (o modelo não o lê); apagar libera disco e tira o conteúdo da máquina. Diga isso em uma frase se o humano acreditar que apagar reduz o gasto.

**Passo 1 — listar:** `node .claude/scripts/limpar.mjs`. A saída do Bash fica recolhida: **responda com a própria saída**, palavra por palavra, como texto markdown (tabela renderizada, não em bloco de código). Termine perguntando quais IDs apagar (ou "mais antigas que N dias").

**Passo 2 — plano** (humano escolheu): rode `node .claude/scripts/limpar.mjs --apagar <ids>` (ou `--mais-antigas <dias>`), **sem `--sim`**. Copie a saída do mesmo jeito e pergunte: "Apago? (o resumo do `/gasto` de cada uma é gravado antes em `~/.claude/gasto-resumos/`)".

**Passo 3 — apagar:** só com um "sim" explícito a esse plano, repita o mesmo comando com `--sim` (acrescente `--sem-resumo` só se o humano pedir; `--forcar` só se ele confirmar que quer apagar uma sessão que parece aberta, e nunca a sessão em que você está rodando). Copie a saída final.

Não leia nem abra nenhum transcrito (só o git e os arquivos do projeto, para a passagem).
