# Pendências

Pendência é trabalho que ficou para depois. Para o `/situacao` e o `/proximo` conseguirem **contar**, todas seguem o mesmo formato.

## Formato

**Uma pendência = uma linha `- [ ]`** (aberta) ou `- [x]` (feita), no arquivo de pendência do repositório:

```
- [ ] **Publicar a tag v3.0.0** do template-ci e conferir que a pipeline da tag termina verde.
- [x] **Migrar esteira-api para a main** (feito em 2026-11-20).
```

- Arquivos que contam: `PENDENCIAS.md`, `pendencias-*.md`, `docs/PENDENCIAS.md`, `docs/pendencias-*.md` e `docs/mudancas-*.md`, na raiz do workspace e de cada repositório de código (mais `ai-base`, `ai-infra`, `ai-ops` e `template-ci`).
- Texto que **não** é tarefa (contexto, decisão já tomada, nota) fica em parágrafo ou em lista **sem** `[ ]`. Só linha com checkbox entra na conta.
- Feita? Troque `[ ]` por `[x]` (não apague: o histórico ajuda). Sem pendência aberta, escreva "Nenhuma aberta".
- Linha dentro de bloco de código (```) não conta.
- Arquivo cujas pendências já viram fatias do mapa (`specs/README.md`) leva `<!-- pendencias: ignorar — <motivo> -->` nas 5 primeiras linhas, para não contar em dobro.

## Quem lê

| Comando | O que mostra |
|---|---|
| `node .claude/scripts/pendencias.mjs` | uma linha por arquivo (abertas · feitas) e o total; `--lista` mostra cada pendência aberta |
| `/situacao` | uma linha "Pendências: N abertas em K arquivos" antes do veredito. **Não bloqueia** a próxima fatia |
| `/proximo` | a mesma linha, e avisa de arquivo em formato antigo |

Arquivo de pendência **sem nenhum checkbox** aparece como "formato antigo": converta cada pendência em `- [ ]`.

## Quem resolve

Não existe comando que "resolve pendência" sozinho: cada uma é decisão ou trabalho seu.
- Trabalho que é fatia do produto → `/mapa` propõe a linha no `specs/README.md`.
- Melhoria em repositório compartilhado (`ai-base`, `ai-infra`, `ai-ops`, `template-ci`) → issue e `/issue-ai <n>` ([`melhoria-orquestracao.md`](melhoria-orquestracao.md)).
- Ação sua (rodar comando, configurar o GitLab, decidir) → faça e troque para `[x]`.
