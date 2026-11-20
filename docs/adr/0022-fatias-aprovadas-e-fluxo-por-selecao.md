# ADR-0022 — Fatias aprovadas, Entrega por seleção e review leve

Status: Aceito · 2026-11-14 · **ADR-0025:** "Fatia aprovada" passa a se chamar "Pronta para Entrega"; Fatia sem flag é travada na seleção · Ajusta a ADR-0018 (qa automático a cada merge, Artefato gerado no merge), a ADR-0020 (review com API e front reais, "artefato atual de `dev`") e a ADR-0021 (aprovar a MR abre o Fluxo) · O resto da ADR-0021 continua valendo

O trabalho chega à `main` Fatia por Fatia, e a Esteira agrupa na hora de **publicar**, não na hora de **mergear**. Isso evita um processo inteiro (Entrega, qa, DAST) por Fatia quando uma publicação leva dez.

## Regras

- **Review sob demanda e leve.** O botão **Abrir review** continua no cartão da Fatia e só sobe quando alguém precisa ver a implementação; quem avalia só o código não gasta infraestrutura. **Parte de front** da Fatia (qualquer Fatia que toque o front, inclusive as `api + frontend`): preview estático, aberto direto na rota da Fatia, com sessão falsa e dados falsos tipados pelo contrato do OpenAPI (servido por um nginx mínimo no namespace `preview` do cluster `esteira-nao-prod`, ADR-0025; sem API nem banco). **Parte de API**: contrato (diff do OpenAPI) e testes; app real só em `risco: alto`. O preview é destruído no merge ou fechamento da MR, com prazo máximo. Substitui "API e front reais juntos" da ADR-0020.
- **Aprovar a MR só mergeia.** A Esteira mergeia na `main` com o flag `Features:<Fatia>` **desligado em todo lugar**. Aprovar não abre Fluxo e não fixa o tipo da mudança. Reprovar continua como na ADR-0021 (comentário, fecha, reabre depois da correção).
- **Fatias Prontas para Entrega** (nome da ADR-0025; aqui "aprovadas"). Depois do merge a Fatia aparece numa aba do Painel de Fatias, sem Fluxo. A pipeline da `main` a cada merge faz **só CI** (build, testes, scans e um health check efêmero da imagem), sem deploy em ambiente e sem Artefato oficial.
- **A Entrega nasce por seleção.** Um humano seleciona **N Fatias Prontas para Entrega, de qualquer mistura** (só API, só front, ou `api + frontend`) e abre uma **Entrega**. A Esteira cria **um Fluxo por Projeto** tocado pelas Fatias (uma Fatia `api + frontend` entra nos dois). A Entrega nasce **antes** do Artefato: ao iniciar, a pipeline de cada Fluxo gera o Artefato oficial sobre o SHA mais recente da `main` do Projeto, faz um deploy único no `qa` com os flags das Fatias do Fluxo **ligados no `qa`**, e roda DAST e o agente de qa uma vez por Fluxo. Seguem hml e produção como na ADR-0018.
- **A seleção é declarativa.** A `main` é cumulativa: o Artefato contém também as Fatias Prontas para Entrega que não foram selecionadas, com o flag desligado. A tela mostra isso e avisa quando uma Fatia selecionada tem `Depende de` que não está na `main` nem na Entrega. Escolher exatamente o código que sobe é Gitflow, não é o caso.
- **Só a Esteira liga flag.** Fora de Entrega o flag da Fatia fica desligado em todo ambiente. Nas Entregas liga no `qa` e no `hml` para validar, e em produção só na Liberação. Uma verificação de fundo detecta flag alterado fora da Esteira (pendências, seção 7, pergunta 8).
- **Entrega e Fluxo (como nos protótipos aprovados e na ADR-0009).** Abrir uma Entrega é **iniciar o processo**. A Entrega agrupa 1 ou mais Fluxos (um por Projeto, hoje API e front), tem a própria tela com **uma faixa por Fluxo** e coordena a ordem entre eles (API primeiro, pelo `Depende de`). O **Fluxo** é a faixa de um Projeto: ambientes, pipeline e aprovações de ambiente, e agrupa as Fatias que tocam o Projeto dele. Um Fluxo existe em exatamente uma Entrega. Uma Fatia `api + frontend` está nas duas faixas e só é liberada quando as duas estão em produção. (Versões anteriores desta ADR trataram o Fluxo como o que se abre e a Entrega como agrupamento opcional; estava errado.)

## Em aberto

- ~~Tipo da mudança (minor ou major)~~ **Resolvido na ADR-0023** (seção "Versão"): declarado ao abrir o Fluxo, e o número só nasce na confirmação em produção.
- ~~Coordenação da Liberação entre Projetos~~ **Resolvida na ADR-0023** (seção "Dependência entre Projetos"), pelo `Depende de` do mapa.
- ~~Merge fora da Esteira~~ **Resolvido na ADR-0025** (seção "Não gerar Artefato sem Entrega"): o modo `fluxo` só roda por trigger do bot e o `esteira-abrir` recusa sem Entrega aberta para o Projeto e o SHA. **Resolvido na ADR-0025:** sim, e o modo `fluxo` só roda por trigger do bot.

## Consequences

- `docs/agents/spec-format.md` ganha o campo `preview:` nas Fatias que tocam o front (pendências, seção 3.1).
- A ADR-0009 (ocupação) segue valendo: o `qa` passa a receber um deploy por Fluxo, não por merge.
- O risco de `main` quebrada só aparecer ao abrir uma Entrega é coberto pelo health check efêmero da pipeline da `main`.
- O mapa de fatias já tem Fatias `api + frontend` (B3, A1, E1): a Fatia não é de um repositório só.
