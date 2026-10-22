# CONTEXT-MAP — Esteira

| Componente | Repositório | Papel |
|---|---|---|
| API | `esteira-api/` | .NET 10, DDD + CQRS. Agregados `FluxoDeploy` e `Deploy`. Decide se cada deploy pode seguir (gate), orquestra as promoções no GitLab, recebe análises das pipelines e serve o frontend. Arquitetura e padrões: `esteira-api/CLAUDE.md`; backlog: `esteira-api/docs/PENDENCIAS.md`. |
| Frontend | `esteira-frontend/` | Angular 22 (ADR-0005). Telas de fluxo de deploy, etapas, deploys/análises e cadastro de aplicações. |

## Como conversam

```
navegador ──cookie esteira_session──► esteira-frontend (nginx) ──/api──► esteira-api ──► Postgres (banco esteira)
                                                                            ├──► Redis (sessões, ADR-0004)
                                                                            ├──► Keycloak (realm esteira, ADR-0004)
pipelines GitLab (template-ci) ──HTTP + id_token (abrir · gate · resultado)──►┘   (ADR-0008)
esteira-api ──API do GitLab (bot)──► tags, branches release/*, merge de MR, play de job (ADR-0008)
GitLab ──webhook de pipeline──► esteira-api (status ao vivo)
RabbitMQ (vhost esteira): só interno da esteira-api — o endpoint recebe o relatório da pipeline, publica na fila, consumer processa (outbox: pendência)
```

- Contrato front ↔ API: OpenAPI da `esteira-api`, tipos gerados no front (`openapi-typescript`). Paginação ADR-0002, erros ADR-0003.
- Feature que toca os dois: API primeiro e retrocompatível (`docs/agents/workspace.md`).

## Linguagem

- **Aplicação** — o que se entrega: cadastrada na Esteira, ligada a um ou mais projetos do GitLab (substitui o "portfólio de sistemas" do sistema legado). _Evitar:_ Sistema (termo legado).
- **Projeto** — um repositório de código do GitLab que pertence a uma Aplicação (ex.: `<app>-api`, `<app>-frontend`); tem versão própria.
- **Fluxo de deploy** — o caminho de uma versão nova de **um Projeto** até produção (Aplicação + stack + versão: o front pode estar no fluxo da v1 enquanto a API está no da v4). Toda publicação começa num Fluxo aberto na Esteira. Tipos: **normal** (versão MAJOR ou MINOR nova, passa por todas as etapas) e **hotfix** (correção sobre o que já está em produção, etapas reduzidas).
- **Entrega** — o conjunto de Fluxos parceiros (um por Projeto) que entregam juntos as mesmas issues, ex.: a feature "Extrato em PDF" = fluxo v4.0.0 da API + fluxo v2.1.0 do front. Todo Fluxo pertence a exatamente uma Entrega (um Fluxo sozinho é uma Entrega de um Projeto). Aprovação da proposta, de negócio e da entrega são da Entrega; aprovação da candidata é de cada Fluxo. Os parceiros andam e publicam na ordem da dependência declarada (ex.: front depende de api).
- **Candidata** — uma tentativa de uma versão dentro do Fluxo (`vX.Y.Z-rc1`, `-rc2`…). Uma versão pode ter várias candidatas; só a aprovada vira a versão final.
- **Etapa** — passo do fluxo, com status Não iniciado / Executando / Concluído / Cancelado. Fluxo normal: **ABER** (abertura: projeto, versão e issues) → **AET-1** (aprovação técnica da proposta) → **DEV** → **QA** (inclui a aprovação da candidata) → **HML** → **AAN** (aprovação de negócio) → **AET-2** (aprovação técnica da entrega) → **PRD**. Fluxo hotfix: ABER → AET-2 → PRD.
- **Ambiente** — onde uma versão roda: dev, qa, hml, produção. Cada Ambiente de um Projeto atende um Fluxo por vez.
- **Destino** — um lugar concreto onde um Projeto é publicado dentro de um Ambiente (cluster/namespace/nó), com configuração própria. Um Ambiente pode ter vários.
- **Deploy** — a publicação de uma Candidata num Destino. Uma Candidata num Ambiente gera a lista de Deploys, um por Destino; a etapa do Ambiente só conclui com todos OK.
- **Análise** — resultado de uma verificação, feita por uma ferramenta ou por um agente. Contém **achados**. Pode ser **da Candidata** (depende só do código/imagem: SAST, SCA, segredos, IaC, imagem, code-review, agente security — roda uma vez) ou **do Deploy** (depende da aplicação rodando naquele Destino: smoke, DAST, agente de qa).
- **Aprovação da candidata** — aprovação humana de cada Candidata nova, no primeiro Ambiente onde ela roda (QA no caminho normal, HML numa correção nascida lá), olhando o resultado do agente de qa e os achados.
- **Achado** — um problema apontado por uma Análise, com severidade. _Evitar:_ artefato (no GitLab, artefato é arquivo de job).
- **Exceção** — decisão registrada de não bloquear por um tipo de Achado (falso positivo ou risco aceito) numa Aplicação: tem motivo, quem pediu, quem aprovou (outra pessoa) e validade. Vencida, o Achado volta a bloquear. O Achado continua visível, marcado como exceção.
- **Aprovação** — decisão humana registrada na Esteira que libera o Fluxo (técnica, de negócio, ida para produção). A Esteira é a fonte de verdade. Quem criou o Fluxo (ou pediu a Exceção) não aprova, exceto o MOR, e aí a aprovação fica marcada como **autoaprovação**, com motivo obrigatório. _Não confundir com_ **revisão de código** (aprovação de MR no GitLab), que avalia o código e não a entrega.
- **Notas de entrega** — o que mudou numa versão, em linguagem de produto (endpoints, telas, o quê e por quê), para quem não lê código. Geradas quando a Candidata chega ao HML, lidas na AAN, conferidas na AET-2 e publicadas com a versão.
- **Cancelamento** — encerrar um Fluxo antes de produção. Sempre decide o destino do código já entregue em `dev`: **reverter** (sai do código; fluxos que o carregam precisam de nova candidata) ou **absorver** (passa a ser declarado no próximo fluxo). Nunca silencioso. Cancelar um Fluxo no meio de uma Entrega obriga a escolher: **cancelar a Entrega inteira** ou **desvincular** o Fluxo (vira Entrega própria; aprovação de negócio e da entrega da original recomeçam).
- **Rollback** — voltar o Ambiente de produção para uma versão final anterior (mesma imagem, já existente). É uma operação sobre o Ambiente, não um Fluxo: pedida na Esteira, com motivo; o Fluxo que publicou a versão revertida fica marcado como revertido. Numa Entrega, volta os parceiros já publicados em ordem inversa à dependência. O banco não volta. Depois dele o Projeto fica **em rollback** até a correção para frente (hotfix ou versão nova) ser publicada; nada mais desse Projeto entra em produção enquanto isso.
- **Sincronização** — levar para os estágios de baixo um código que entrou por cima (hotfix em produção, correção nascida em qa/hml), sem publicar nada. Depois dela, os Fluxos abertos cuja candidata não tem esse código precisam de nova candidata.
- **Papéis** — por Aplicação: **Analista** (mantém o cadastro da Aplicação: projetos, ambientes, destinos e a configuração de publicação; não cria nem apaga a Aplicação e não gerencia papéis), **Membro** (abre fluxo, corta nova candidata, reexecuta), **Aprovador técnico** (aprovações técnicas, aprovação de QA, Exceção), **Aprovador de negócio** (AAN), **Publicador** ("Publicar" em produção). Global: **MOR**, que pode tudo em todas as Aplicações. Fora dos papéis de uma Aplicação ninguém vê os fluxos dela, exceto o MOR.
