# ADR-0025 — Refinamentos: nomes dos estados, Fatia sem flag, limpeza, SHA verde e travas

Status: Aceito · 2026-11-15 · Refina as ADRs 0018, 0019, 0021, 0022, 0023 e 0024 (o que não é citado aqui continua valendo) · Decidido na revisão de `pendencias-orchestration-ai.md`

## Nomes dos estados da Fatia

"Aprovada" confundia: significava só "MR mergeada", mas soava como "passou em tudo".

| Antes | Agora | Significado |
|---|---|---|
| Aprovada | **Pronta para Entrega** | MR mergeada na `main`, flag desligado, ainda **não** validada em qa nem hml |
| Publicada, não liberada | **Aguardando liberação** | Passou por qa e hml, está em produção com o flag desligado |

As abas do Painel de Fatias passam a se chamar **Prontas para Entrega** e **Aguardando liberação**. Onde as ADRs 0021 a 0024 dizem o nome antigo, leia o novo. "Em Entrega" e "Liberada" não mudam.

## Fatia sem flag (`flag: não`)

A `main` é cumulativa, então o código dela vai em qualquer Artefato, selecionada ou não.

- Na Abertura da Entrega, as Fatias **sem flag** Prontas para Entrega vêm **pré-selecionadas e travadas**: não dá para desmarcar. Passam por qa e hml com as demais; se uma falhar, a Entrega fica bloqueada até a correção.
- Quando o Fluxo chega a produção, ela vira **Liberada** sozinha (não há flag para ligar).
- **Saída (Excluir):** o aprovador de negócio pode excluir uma Fatia sem flag, com motivo e nome registrados. A seleção destrava na hora e a Esteira cria a issue de limpeza (abaixo). Enquanto a Fatia de limpeza não for mergeada, a Esteira **bloqueia abrir Entrega nova daquele Projeto** (o código ainda vai em todo Artefato) e mostra o aviso na tela. **O hotfix continua permitido**, por ser a saída de emergência.
- **Fatia com flag, excluída:** o código fica inerte (flag desligado em todo lugar) e **não bloqueia nada**; a limpeza pode esperar, com lembrete (abaixo).

## Fatia de limpeza

- Código **`<código>-L`** (ex.: `B2-L`), sempre sem flag.
- A Esteira só cria a **issue de pedido** ("Limpeza da Fatia B2", rótulo `ready-for-human`). Ela **não executa comandos** nem escreve spec ou mapa (ADR-0021).
- O `/fatia`, rodado nessa issue, **cria a linha `B2-L` no mapa** e segue o fluxo normal (spec aprovada pelo humano, tickets, MR).

## Lembrete de dívida (nunca bloqueia)

Vale para Fatia excluída com flag (limpeza pendente) e para Fatia em **Aguardando liberação**.

- Contagem de idade no Painel ("limpeza pendente há N dias"), com filtro próprio.
- Aviso informativo, na tela de abertura da Entrega, das limpezas pendentes do Projeto.
- **Prazo padrão de 30 dias**, configurável por Aplicação; passado o prazo, a Fatia aparece em destaque.
- Depois do prazo, o bot comenta toda semana na issue de limpeza, que é onde o humano trabalha.

## Qual SHA o Fluxo usa e quando

- O Fluxo usa o **último SHA da `main` com pipeline verde**, e **registra** o SHA exato. A Esteira **recusa abrir Entrega** com a `main` vermelha.
- O Artefato é **construído de novo** no Fluxo (decisão mantida da ADR-0022). O build e o health check do merge na `main` são conferência para aprovar a MR, não o Artefato. Mitigação da diferença entre os dois builds: lockfiles e imagem base fixada por digest. O que importa é que o **mesmo Artefato** percorra qa, hml e produção.

## Fatia `api + frontend`

- Só vira **Pronta para Entrega** quando as **duas MRs** estão na `main`, com a da **API primeiro** (`Depende de`). Aprovar a Fatia mergeia as duas, nessa ordem.
- Sem `Closes` automático nessas Fatias: o `fechar-fatia` fecha a issue-mãe e as filhas só depois da última MR.

## Merge

**Merge commit, sem squash.** O contrato lê um commit por task e o `status-specs.mjs` procura o merge commit; squash apagaria esse rastro. No GitLab: "pipeline must succeed" e "todas as threads resolvidas" ativos.

## Hotfix

Continua partindo da `main` (ADR-0018). Ele pode levar código de Fatias Prontas para Entrega que nunca passaram por qa, sempre com o flag desligado. **Risco aceito** pelo dono: flag desligado, bem controlado, não é risco.

## Rollback

- As Fatias da versão revertida voltam para **Aguardando liberação** (ou **Pronta para Entrega**, se ainda não tinham sido liberáveis), com o flag desligado.
- Se o deploy atual rodou uma migração `contract`, a Esteira **avisa ou bloqueia** o rollback, porque a versão anterior pode depender do que o `contract` removeu (ADR-0019).

## Flags

- **Aplicar mudança de flag: reiniciar o pod** (rollout restart), no .NET e, quando preciso, no front. Dá um sinal claro de "aplicado" e o smoke roda logo depois.
- A **fonte da verdade** do flag é o banco da Esteira; o cluster é projeção. O job de leitura do estado real serve só para detectar divergência.
- **Entrega superada no qa:** a Esteira **desliga automaticamente no qa** os flags das Fatias que voltaram para Prontas para Entrega.

## Smoke e DAST

- **Smoke em produção: só leitura.** O foco da verificação é o DAST (ativo no qa, passivo em hml e depois da Liberação).
- **Concorrência no qa:** Artefato novo chegando **cancela o teste em andamento** (ex.: DAST ativo) e marca o Fluxo antigo como **Superado**. O deploy de cada Ambiente usa `resource_group` do GitLab, para nunca haver dois deploys simultâneos no mesmo Ambiente.

## Onde o preview do front roda

No **Kubernetes** (`esteira-nao-prod`, namespace `preview`), não no GitLab Pages: um nginx mínimo por MR serve o front compilado em modo preview, sem API nem banco, com endereço por Fatia. Validade máxima de 7 dias, destruído no merge ou fechamento e por um job diário; no máximo 5 previews simultâneos (configuração). Combina com o motivo declarado da ADR-0020 (aprender Kubernetes) e dispensa depender de Pages no GitLab.

## Não gerar Artefato sem Entrega (responde ao "Em aberto" da ADR-0022)

Qualquer pessoa com permissão no GitLab consegue iniciar um pipeline à mão. Duas travas, ambas obrigatórias:
1. O modo `fluxo` só roda se o pipeline foi **disparado pelo bot da Esteira** (trigger); disparo manual pela tela do GitLab não funciona.
2. O `esteira-abrir` continua **recusando** (fail-closed, ADR-0008) quando não existe Entrega aberta para aquele Projeto e SHA.

## A Esteira fica fora do esquema

Os repositórios `esteira-api` e `esteira-frontend` **não entram** em Entrega, Fluxo, Painel de Fatias nem botão Aprovar. Merge e promoção são **manuais** no GitLab (`when: manual`), como na ADR-0018. Isso elimina a pergunta 7.9 das pendências.
