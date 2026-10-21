# Orquestração de execução: pi.dev + Alethe

Camada de execução, dentro do passo `/implement` de `docs/workflow.md`: Claude Code fecha spec e tasks (data, backend, front, ui, tests, review, security); uma sessão `pi` (pi.dev) executa, com subagents fazendo cada task; Claude Code entra de novo depois pra revisar/validar antes da MR.

Não existe agente-pai fixo além do próprio processo `pi` — cada CLI `pi` aberta (uma por spec) é o agente-pai daquela spec, orquestrando os subagents via a tool `task`.

Economia de tokens: RTK ligado, quando disponível na máquina (instalação/configuração é setup de máquina, fora deste repo). Caveman nunca — exclusivo de sessões Claude Code (inclusive desligado na compressão do OmniRoute).

## Roteamento de modelos: OmniRoute

O `pi` não chama provider nenhum direto: todo subagent aponta pra um **combo** do OmniRoute (gateway OpenAI-compatible local, serviço do repo `ai-infra`, provider `omniroute` no `pi`). O combo decide o modelo real — free primeiro, failover entre providers quando um dá 429, pago (DeepSeek/OpenAI) só como último recurso. Trocar de modelo é mudança no combo, não neste repo.

| Combo | Papéis | Perfil |
|---|---|---|
| `omniroute/pi-exec` | `data`, `backend`, `front`, `ui`, `tests` | pool de modelos free fortes em tool calling → DeepSeek pago por último |
| `omniroute/pi-light` | `qa` | modelos free rápidos, sem pago |
| `omniroute/pi-quality` | `review`, `security` | pago primeiro (GPT Luna → DeepSeek), free só se os dois falharem |

Consequência prática: o modelo que escreveu uma task pode variar entre execuções. Isso é aceito porque a qualidade é garantida pelos gates, não pelo modelo: teste vermelho congelado, `review` no `pi-quality`, `/code-review` do Claude Code antes da MR. Se uma task falhar repetidamente no `review`, o agente-pai reporta — não fica re-tentando até cair num modelo que passe.

OmniRoute fora do ar = `pi` sem modelo. Contingência manual: trocar o `model:` do subagent pra um provider direto (`deepseek/deepseek-v4-flash`) só na sessão local, sem commitar.

## Subagents (`.pi/agents/*.md`)

8 papéis: 7 na chain do `/implement-task` (`data`, `backend`, `front`, `ui`, `tests`, `security`, `review`) + `qa`, que roda fora da chain, depois que a esteira promove `dev → qa` (ver `docs/agents/esteira-deploy.md`). O campo `model:` de cada arquivo aponta pro combo do OmniRoute daquele papel (tabela acima).

Comando `/implement-task <descrição>` encadeia os 7 papéis, pulando os que não se aplicam — nunca pula `tests`/`security`/`review`.

## Depois do `review` dar PASS

O agente-pai (`pi`) faz commit/push da branch de feature — nunca push direto em `dev`/`qa`/`hml`/`main`, mesma convenção do resto do repo (o hook `.claude/hooks/block-dangerous-git.sh` só roda em sessão Claude Code, não no `pi`, mas a regra vale igual pra ele).

`/code-review` roda manual, local, numa sessão interativa normal do Claude Code (nunca headless/`-p` disparado pelo CI — risco de cobrança fora do plano de assinatura). Ao terminar com PASS, grava `.pi/code-review-ok.json` (hash do commit revisado + data/hora) **dentro de cada repositório de código alterado** (`<projeto>-api/.pi/code-review-ok.json`, com o sha daquele repositório) — esse arquivo entra no commit normal da branch. O `.pi/` da raiz do workspace é configuração dos subagents, não prova de review.

O push em `feature/*` dispara um stage `verify-code-review` no GitLab CI: só bash, sem chamar IA nenhuma — confere se `.pi/code-review-ok.json` existe e se o hash gravado bate com o commit do push. Bateu: o mesmo job abre a MR pra `dev` automaticamente (`glab mr create --target-branch dev`). Não bateu ou não existe: pipeline falha, nenhuma MR é aberta — quem estiver rodando o `pi` precisa rodar `/code-review` de novo antes de reenviar. Promoção `dev → qa/hml/main` é a esteira de deploy (ver `docs/agents/esteira-deploy.md`), nenhum agente faz isso diretamente.

## Execução paralela

Múltiplas specs rodam em sessões `pi` paralelas, uma branch de feature por spec (via Alethe — instalação/uso é setup de máquina, fora deste repo).