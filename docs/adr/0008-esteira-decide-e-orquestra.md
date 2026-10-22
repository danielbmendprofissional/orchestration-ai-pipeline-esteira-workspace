# ADR-0008 — A Esteira decide se publica e orquestra as promoções no GitLab

Status: Aceito · 2026-10-21 · Revê parte da ADR-0007 (variáveis) e as convenções de MR do `CLAUDE.md`/`docs/agents/esteira-deploy.md`

A Esteira é a única autoridade sobre publicar: a pipeline do template-ci chama a Esteira por HTTP em três pontos (`esteira-abrir` antes de tudo, `esteira-gate` depois da segurança e antes do deploy, `esteira-resultado` depois do deploy) e só segue com OK. A política de severidade vive na Esteira por Aplicação e Ambiente, e não mais em `SECURITY_FAIL_ON`. A Esteira também **executa** as promoções via API do GitLab com um bot: corta as candidatas, abre a MR `release/<tag>` → `qa|hml|main` e só faz o merge depois da aprovação humana registrada nela. Tags `v*` são protegidas e só o bot cria, então nenhuma publicação nasce fora de um Fluxo de deploy.

## Considered Options

- **Gatekeeper** (pessoas fazem git, a pipeline só pergunta à Esteira): menos poder concentrado, mas não impede tag cortada à mão e mantém duas autoridades (GitLab e Esteira) sobre a mesma promoção.
- **Gate no template-ci** (`security-gate` decide, a Esteira só mostra): política espalhada por variável de cada projeto, sem tela nem auditoria.

## Escopo

Vale para as **Aplicações gerenciadas pela Esteira**. Os repositórios da própria Esteira (`esteira-api`, `esteira-frontend`) ficam de fora: usam o template em modo fallback e promoção manual com MR aprovada no GitLab, como descrito no `CLAUDE.md` e em `docs/agents/esteira-deploy.md` — senão uma Esteira quebrada não publicaria a própria correção.

## Consequences

- O token do bot é a chave de todas as aplicações: um bot por grupo, só em secret, escopo usado só para tag, branch `release/*`, merge de MR e play de job. A autoria no GitLab vira "bot", então a auditoria vive na Esteira (pendência de audit trail).
- Esteira fora do ar = nada publica, nem hotfix (fail-closed, sem bypass). Disponibilidade da Esteira passa a ser requisito de produção.
- Pipeline → Esteira é HTTP síncrono autenticado por `id_tokens` do GitLab CI (JWT validado pela JWKS do GitLab). RabbitMQ fica só interno.
- A aprovação de MR no GitLab passa a significar só revisão de código (`feature/* → dev`). MRs de promoção não exigem aprovação no GitLab: o humano revisa a MR pela Esteira e aprova lá.
- As variáveis não secretas de cada projeto vêm da Esteira na resposta do `esteira-abrir`; no GitLab ficam só segredos e globais.
