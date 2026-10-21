# ADR-0007 — Cadastro de aplicações e variáveis do GitLab dentro da Esteira

Status: Proposto (precisa de discovery — `/grill-with-docs`) · 2026-10-21

## Decisão até aqui

- **Sem "Portfólio de Sistemas"** separado: a Esteira tem uma área própria pra **cadastrar aplicação** (nome, sigla, projetos GitLab ligados, tecnologia de cada projeto).
- Na mesma área, cadastrar as **variáveis do GitLab** de cada projeto (as do template-ci: `APP_TECHNOLOGY`, `KUBE_CONTEXT`, `K8S_NAMESPACE`, `APP_URL`… por ambiente), pra Esteira aplicar via **API do GitLab** e o projeto ficar pronto pra publicar.
- O `FluxoDeploy` passa a referenciar a aplicação cadastrada (hoje recebe só uma sigla de sistema).

## Em aberto (discovery)

- Valor de variável sensível: a Esteira guarda (cifrado) ou só escreve no GitLab e nunca relê? (Recomendação: só escreve, `masked`/`protected`, nunca devolve o valor.)
- Token do GitLab usado pela Esteira: de quem, com qual escopo, onde fica.
- Variáveis por ambiente (`environment_scope`) e quais são obrigatórias por tecnologia.
- Relação com a pendência "tecnologias e projetos por fluxo" (`esteira-api/docs/PENDENCIAS.md`).
