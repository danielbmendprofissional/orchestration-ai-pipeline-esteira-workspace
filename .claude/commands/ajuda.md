---
description: Lista os comandos do projeto, uma linha cada; `/ajuda tudo` inclui todas as skills
argument-hint: "[tudo]"
---
Somente leitura. Argumento `$ARGUMENTS`: vazio = comandos + skills de entrada; `tudo` = também todas as skills instaladas.

1. Rode da raiz do workspace (com `--tudo` no lugar de `tudo`, se for o caso):

```
node .claude/scripts/ajuda.mjs --md $ARGUMENTS
```

2. **A saída do Bash fica recolhida e o usuário não a vê. Por isso, sua resposta é a própria saída:** copie-a inteira, palavra por palavra, como texto markdown (as tabelas renderizam; **não** a ponha dentro de bloco de código). Não escreva "saída acima", não resuma, não comente, não sugira próximos passos (para isso existe o `/proximo`). Não leia outros arquivos.
