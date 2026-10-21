# Skills de segurança (Claude Code) — camadas e fluxo de correção

Este repo já tem segurança em duas camadas que não se sobrepõem por acaso — este arquivo documenta a terceira, e como as três se conectam.

## As camadas

**1. `.pi/agents/security.md` — automática, todo ticket, barata.** Roda dentro de `/implement-task`, sem supervisão humana, checklist mecânico (entrada validada, auth, segredo hardcoded, CVE de dependência nova). Modelo do combo `omniroute/pi-quality` via `pi.dev` — **não tem acesso a nenhuma skill do Claude Code**, são runtimes diferentes. Nenhuma skill deste arquivo pode ser chamada por ele.

**2. Skills de auditoria do Claude Code — sob demanda, mais profundas.** Instalação e comandos exatos são setup de projeto, fora deste repo. Dois grupos:

- **Núcleo, roda contra qualquer projeto:** `security-review` e `skill-scanner` (`getsentry/skills`); `owasp-audit`, `api-audit`, `dependency-audit`, `secrets-audit`, `crypto-audit` (`briiirussell/cybersecurity-skills`). Aprofundam exatamente o que o `.pi/agents/security.md` já checa de forma barata — mesmo padrão do `avoid-ai-design` ser "segunda rede de segurança" depois do `impeccable` (`docs/design/principios.md`).
- **Situacional, só quando o projeto real tiver aquele escopo regulatório:** `privacy-engineering`, `hipaa-audit`, `pci-audit`, `csf-mapping`, `ai-risk-management` (`briiirussell/cybersecurity-skills`). Decisão de nascimento de projeto, não regra fixa do `ai-base` — a maioria dos projetos não precisa de nenhuma delas.

**Onde entram no `/code-review` (`docs/workflow.md`):** se a task tocar superfície sensível (auth, dado de usuário, dependência nova, segredo), rodar `security-review`/`owasp-audit`/`dependency-audit`/`secrets-audit` como segunda camada antes de abrir a MR — mesma lógica condicional do `avoid-ai-design` pra UI.

**Periódico, não por ticket:** `skill-scanner` (varre as skills instaladas em `.claude/skills/`), `crypto-audit`, `mobile-audit` (se o projeto tiver app mobile) — mesmo padrão do `/improve-codebase-architecture`.

**3. `Security-Scanner` — scanners por assinatura, fora do fluxo de spec.** Trivy/Opengrep/Checkov/BetterLeaks/ZAP rodando no stage `security` da esteira (`template-ci`), com gate por severidade e relatório consolidado como artifact; também roda local via CLI, independente de qualquer ticket. Não substitui a camada 2 — pega classe diferente de problema (SAST/dependência/container/DAST por ferramenta, não revisão semântica por IA).

## Fluxo: você roda uma auditoria manual e encontra um achado

Isso acontece fora do fluxo normal de spec — você (via Claude Code) roda uma skill de auditoria por conta própria (não como parte de nenhum ticket em andamento) e ela aponta um problema real. O que fazer com o achado depende do tamanho dele:

**Achado isolado, correção óbvia, sem ambiguidade de escopo** (ex: segredo hardcoded num arquivo específico, dependência com CVE conhecido e patch direto disponível, uma validação faltando num endpoint):

1. Abrir uma issue no GitLab descrevendo o achado (arquivo, o que está errado, o que a skill recomendou), já com a label `ready-for-agent` — você já triou o achado ao rodar a auditoria, não precisa passar pelo `/triage`.
2. Despachar `pi` chamando o subagent `security` **sozinho, em modo `single`** (não a chain inteira de `/implement-task` — não tem `data`/`backend`/`front`/`ui` pra rodar aqui, é uma correção pontual de segurança), apontando pra issue.
3. Mesmo sendo um achado pequeno, não pular o resto do gate: depois do `security` corrigir, rodar `tests` (confirma que nada quebrou) e pelo menos uma passada de `review` antes de virar branch/MR — a correção de segurança segue o mesmo padrão de qualidade de qualquer outra mudança, só que sem precisar da chain de `data`/`backend`/`front`/`ui` que não se aplicam aqui.
4. Branch de feature normal, `/code-review` (rodando a mesma skill de novo pra confirmar que o achado sumiu — fecha o loop), commit, MR pra `dev`, esteira normal (`docs/agents/esteira-deploy.md`).

**Achado que precisa de decisão de arquitetura ou toca múltiplos módulos** (ex: "não validamos expiração de JWT em nenhum endpoint", "todo o módulo Financial expõe dado de outro usuário por falta de filtro de tenant"):

1. Vira spec de verdade: `/to-spec` a partir do achado da auditoria (a skill já deu o diagnóstico, o `/to-spec` formaliza o que precisa mudar e onde).
2. `/to-tickets` quebra em fatias.
3. Segue o pipeline normal completo (`/implement-task`, todos os papéis que se aplicarem).

**Importante: achado de auditoria preventiva não é hotfix.** Hotfix (`docs/agents/esteira-deploy.md`) é pra algo já quebrado/sendo explorado em produção agora, só por pedido humano direto. Um achado que você encontrou proativamente rodando uma skill segue o fluxo normal de feature branch — a menos que, ao investigar, você conclua que já está sendo explorado ativamente, aí sim é você (humano) quem decide abrir o hotfix.