#!/bin/bash

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Bloqueia sempre, independente da branch
DANGEROUS_PATTERNS=(
  "push --force"
  "push -f "
  "push .*--force"
  "reset --hard"
  "git clean -fd"
  "git clean -f"
  "git branch -D"
  "git checkout \."
  "git restore \."
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "BLOCKED: '$COMMAND' bate no padrão perigoso '$pattern'. O usuário não te deu autoridade pra isso." >&2
    exit 2
  fi
done

# Push direto pra qualquer branch protegida do fluxo de promoção
# (feature-x -> MR -> dev -> qa -> hml -> main; master fica como fallback
# genérico pra repos que ainda não adotaram o fluxo completo).
#
# Vale pra toda sessão Claude Code, inclusive os subagentes do /implement-task.
# Promoção dev->qa (merge da tag + push) é do humano — ver
# docs/agents/esteira-deploy.md. Agente só sobe feature/* e abre MR pra dev.
#
# Hotfix (branch/xxx a partir de main, MR, aprovação humana — ver
# docs/agents/esteira-deploy.md) também não esbarra aqui: o agente só empurra
# a branch `hotfix/xxx`, nunca push direto em `main`.
PROTECTED_BRANCHES="main|master|dev|qa|hml"
if echo "$COMMAND" | grep -qE "git push[^|&;]*\s(origin\s+)?($PROTECTED_BRANCHES)(\s|$)"; then
  echo "BLOCKED: '$COMMAND' — push direto em branch protegida. Abra uma feature branch e uma merge request pra 'dev'." >&2
  exit 2
fi

exit 0