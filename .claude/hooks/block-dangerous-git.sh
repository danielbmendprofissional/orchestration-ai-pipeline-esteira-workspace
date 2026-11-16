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

# Push direto pra branch protegida.
# Modelo trunk-based (ADR-0018 da Esteira): só existem main, feature/* e
# hotfix/*; ambiente não é branch (não há dev/qa/hml). A main só aceita merge
# do bot da Esteira. master fica como fallback genérico pra repos que ainda não
# adotaram o fluxo.
#
# Vale pra toda sessão Claude Code, inclusive os subagentes do /implement-task.
# Agente só sobe feature/* (ou hotfix/*) e abre MR pra main — ver
# docs/agents/esteira-deploy.md. Nunca push direto em `main`.
PROTECTED_BRANCHES="main|master"
if echo "$COMMAND" | grep -qE "git push[^|&;]*\s(origin\s+)?($PROTECTED_BRANCHES)(\s|$)"; then
  echo "BLOCKED: '$COMMAND' — push direto em branch protegida. Abra uma feature branch e uma merge request pra 'main'." >&2
  exit 2
fi

exit 0