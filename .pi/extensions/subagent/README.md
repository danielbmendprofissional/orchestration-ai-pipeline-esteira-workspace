# subagent (vendorizado de @earendil-works/pi-coding-agent)

Extensao oficial de exemplo do pi.dev (`examples/extensions/subagent/` no pacote npm), copiada pra dentro deste repo em vez de symlink pra `node_modules`, pra ficar portavel e versionada no git.

## O que foi alterado em relacao ao original

Em `index.ts`, o default de `agentScope` foi trocado de `"user"` pra `"both"`:

```
const agentScope: AgentScope = params.agentScope ?? "both"; // patched for ai-base
```

Isso faz o parent `pi` carregar automaticamente os subagents de projeto em `.pi/agents/*.md` (os 8 papeis: data, backend, front, ui, tests, security, review, qa) sem precisar que o agente pai lembre de passar `agentScope: "both"` toda vez.

## Onde ficam as coisas

- `.pi/extensions/subagent/` — esta extensao (index.ts + agents.ts), carregada automaticamente pelo `pi` quando voce roda dentro deste repo.
- `.pi/agents/*.md` — os 8 subagents de papel (7 da chain `/implement-task` + `qa` da esteira; modelo de cada um no campo `model:` do proprio arquivo).
- `.pi/extensions/subagent/prompts/implement-task.md` — o prompt `/implement-task <descricao>` que encadeia os 7 papeis numa chain.

## Atualizar quando o pi.dev lancar uma versao nova do exemplo

Este arquivo pode ficar desatualizado em relacao ao pacote. Pra atualizar: reinstale `@earendil-works/pi-coding-agent`, compare `examples/extensions/subagent/index.ts` do pacote novo com este, e reaplique o patch do `agentScope` no diff.
