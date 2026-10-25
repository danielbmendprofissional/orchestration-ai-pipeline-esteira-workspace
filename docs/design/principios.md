# Princípios de design deste projeto

Code-first, sem Figma como etapa obrigatória (Figma free-tier fica disponível como ferramenta pontual — ver seção final — mas nunca é gate do fluxo). O design acontece dentro do fluxo TDD+SDD (`docs/workflow.md`), na task de `ui` (`.claude/agents/ui.md`).

## A cadeia de ferramentas, na ordem em que roda

### 1. `ui-ux-pro-max-skill` — geração do sistema de design inicial

Skill instalada globalmente (`nextlevelbuilder/ui-ux-pro-max-skill`, MIT) via plugin marketplace do Claude Code ou `uipro init --ai claude`. Cobre 22 frameworks incluindo Angular. A task de `ui` consulta essa skill com o contexto da tela (ex: "dashboard B2B enterprise, denso, dark mode opcional") e recebe uma direção de design coerente e documentada — nunca "chuta" um estilo.

Essa skill nunca é a etapa final — é sempre seguida pela auditoria abaixo, porque a direção pode ser boa e a implementação do componente ainda cair em clichê de framework.

### 2. `impeccable.style` — auditoria contra a app rodando de verdade

Instalado por projeto via `npx impeccable install` (Node 22.12+), integra com Claude Code via slash commands:

1. `npx impeccable install` — uma vez por projeto.
2. `/impeccable init` — gera `DESIGN.md` (sistema visual) e `PRODUCT.md` (contexto de produto) na raiz do projeto. **Esses dois arquivos passam a ser a fonte de verdade viva do design daquele projeto** — `tokens.md` deste template é só o seed pra alimentar esse `init`, não o destino final.
3. `/impeccable detect` contra o `localhost` da aplicação implementada (61 checagens determinísticas: contraste, espaçamento, hierarquia, "tell" de IA) — olha o DOM/CSS renderizado, não o código-fonte, por isso funciona igual em Angular, React ou qualquer stack.
4. Rodar os comandos que a própria ferramenta recomendar na saída do `detect`.
5. `/impeccable audit` — relatório completo + plano de correção.
6. Corrigir iterativamente: `/impeccable adapt` (ajusta ao contexto) → `/impeccable harden` (robustez/erro/acessibilidade) → `/impeccable polish` (acabamento visual).
7. Rodar `/impeccable audit` de novo pra confirmar antes de fechar a task.

### 3. `avoid-ai-design` — segunda rede de segurança, mais rápida

Roda em `/skill:avoid-ai-design detect` no `/code-review` final (`docs/workflow.md`) — checagem rápida no diff, não a auditoria principal (essa é o `impeccable audit`). Também serve como rede mínima em specs pequenas/urgentes onde rodar a app localmente pro `impeccable detect` não compensa.

## Regra central: default não escolhido é o "tell"

Vale pra fonte, espaçamento, ícone, cópia, e pro tema de fábrica da biblioteca de componentes (ver `component-library.md`).

### P0 — qualquer pessoa reconhece como "feito por IA"
- Gradiente roxo-pro-azul, texto com `bg-clip-text`
- Fonte `Inter`/`Roboto`/system default sem ter sido decisão de `tokens.md`
- Tema de fábrica da biblioteca de componentes (spartan `stone`/`zinc`…) intocado
- Glassmorphism reflexivo
- Hero centralizado + três cards de feature ("template de SaaS genérico")

### P1 — dev/designer reconhece
- `rounded-2xl shadow-lg` em toda superfície sem variação
- Ícone-dentro-de-quadrado-arredondado repetido
- Botão azul/indigo "de fábrica"
- Cópia tipo "Elevate your workflow", "Seamless", "Powerful" sem substância

## Perfil por tipo de tela

| Perfil | Como tratar |
|---|---|
| `dashboard` / `app-component` (caso comum: Angular enterprise/SaaS) | Passe cirúrgico: densidade, legibilidade e hierarquia de informação acima de decoração. |
| Landing/marketing (React, uso pontual) | Força total — direção visual ousada vale a pena. |
| Dentro de um design system já existente | Só cirúrgico, respeita os tokens que já existem. |

## Pesquisa de referência (antes de gerar, não só depois de auditar)

Entram **antes** do passo 1, alimentando o que a task de `ui` pede pro `ui-ux-pro-max-skill`:

- **[interfaces.rauno.me](https://interfaces.rauno.me/)** — checklist de boas práticas de interação (formulário, tipografia, motion, touch, performance, acessibilidade). Usar como checklist de implementação, focado em comportamento/interação.
- **[lazyweb.com](https://www.lazyweb.com/)** — pesquisa de padrão via MCP (`lazyweb.com/mcp/public`), base real de telas e testes A/B (Duolingo/Spotify/Airbnb). Consultar quando precisar de um padrão específico já validado.

Ver `referencias.md` pro catálogo completo.

## Figma (free tier, uso pontual)

Não é etapa do fluxo padrão. Só entra se um humano não-técnico precisar visualizar/discutir uma tela antes do código. Se usado, o resultado ainda passa pela cadeia acima quando virar código — Figma nunca substitui `impeccable detect` contra a app real.

## Pedido explícito e concreto do humano

Quando o humano já chega com o pedido específico (asset pra embutir, comportamento ligado a scroll/mouse/outro evento, referência visual concreta) — isso já É a direção, não precisa passar pelo passo 1 (`ui-ux-pro-max-skill` existe pra quando NÃO há direção definida). Implementa direto com o que o template já disponibiliza (ver `component-library.md`) e segue pra auditoria normal (passo 2/3) como qualquer diff de UI.

Dois casos concretos desse tipo de pedido:

- **Código pronto, colado pelo humano**: aceitar como está, não reescrever, não passar pelo passo 1. Vai direto pra auditoria (passo 2/3) como qualquer diff de UI.
- **Ideia + referência (ex: vídeo), sem código pronto**: implementa direto, sem passar pelo passo 1 (a referência já é a direção). Se a implementação sair muito errada e precisar corrigir a direção do zero, aí sim volta e usa o passo 1 (`ui-ux-pro-max-skill`) como recurso de correção — ele não serve só pra tela sem direção nenhuma, serve também pra resgatar uma tentativa que saiu ruim.

## Fluxo prático (resumo operacional)

1. Task de `ui` lê `tokens.md`, `component-library.md` e este arquivo antes de qualquer classe/estilo.
2. Consulta `interfaces.rauno.me` e `lazyweb` (MCP, se disponível no projeto) pra validar o padrão de interação antes de implementar.
3. Usa `ui-ux-pro-max-skill` pra obter a direção de design.
4. Implementa em Angular + spartan/ui, tema mapeado a partir de `tokens.md`.
5. Roda `/impeccable detect` contra o localhost do projeto (se já configurado) e resolve com `/impeccable adapt|harden|polish`, depois `/impeccable audit` de confirmação.
6. Se `impeccable` ainda não estiver instalado no projeto, roda pelo menos `/skill:avoid-ai-design detect` como rede mínima antes de devolver a task.
7. No `/code-review` final, qualquer diff que toque UI roda `/skill:avoid-ai-design detect` de novo.
8. Acessibilidade não é opcional em nenhum perfil: `:focus-visible` ausente é sempre alta prioridade — em Angular isso também é coberto pela skill `angular-developer` (ver `component-library.md`).