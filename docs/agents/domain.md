# Domain Docs

Como as engineering skills devem consumir a documentação de domínio deste repo.

## Antes de explorar, ler

- **`CONTEXT-MAP.md`** na raiz do repo, se existir: lista cada bounded context deste projeto e onde o `CONTEXT.md` dele mora (path local, ou referência externa se o contexto vive em outro repositório). Ler o(s) `CONTEXT.md` relevante(s) ao tópico em questão.
- Se não existir `CONTEXT-MAP.md`, procurar um **`CONTEXT.md`** solto na raiz (projeto com um único contexto ainda não precisa de mapa).
- **`docs/adr/`**: ler ADRs que tocam a área em que você vai trabalhar — na raiz (decisão cross-cutting) ou dentro do contexto específico, se o projeto organizar ADR por contexto.

Se nada disso existir ainda, **prosseguir em silêncio**. Não sinalizar a ausência; não sugerir criação antecipada nem inventar uma estrutura. Isso se resolve do jeito descrito abaixo, não por heurística de arquivo.

## Quantos contextos existem, e onde cada um mora: decisão do humano, não inferência de arquivo

Não existe "modo single-context" e "modo multi-context" como dois estados fixos do repo, e não existe uma pasta-padrão (`src/<contexto>/`, `Modules/<Contexto>/`, `packages/*`) que sirva de sinal confiável — arquitetura de backend varia demais pra isso: monolito modular, microsserviços em repos separados, vertical slice, camadas sem separação por domínio, ou qualquer mistura no meio do caminho. Tentar adivinhar por convenção de pasta erra sistematicamente pra quem não usa a convenção que a regra esperava.

Em vez de inferir, **a skill `/domain-modeling` (via `/grill-with-docs`) confirma isso direto com o humano**, na primeira vez que um termo de domínio realmente precisa ser fixado — nunca decide sozinha, silenciosamente, quantos contextos o projeto tem:

1. Perguntar: esse domínio já se divide em mais de um bounded context com vocabulário próprio, ou ainda é um só? (Sinal que ajuda a puxar a conversa, não que decide sozinho: dois módulos já usando o mesmo termo com sentido diferente.)
2. Se for só um: `CONTEXT.md` na raiz do repo (ou na raiz do subsistema relevante, ex: `backend/`, se front e back tiverem glossários que não se sobrepõem). Sem `CONTEXT-MAP.md` — não precisa pra N=1.
3. Se for mais de um: perguntar onde o código de cada contexto mora nesse projeto específico — pode ser uma pasta de módulo, um serviço em subpasta, um repositório inteiro separado. Gravar em `CONTEXT-MAP.md` na raiz: nome do contexto → caminho (ou referência externa). Cada `CONTEXT.md` fica ao lado do código daquele contexto, onde quer que essa conversa tenha definido que ele mora — nunca presumir `src/<contexto>/` como padrão.
4. Se o projeto já usa `CLAUDE.md` aninhado por módulo/serviço (arquitetura/stack daquele módulo, carregado automaticamente pelo Claude Code por pasta), o `CONTEXT.md` do contexto correspondente mora ao lado dele quando fizer sentido — são arquivos com papéis diferentes: `CLAUDE.md` é "como isso é construído", empilhado automático por pasta; `CONTEXT.md` é "vocabulário e decisões deste domínio", só lido quando uma instrução manda ler.

**Workspace (padrão, ver `docs/agents/workspace.md`):** o ponto de partida é um contexto por repositório de código — `CONTEXT.md` dentro de `<projeto>-api/` e de `<projeto>-frontend/` (glossários que não se sobrepõem), e `CONTEXT-MAP.md` na raiz do workspace apontando os dois (`backend → <projeto>-api/CONTEXT.md`). Contextos a mais dentro de um repositório seguem a conversa acima.

**Revisão:** se durante o trabalho aparecer sinal de que a divisão não bate mais com a realidade (vocabulário colidindo entre partes que hoje compartilham um `CONTEXT.md`, ou um contexto novo claramente nascendo), a skill confirma de novo com o humano antes de reorganizar — não decide sozinha que agora precisa dividir ou juntar contextos.

## Usar o vocabulário do glossário

Ao nomear um conceito de domínio (título de issue, proposta de refactor, hipótese, nome de teste), usar o termo como definido no `CONTEXT.md` certo (o do contexto relevante, se o projeto tiver mais de um). Não migrar para sinônimos que o glossário evita explicitamente.

## Sinalizar conflitos de ADR

Se sua saída contradiz uma ADR existente, sinalizar explicitamente em vez de sobrescrever silenciosamente.