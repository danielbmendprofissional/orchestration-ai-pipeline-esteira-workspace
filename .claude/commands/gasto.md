---
description: Mostra o gasto de tokens da sessão e dos subagentes (contexto, cache, saída por ticket), sem gastar token
argument-hint: "[id-da-sessão]"
---
Somente leitura. Argumento `$ARGUMENTS`: vazio = a sessão mais recente deste workspace (a que está rodando); ou o início do id de outra sessão.

1. Rode da raiz do workspace:

```
node .claude/scripts/gasto.mjs $ARGUMENTS
```

2. **A saída do Bash fica recolhida e o usuário não a vê. Por isso, sua resposta é a própria saída:** copie-a inteira, palavra por palavra, como texto markdown (a tabela renderiza; **não** a ponha dentro de bloco de código). Não resuma, não comente, não leia outros arquivos.
