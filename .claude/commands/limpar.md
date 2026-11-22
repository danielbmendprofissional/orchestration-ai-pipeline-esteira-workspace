---
description: Lista as sessões do Claude Code da máquina e apaga de verdade as que você escolher (com resumo do gasto antes)
argument-hint: "[IDs separados por vírgula | mais-antigas <dias>]"
---
Argumento: `$ARGUMENTS`. Apaga arquivos fora do repositório (`~/.claude`): **nunca apague sem o "sim" do humano a um plano que ele viu.** Transcrito antigo não gasta token (o modelo não o lê); apagar libera disco e tira o conteúdo da máquina. Diga isso em uma frase se o humano acreditar que apagar reduz o gasto.

**Passo 1 — listar** (argumento vazio):

```
node .claude/scripts/limpar.mjs
```

A saída do Bash fica recolhida: **responda com a própria saída**, palavra por palavra, como texto markdown (tabela renderizada, não em bloco de código). Termine perguntando quais IDs apagar (ou "mais antigas que N dias").

**Passo 2 — plano** (humano escolheu): rode `node .claude/scripts/limpar.mjs --apagar <ids>` (ou `--mais-antigas <dias>`), **sem `--sim`**. Copie a saída do mesmo jeito e pergunte: "Apago? (o resumo do `/gasto` de cada uma é gravado antes em `~/.claude/gasto-resumos/`)".

**Passo 3 — apagar:** só com um "sim" explícito a esse plano, repita o mesmo comando com `--sim` (acrescente `--sem-resumo` só se o humano pedir; `--forcar` só se ele confirmar que quer apagar uma sessão que parece aberta, e nunca a sessão em que você está rodando). Copie a saída final.

Não leia nem abra nenhum transcrito, não comente além disso.
