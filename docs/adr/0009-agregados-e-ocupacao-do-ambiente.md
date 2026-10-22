# ADR-0009 — Agregados do modelo novo e ocupação do Ambiente

Status: Aceito · 2026-10-22

Agregados: **Aplicação** (cadastro, papéis, política), **Entrega** (issues, aprovações da Entrega, dependência entre parceiros), **Fluxo** (etapas e candidatas), **Deploy** (um por Destino; escrita intensa vinda das pipelines) e **Análise** (separada por tamanho). A regra "um Fluxo por vez em cada Ambiente de um Projeto" atravessa Fluxos, então vira uma **ocupação**: o Fluxo reserva o Ambiente do Projeto ao entrar e libera ao sair, garantida por **índice único no banco + concorrência otimista** — nunca por consulta antes de gravar, que perde corrida entre duas requisições.

## Consequences

- A ocupação é por **Projeto × Ambiente**: Aplicações diferentes (e Projetos diferentes da mesma Aplicação) ocupam o mesmo Ambiente ao mesmo tempo sem se ver.
- Violação do índice vira erro de negócio (`ambiente.ocupado`, ADR-0003), não 500.
