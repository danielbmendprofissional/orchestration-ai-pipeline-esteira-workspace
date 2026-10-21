# Biblioteca de componentes — recomendação por stack

**Angular é a stack fixa pra todo site/aplicativo web enterprise/SaaS deste template.** React fica reservado só pra landing page isolada ou uso futuro pontual.

## Default: Angular + PrimeNG + Tailwind

**[PrimeNG](https://primeng.org/)** é o default de componentes pra qualquer projeto Angular nascido deste template.

**[Tailwind CSS](https://tailwindcss.com/)** entra como default junto do PrimeNG, não como alternativa. PrimeNG cuida do componente em si (`p-button`, `p-table`); Tailwind cuida do entorno (grid/flex da página, espaçamento entre componentes, ajuste fino de utilitário). `tailwind.config` mapeado a partir de `tokens.md` (cor, espaçamento, tipografia) — preset do PrimeNG e `tailwind.config` sempre com os mesmos valores, nunca um com token e o outro no default de fábrica.

**Regra:** tema default do PrimeNG intocado, ou classe Tailwind de fábrica sem token por trás, é P0. A task de `ui` sempre aplica o tema gerado a partir de `tokens.md` nos dois (preset PrimeNG e `tailwind.config`), nunca aceita a paleta "Aura"/"Lara" de fábrica do PrimeNG nem a paleta default do Tailwind sem customização de cor/tipografia/raio.

### Skills oficiais do Angular

Skills mantidas pelo time do Angular (`github.com/angular/skills`), instaladas via `npx skills add https://github.com/angular/skills`:

- **`angular-developer`** — geração de código e orientação arquitetural: componentes standalone, signals, forms, injeção de dependência, roteamento, SSR, acessibilidade (ARIA), animações, estilo, testes, CLI. Fonte de verdade de convenção de código Angular pras tasks `front` e `ui`, acima de qualquer hábito antigo (NgModules, RxJS-first sem necessidade).
- **`angular-new-app`** — bootstrap de projeto novo via Angular CLI com estrutura moderna recomendada.

Instalação real (PrimeNG + Tailwind) roda por projeto, na configuração de ambiente daquele projeto — não faz parte do `ai-base` em si.

### Se o caso for React (landing page isolada ou uso futuro)

**shadcn/ui** como default (componentes copiados pro repo, Radix por baixo, acessibilidade real). Evitar Material UI/Chakra UI como default. Só se aplica quando o projeto justificou explicitamente ser uma landing/marketing separada do app Angular principal — nunca como fallback pra tela de produto.

### Bibliotecas de referência (não pra copiar direto — Angular ≠ React)

`Aceternity UI`, `21st.dev` e `bklit UI` são catálogos de componentes **React/Tailwind**. Não dá pra instalar num projeto Angular. Uso correto: **referência de padrão visual e de interação** (um card com hover específico, uma animação de entrada de dashboard, um jeito de estruturar um chart) — a task de `ui` reimplementa a ideia em Angular/PrimeNG/CSS, nunca importa o pacote React. Ver `referencias.md` pra lista completa e papel de cada site.

## Motion / animação

- **[anime.js](https://animejs.com/)** — motor de animação JS puro, controlando classe/estilo via `ElementRef`/`Renderer2`. Primeira escolha pra motion custom.
- **[Motion](https://motion.dev/)** (ex-Framer Motion) — usar só a API vanilla (`motion` core) em Angular, nunca os componentes React (`motion/react`).

Regra do `principios.md` vale igual pra motion: nada de "fade-in-up" genérico repetido em tudo — ver seção de Movimento em `tokens.md`.

### Interação custom sob pedido explícito (vídeo, scroll, cursor, o que for)

Quando o pedido envolve ligar algo visual a um evento do navegador (asset de vídeo, posição de scroll, posição do mouse, etc.), a implementação usa Angular nativo pro evento/asset (`<video>`, `HostListener` de scroll/mousemove, `ElementRef`/`Renderer2`, `IntersectionObserver`) combinado com `anime.js`/`Motion` pra suavizar o movimento resultante. Não existe uma lista fixa de "padrões aprovados" — qualquer combinação de evento do navegador + essas duas libs de motion está dentro do que este template já disponibiliza, sem precisar de lib nova.

## Regra fixa, independente da biblioteca escolhida

Nenhuma biblioteca de componentes ou utilitário de CSS substitui `tokens.md`. Um `p-button` do PrimeNG com tema default não customizado é P0, exatamente como uma classe Tailwind de fábrica (`bg-blue-500`, `rounded-2xl shadow-lg`) usada sem passar pelo `tailwind.config` mapeado dos tokens.