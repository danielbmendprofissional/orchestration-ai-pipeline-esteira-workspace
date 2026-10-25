# Fluxo TDD + SDD

Pipeline padrão deste projeto base, construído em cima das skills de Matt Pocock instaladas em `.claude/skills/`. Cada seta abaixo é um comando de skill; a ordem é a intencionada pelo autor das skills — não pule etapas sem necessidade.

```
/grill-me | /grill-with-docs        (discovery)
        ↓
/wayfinder                          (só se o trabalho for grande demais p/ 1 sessão — cria map + tickets filhos)
        ↓
/to-spec                            (spec-driven: conversa → spec formal, publicada no tracker)
        ↓
/to-tickets                         (spec → fatias/tickets, cada um com dependências bloqueantes declaradas)
        ↓
/implement-task <fatia>              (test-driven: task a task com TDD, um commit por task → /code-review → corrige os achados → push → MR pra dev; .claude/commands/implement-task.md)
        ↓
merge request → dev (branch protegida) → validação humana → merge
        ↓
fechar a fatia                      (automático no próximo /implement-task ou /to-spec)
        ↓
quando todas as specs da rodada estiverem em dev: você corta a tag vX.Y.Z-rcN e promove dev → qa
        ↓
esteira de deploy por tag (ver docs/agents/esteira-deploy.md): dev → qa (merge automático) → agente de QA testa → MR qa→hml (aprovação humana) → hml publicado (segunda aprovação humana) → MR hml→main + tag final vX.Y.Z (humano)
```

Commit, MR, tag e esteira acontecem em cada repositório de código que a issue tocou (`<projeto>-api`, `<projeto>-frontend`); issue e spec ficam no workspace — ver `docs/agents/workspace.md`.

O agente sempre trabalha em `feature-x` e abre a MR pra `dev` — nunca pra `qa`/`hml`/`main` diretamente no fluxo normal de spec; a promoção entre elas é responsabilidade da esteira de deploy. A exceção é hotfix: só por pedido humano direto, branch `hotfix/xxx` a partir de `main` — ver `docs/agents/esteira-deploy.md`.

## Onde cada skill entra

**Discovery (SDD, começo).** `/grill-me` é a entrada mais simples (entrevista genérica até fechar decisão/plano). `/grill-with-docs` é a variante para trabalho de engenharia: entrevista + modelo de domínio, grava termos em `CONTEXT.md` via `/domain-modeling`.

**Trabalho grande demais para uma sessão.** `/wayfinder` monta um mapa compartilhado (issue `wayfinder:map` no GitLab) com tickets filhos, dependências e uma "fronteira" de trabalho desbloqueado — usar antes de `/to-spec` quando o escopo é claramente multi-sessão.

**Prototipagem descartável.** `/prototype` quando é preciso validar uma ideia de UI/lógica em código jogável fora antes de comprometer com uma spec — roda fora do pipeline principal, alimenta o discovery.

**Spec e tickets (SDD, núcleo).** `/to-spec` converte a conversa de discovery numa spec formal — arquivo no workspace + issue-mãe, no formato de `docs/agents/spec-format.md` (que também traz o gate: fatia anterior mergeada em `dev`, contexto citado já na branch principal). `/to-tickets` quebra a spec em tickets rastreáveis (fatias), cada um declarando o que bloqueia e o que é bloqueado.

**Implementação (TDD, núcleo).** `/implement-task` executa a spec task a task: o agente-pai monta o escopo de cada task e delega a subagentes de `.claude/agents/`, cada um test-first (red-green-refactor). Não escrever código de produção sem um teste vermelho antes. **O teste vermelho, uma vez aceito, fica congelado: alterar suas asserções (afrouxar, remover, pular/`skip`/comentar) para fazer a implementação passar é proibido — só a implementação muda até o teste ficar verde.** Se o teste parecer errado ou desalinhado da spec, a saída correta é parar e reportar a divergência para quem fechou a spec/ticket — nunca editar o teste silenciosamente pra destravar a task. (Os subagentes `data`/`backend`/`front` aplicam essa mesma regra, ver `.claude/agents/*.md`.) Quando a task tiver fatia de UI (ver `docs/agents/orchestration.md`), ela segue `docs/design/` (tokens, biblioteca de componentes, princípios anti-ai-slop) — não é opcional.

**Review.** `/code-review` avalia o diff contra dois eixos independentes: os padrões do repo (estilo, arquitetura, `docs/adr/`) e a conformidade com a spec original (`to-spec`). Isso inclui olhar o diff do próprio arquivo de teste, não só da implementação: uma asserção enfraquecida, removida ou desativada entre a versão vermelha e a versão que passa, sem isso estar coberto pela spec, é bloqueante — mesmo critério que os subagents `tests`/`review` já aplicam durante `/implement-task`, só que como segunda camada. Rodar antes de abrir a merge request, não depois. Se o diff tocar UI, rodar também `/skill:avoid-ai-design detect` (ver `docs/design/`) como segunda camada — a task de `ui` já deveria ter feito essa auditoria, mas isso confirma que nada passou batido. Mesma lógica se o diff tocar superfície sensível (auth, dado de usuário, dependência nova, segredo): rodar as skills de segurança relevantes (`security-review`/`owasp-audit`/`dependency-audit`/`secrets-audit`, ver `docs/agents/security-review.md`) como segunda camada sobre o que o subagent `security` já checou de forma mecânica.

**Commit → Merge Request → dev.** Commit granular, MR contra `dev` (branch protegida), merge só após validação humana. Dali em diante, a esteira de deploy assume: promoção `dev → qa` é automática, `qa → hml` abre MR esperando aprovação humana, `hml → main` espera segunda aprovação humana — ver `docs/agents/esteira-deploy.md` para o fluxo completo, incluindo hotfix e rollback. Ver `docs/agents/issue-tracker.md` para os comandos `glab mr ...`.

**Fechar a fatia.** Mergeada em `dev`: o próximo `/implement-task` ou `/to-spec` fecha mãe e filhas no GitLab e marca a fatia como feita em `specs/README.md` (`docs/agents/orchestration.md`, "Fechar a fatia"); se ela criou um artefato que outras specs vão citar (`DESIGN.md`, contrato novo, ADR), aponta pra ele no `CLAUDE.md` do componente. Fundação (bootstrap, design system) não tem issue: aí é você quem pede pra marcar no mapa — é o que deixa a próxima `/to-spec` partir de uma base que existe.

**Quem faz o quê em cada passo** (comando humano × ação do LLM × onde o humano decide): tabela "Ciclo de uma fatia" em `docs/agents/orchestration.md`. Na prática, por fatia, o humano roda `/to-spec B2`, `/to-tickets B2`, `/implement-task B2` e aprova o merge da MR; o `/implement-task` já roda o `/code-review`, corrige os achados e abre a MR.

## Skills de apoio (usar quando a situação pedir, fora da sequência linear)

- `/diagnosing-bugs` — loop disciplinado de debug quando algo quebra fora do fluxo de implementação normal.
- `/resolving-merge-conflicts` — conflitos de merge na MR.
- `/improve-codebase-architecture` — varredura periódica de arquitetura (rodar a cada N dias/sprints, não por ticket).
- `/triage` — gerenciar o estado das issues no tracker (aplica os labels de `docs/agents/triage-labels.md`).
- `/retro` — retrospectiva de uma sessão de codificação, depois de fechar um ticket ou um bloco de trabalho.
- `/handoff` — compactar a conversa atual para outro agente/sessão continuar.
- `/ask-matt` — roteador entre as skills quando não tiver certeza de qual usar.

## Onde isso conecta com os agentes de execução

`/implement-task` é onde a execução acontece: a spec e o ticket já estão fechados, então cada task vai pra um subagente com contexto limpo e o escopo dela colado. O modelo depende do modo da sessão — `claude` (plano), `claude-pago` ou `claude-free` (combos do OmniRoute).

Detalhamento (subagentes, modos, uma sessão por spec, execução paralela no Alethe): `docs/agents/orchestration.md`.