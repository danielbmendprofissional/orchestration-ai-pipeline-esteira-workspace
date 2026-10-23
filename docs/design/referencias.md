# Catálogo de referências

Papel real de cada site/ferramenta neste template (Angular-fixo). "Ferramenta consultável" = um agente pode chamar/ler programaticamente. "Inspiração visual" = referência humana, reimplementada manualmente em Angular, nunca copiada como pacote.

| Site/ferramenta | O que é | Papel aqui |
|---|---|---|
| [dark.design](https://www.dark.design/) | Galeria de inspiração de UI em dark mode | Inspiração visual — paleta/composição em dark mode |
| [Aceternity UI](https://ui.aceternity.com/) | Catálogo de componentes React + Tailwind, muito animado | Inspiração visual/interação — reimplementar em Angular/spartan + anime.js/Motion, nunca importar o pacote React |
| [21st.dev](https://21st.dev/) | Marketplace de componentes React ("shadcn-like") | Mesmo papel do Aceternity: inspiração, não dependência |
| [spartan/ui](https://www.spartan.ng/) | Biblioteca de componentes **Angular nativa**, MIT, modelo shadcn (helm copiado pro repositório) | **Default de componentes da Esteira** — ver `component-library.md` e ADR-0015 |
| [bklit UI](https://bklit.com/) (`github.com/bklit/bklit-ui`) | Biblioteca de charts/data-viz React, construída sobre shadcn/ui | Inspiração pra visualização de dados densa (dashboard) — reimplementar com a lib de chart Angular do projeto (o helm `chart` do spartan, sobre TanStack Charts), nunca o pacote React |
| [anime.js](https://animejs.com/) | Motor de animação JS puro | **Ferramenta usável direto em Angular** — ver seção Motion em `component-library.md` |
| [Motion](https://motion.dev/) (ex-Framer Motion) | Biblioteca de animação; tem API vanilla e integração React | Usar só a API vanilla (`motion` core) em Angular; os componentes `motion/react` não se aplicam |
| [interfaces.rauno.me](https://interfaces.rauno.me/) | Checklist de boas práticas de interface web (não é galeria) | **Ferramenta consultável** — checklist de interação/acessibilidade/motion, ver `principios.md` |
| [lazyweb.com](https://www.lazyweb.com/) | Pesquisa de padrão de produto via MCP, base de telas reais + testes A/B | **Ferramenta consultável via MCP** (`lazyweb.com/mcp/public`) — ver `principios.md` |
| [Vercel](https://vercel.com/) | Plataforma de deploy + ecossistema de design (v0, Next.js) | Referência de padrão de design de mercado; plataforma padrão se uma landing React deste template precisar de deploy próprio — não é dependência do fluxo Angular |
| Figma (free tier) | Ferramenta de design tradicional | Uso pontual, não obrigatório — ver seção final de `principios.md` |