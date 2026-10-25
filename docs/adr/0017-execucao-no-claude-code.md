# ADR-0017 — Execução no Claude Code; pi.dev removido

Status: Aceito · 2026-10-24 · Substitui o `pi` da ADR-0001 (quem abre na raiz do workspace) e o runner da ADR-0012

A primeira execução de spec pelo `pi.dev` (B2, 2026-10-24) mostrou que a fragilidade estava na ferramenta, não no processo: o modelo pago fez a #4 certa, mas a extensão de subagentes perdeu um processo filho e travou a sessão sem aviso. A execução passa a ser o Claude Code: `/implement-task` (`.claude/commands/`) com subagentes de `.claude/agents/`. O modelo é escolha de custo, não de ferramenta — `claude` (assinatura), `claude-pago`/`claude-free` (mesmo Claude Code, combos do OmniRoute) — ver `docs/agents/orchestration.md`.

## Consequences

- ADR-0001: quem abre na raiz do workspace é o Claude Code (o resto da decisão não muda).
- ADR-0012: o `tools/agent-runner` do template roda o **Claude Code CLI** (`claude -p`) com as definições de `.claude/agents/` (`review.md`, `security.md`, `tests.md`), apontado pro OmniRoute por variáveis (`ANTHROPIC_BASE_URL` + key de cliente mascarada) — nunca a assinatura do Claude no CI. Formato de saída, teto de custo e peso no gate continuam como na ADR-0012.
- A prova do gate local em `feature/*` passa a ser `.code-review-ok.json` na raiz do repositório (era `.pi/code-review-ok.json`).
- Promoção `dev → qa` (merge da tag + push) é do humano até a fatia E4 entregar o bot — o hook bloqueia agente em branch protegida.
