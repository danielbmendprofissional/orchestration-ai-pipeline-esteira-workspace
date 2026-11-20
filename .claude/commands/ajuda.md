---
description: Lista os comandos do projeto, uma linha cada; `/ajuda tudo` inclui todas as skills
argument-hint: "[tudo]"
---
Somente leitura. Argumento `$ARGUMENTS`: vazio = comandos + skills de entrada; `tudo` = também todas as skills instaladas.

Rode da raiz do workspace e **mostre a saída exatamente como veio, sem comentar nem resumir**:

```
node .claude/scripts/ajuda.mjs $ARGUMENTS
```

Se o argumento for `tudo`, rode com `--tudo` no lugar. Só isso: não leia outros arquivos, não sugira próximos passos (para isso existe o `/proximo`).
