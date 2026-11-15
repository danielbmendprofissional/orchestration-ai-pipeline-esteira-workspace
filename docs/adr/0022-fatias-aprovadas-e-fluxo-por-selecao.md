# ADR-0022 — Fatias aprovadas, Fluxo por seleção e review leve

Status: Aceito · 2026-11-14 · Ajusta a ADR-0018 (qa automático a cada merge, Artefato gerado no merge), a ADR-0020 (review com API e front reais, "artefato atual de `dev`") e a ADR-0021 (aprovar a MR abre o Fluxo) · O resto da ADR-0021 continua valendo

O trabalho chega à `main` Fatia por Fatia, e a Esteira agrupa na hora de **publicar**, não na hora de **mergear**. Isso evita um processo inteiro (Fluxo, qa, DAST) por Fatia quando uma publicação leva dez.

## Regras

- **Review sob demanda e leve.** O botão **Abrir review** continua no cartão da Fatia e só sobe quando alguém precisa ver a implementação; quem avalia só o código não gasta infraestrutura. Fatia **de front**: preview estático, aberto direto na rota da Fatia, com sessão falsa e dados falsos tipados pelo contrato do OpenAPI (sem cluster, API nem banco). Fatia **de API**: contrato (diff do OpenAPI) e testes; app real só em `risco: alto`. O preview é destruído no merge ou fechamento da MR, com prazo máximo. Substitui "API e front reais juntos" da ADR-0020.
- **Aprovar a MR só mergeia.** A Esteira mergeia na `main` com o flag `Features:<Fatia>` **desligado em todo lugar**. Aprovar não abre Fluxo e não fixa o tipo da mudança. Reprovar continua como na ADR-0021 (comentário, fecha, reabre depois da correção).
- **Fatias aprovadas.** Depois do merge a Fatia aparece numa aba do Painel de Fatias, sem Fluxo. A pipeline da `main` a cada merge faz **só CI** (build, testes, scans e um health check efêmero da imagem), sem deploy em ambiente e sem Artefato oficial.
- **O Fluxo nasce por seleção.** Um humano seleciona **N Fatias aprovadas do mesmo Projeto** e a Esteira abre o Fluxo. O Fluxo nasce **antes** do Artefato: ao iniciar, a pipeline do Fluxo gera o Artefato oficial sobre o SHA mais recente da `main`, faz um deploy único no `qa` com os flags das Fatias selecionadas **ligados no `qa`**, e roda DAST e o agente de qa uma vez. Seguem hml e produção como na ADR-0018.
- **A seleção é declarativa.** A `main` é cumulativa: o Artefato contém também as Fatias aprovadas que não foram selecionadas, com o flag desligado. A tela mostra isso e avisa quando uma Fatia selecionada tem `Depende de` que não está na `main` ou no Fluxo. Escolher exatamente o código que sobe é Gitflow, não é o caso.
- **Só a Esteira liga flag.** Fora de Fluxo o flag da Fatia fica desligado em todo ambiente. Nos Fluxos liga no `qa` e no `hml` para validar, e em produção só na Liberação. Uma verificação de fundo detecta flag alterado fora da Esteira (pendências, seção 11).
- **Entrega.** Deixa de ser um objeto à parte: o escopo do Fluxo (a lista de Fatias do mesmo Projeto) cumpre esse papel. Uma feature que atravessa Projetos vira um Fluxo por Projeto, na ordem do `Depende de`.

## Em aberto

- **Tipo da mudança (minor ou major):** proposto declarar ao abrir o Fluxo (antes era no clique de aprovar da ADR-0021). A versão continua calculada pelo maior tipo na ida a produção.
- **Coordenação da Liberação** entre os Fluxos de Projetos diferentes da mesma feature (API e front).
- **Merge fora da Esteira:** como o Artefato só nasce na pipeline de um Fluxo, um merge fora da Esteira já não gera Artefato; falta rever se o `esteira-abrir` ainda precisa recusar algo nesse ponto.

## Consequences

- `docs/agents/spec-format.md` ganha o campo `preview:` nas Fatias de front (pendências, seção 11).
- A ADR-0009 (ocupação) segue valendo: o `qa` passa a receber um deploy por Fluxo, não por merge.
- O risco de `main` quebrada só aparecer ao abrir um Fluxo é coberto pelo health check efêmero da pipeline da `main`.
