# Triage Labels

As skills falam em termos de cinco papéis canônicos de triagem. Este arquivo mapeia esses papéis para as strings de label reais usadas no issue tracker deste repo (GitLab).

| Label em mattpocock/skills | Label neste tracker | Significado |
| --------------------------- | -------------------- | ----------- |
| `needs-triage`              | `needs-triage`        | Mantenedor precisa avaliar esta issue |
| `needs-info`                | `needs-info`           | Aguardando mais informação do reporter |
| `ready-for-agent`           | `ready-for-agent`      | Totalmente especificada, pronta para um agente AFK |
| `ready-for-human`           | `ready-for-human`      | Requer implementação humana |
| `wontfix`                   | `wontfix`              | Não será atacada |

**`ready-for-agent` não quer dizer "pode começar agora".** Quer dizer "especificada e aprovada pra agente": todas as filhas de uma spec aprovada recebem a label de uma vez. Quem decide a ordem é o `Blocked by:` — um bloqueador conta como resolvido quando está fechado **ou** já comitado na branch de feature da mesma spec (todas as filhas de uma spec vão na mesma branch e só fecham juntas, depois do merge da MR — `docs/agents/orchestration.md`, "Fechar a fatia"). Tirar a label das bloqueadas travaria o `/implement-task` no meio da spec.

**`em-execucao`** (não é papel de triagem): na issue-**mãe**, enquanto o `/implement-task` executa a fatia. Entra no início, fica até o merge da MR (quem tira é o job `fechar-fatia` do CI ou o "Fechar a fatia") e também funciona de trava entre painéis em paralelo. O board de issues por esse label mostra tudo que está em andamento; o andamento detalhado (filhas, executor, suite, review, MR) fica no painel "Execução" da descrição da mãe (`.claude/commands/implement-task.md`, "Painel na mãe"). O label `em-andamento` por filha foi aposentado.

Quando uma skill mencionar um papel (ex: "aplicar a label de triagem AFK-ready"), use a string correspondente desta tabela.

Editar a coluna da direita se o vocabulário do GitLab mudar.

## Labels de área (workspace)

Além do papel de triagem, toda issue leva a área que ela toca — `backend`, `frontend` ou as duas (ver `docs/agents/workspace.md`). É por ela que cada agente filtra o que é seu. Issue sem área volta pra `needs-triage`.
