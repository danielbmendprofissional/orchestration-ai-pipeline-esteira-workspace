# Melhoria na orquestração (issues no `orchestration-ai`)

Vale para qualquer agent (a sessão do projeto, o `/implement-task`, o agent `local-environment-config`) que perceba, no meio de uma fatia ou de uma configuração, que **falta ou está errado algo em um repositório compartilhado** do grupo `orchestration-ai`. Em vez de contornar em silêncio, mexer no que não é seu ou esquecer, ele **propõe, pergunta e, com o sim do humano, abre uma issue**.

## Para onde vai

| Repositório | Quando |
|---|---|
| `orchestration-ai/ai-base` | processo, comandos, agentes, scripts, `docs/agents/`, templates do workspace |
| `orchestration-ai/ai-infra` | manifesto, `infra-config.mjs` (inclusive o `verify`), compose, OmniRoute |
| `orchestration-ai/ai-ops` | agents de ambiente, guias humanos (`COMO-CRIAR-UM-PROJETO.md`, glossário) |
| `orchestration-ai/ai-pipeline/template-ci` | jobs e regras da pipeline |

Melhoria do **produto** (ex.: um item que falta no mapa de fatias) não é isto: vai para o mapa do projeto (`/mapa`).

## 1. Propor (o agent, sem executar nada)

Diga ao humano, em poucas linhas:
- **o quê e onde:** a melhoria e o repositório;
- **por quê:** o que ela evita ou prova (a lacuna concreta, com o arquivo ou comando onde apareceu);
- **bloqueia?** `sim — a fatia <código> não deve seguir/ser mergeada antes` ou `não — pode ser feita depois; sugestão: antes da <fatia>`. Dê a sua recomendação;
- o **contorno** que vale enquanto não for feita (se houver).

Pergunte: **"Abro a issue no `<repositório>`?"** Sem resposta clara, não abra.

## 2. Abrir (o agent, com o sim)

```powershell
glab label create -R orchestration-ai/<repo> --name melhoria --color "#5f6fb3"            # só se não existir
glab label create -R orchestration-ai/<repo> --name "origem:<projeto>" --color "#999999"   # idem
glab label create -R orchestration-ai/<repo> --name "bloqueia:<projeto>" --color "#d9534f" # idem, só se bloqueia
glab issue create -R orchestration-ai/<repo> --title "[<projeto>] <resumo>" --label "melhoria,origem:<projeto>[,bloqueia:<projeto>]" --description "<corpo>"
```

Corpo da issue (sempre estes campos):

```markdown
**Origem:** <projeto> · fatia/ticket <código> · <agent ou sessão>
**Problema:** o que falta ou está errado, com o arquivo/comando onde apareceu.
**Proposta:** o que mudar (só leituras? só config? código da ferramenta?).
**Fora do escopo:** o que NÃO entra.
**Critérios de aceite:**
- [ ] ...
**Bloqueio:** `bloqueia <fatia> até mergear` | `não bloqueia — sugestão: antes de <fatia>`
**Contorno enquanto isso:** ...
```

Depois de abrir, diga o link e **o efeito na fatia**: se bloqueia, pare ali e diga o que fazer até o merge; se não, siga e avise que a issue aparece no `/proximo`.

## 3. Executar (outro agent, no repositório da issue)

O humano abre o Claude **na pasta do repositório** (`ai-infra`, `ai-base`, `ai-ops` ou `template-ci`) e digita:

```
/issue-ai 7
```

O comando (`.claude/commands/issue-ai.md`, presente em cada um desses repositórios) lê a issue, mostra o plano, implementa numa branch, abre a MR e comenta na issue. **Nunca mergeia**: o merge é do humano.

## 4. Acompanhar

O `/proximo` do projeto lista as issues abertas com `bloqueia:<projeto>` nos quatro repositórios. Fatia bloqueada por uma delas não é recomendada como próxima enquanto a MR da issue não estiver mergeada.
