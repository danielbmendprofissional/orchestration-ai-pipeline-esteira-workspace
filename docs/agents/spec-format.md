# Formato de spec

Vale para o `/to-spec` neste repositório. **Substitui o template e o processo da skill** (Problem Statement, User Stories, "sem caminho de arquivo", "não entreviste", publicar a spec inteira na issue): onde a skill disser o contrário, vale este arquivo.

O humano pode chamar só `/to-spec` ou `/to-spec <ID ou nome da fatia>` (uma ou várias). Montar o resto sozinho é trabalho seu, nesta ordem:

## 1. Achar a fatia

- Com ID/nome: a linha dela em `specs/README.md`.
- Sem argumento: a **próxima desbloqueada** do mapa — primeira não feita cuja coluna "Depende de" está toda feita. Se houver mais de uma independente, proponha especificar juntas e pergunte.
- Várias fatias no mesmo pedido: **um arquivo e uma issue-mãe por fatia**, mesmo escritas na mesma sessão.
- Fatia que não está no mapa: pare e proponha a linha nova (repositório, quem executa, depende de) antes de qualquer spec.

## 2. Gate — pronto para especificar

Confira com `git`, não pela memória: cada fatia de "Depende de" está mergeada em `dev` em cada repositório que tocou, e o que o `## Contexto necessário` vai citar existe na branch principal do workspace. Se não estiver, diga o que falta e pare — spec sobre base que não está em `dev` vira retrabalho.

## 3. Juntar o contexto

Leia, nesta ordem, e só o que a fatia toca:
1. A linha da fatia e as vizinhas no mapa (o que vem antes e o que depende dela — define o que fica fora).
2. ADRs: as citadas na linha + as que mencionam a fatia ou o assunto (`grep` em `docs/adr/` pelo ID e pelos termos; a seção "Impacto" costuma dizer "vira spec").
3. `docs/agents/padrao-frontend.md` / `padrao-api.md` na parte que a fatia toca, e o `CONTEXT-MAP.md` pros termos.
4. O **código atual** de cada repositório tocado, na branch `dev`: o que existe hoje e vai mudar, com arquivo e linha (é daí que sai o `## Checklist` ou o Backend/Frontend concreto). Mais `docs/PENDENCIAS.md` do repositório.
5. A última spec da mesma área em `specs/feature/`, como exemplo de nível de detalhe.

## 4. Perguntar só o que falta

Liste as decisões que a spec precisa e que nem ADR, nem padrão, nem código, nem a conversa respondem. **Nenhuma** → escreva direto. **Alguma** → pergunte uma por vez, com a sua recomendação, antes de escrever (é o grill, só sobre a lacuna). Decisão nova que vale além da fatia → proponha ADR.

## 5. Mostrar antes de publicar

Escreva o arquivo, mostre ao humano a Ideia (o que fica fora) e a lista de critérios/checklist, e só depois de aprovado abra a issue-mãe e atualize o mapa.

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
