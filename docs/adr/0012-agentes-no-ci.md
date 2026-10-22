# ADR-0012 — Agentes de code-review, security e qa rodam no CI

Status: Aceito · 2026-10-22 · Muda o princípio do template-ci "nenhuma IA roda no CI"

Os agentes rodam na pipeline de cada Candidata (code-review e security antes do gate; qa depois do primeiro deploy) numa imagem `tools/agent-runner` do template, que executa `pi` com as definições de agente do projeto e usa modelo via **OmniRoute** (chave em variável mascarada do grupo no GitLab). A saída é JSON no formato de Análise (veredito + achados com severidade) e entra na Esteira pelo `esteira-gate`/`esteira-resultado` como qualquer ferramenta. Cada Aplicação tem um **teto de custo por execução** configurado na Esteira.

## Consequences

- O resultado do agente pesa no gate igual a uma ferramenta: a política de severidade e as Exceções valem para ele.
- O gate local em `feature/*` (`.pi/code-review-ok.json`) continua como filtro antes da MR; não é ele que a Esteira considera.
- Formato do JSON de Análise: spec da fatia E2. Mudança no template: `docs/mudancas-template.md`, item 8.
