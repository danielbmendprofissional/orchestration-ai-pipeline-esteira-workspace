# Formato de spec

Vale para o `/to-spec` neste repositório. **Substitui o template da skill** (Problem Statement, User Stories, "sem caminho de arquivo", publicar a spec inteira na issue): onde a skill disser o contrário, vale este arquivo.

## Antes de escrever

- O `/to-spec` não entrevista: sintetiza o que está na sessão. Fatia cujas decisões já estão todas em ADR (ex.: contrato transversal) → basta pedir pra ele ler as ADRs e o código. Fatia com pergunta em aberto → `/grill-with-docs` curto antes, na mesma sessão, só sobre o que falta.
- **Pronto para especificar:** a fatia anterior de que esta depende (linha dela em `specs/README.md`) está mergeada em `dev` em cada repositório que tocou, e os arquivos que o `## Contexto necessário` vai citar existem na branch principal do workspace. Se não estiver, avise e pare — spec sobre base que não está em `dev` vira retrabalho.

## Arquivo

`specs/feature/<área>/NN-nome.md` é a **fonte de verdade**, versionada no workspace. Termos do `CONTEXT-MAP.md`; decisão transversal é citada pela ADR, não repetida.

```markdown
# NN — Nome da fatia

## Contexto necessário
- cada .md que o executor tem que ler (CONTEXT-MAP.md com a seção, ADRs, DESIGN.md e protótipos se tem tela, PENDENCIAS)

## Ideia
o que a fatia entrega e por quê, em poucas frases; o que fica de fora e em qual fatia entra

## Dados
## Backend
## Frontend
## Infra

## Critérios (EARS)
1. Quando <gatilho>, a <sistema> deve <resposta>.
2. Se <condição indesejada>, a <sistema> deve recusar (`codigo.do-erro`).
3. Enquanto <estado>, a <sistema> deve/não deve <comportamento>.

## Testes
por camada: o que cobre cada critério e onde (unitário, integração, API, front, E2E + axe nas telas novas)
```

- Seção que não se aplica fica escrita `N/A`, nunca omitida.
- Caminho de arquivo e nome de tipo são permitidos (o executor precisa deles); trecho de código só quando fixa uma decisão melhor que texto.
- Cada critério EARS é testável e vira pelo menos um teste. Critério vago ("deve ser bonito") volta pro grill.
- Fatia de fundação/infra/limpeza troca `Critérios (EARS)` por `## Checklist` com `- [ ]`.

## Issue-mãe

No workspace (`docs/agents/issue-tracker.md`): título da fatia, link relativo pro arquivo + resumo de 2–3 linhas, label de área (`backend`/`frontend`). **Sem `ready-for-agent`** — quem recebe esse label são as issues filhas do `/to-tickets`.

Depois de publicar: na linha da fatia em `specs/README.md`, linkar o arquivo.
