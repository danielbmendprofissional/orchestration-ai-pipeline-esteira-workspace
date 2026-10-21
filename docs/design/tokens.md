# Design tokens — ponto de partida

Este arquivo é um **starter/seed**, não a resposta final. Desde a adoção da cadeia `ui-ux-pro-max-skill` + `impeccable.style` (ver `principios.md`), a fonte de verdade viva do design de um projeto real passa a ser o `DESIGN.md` gerado por `/impeccable init` (formato "Google Stitch") na raiz daquele projeto — este `tokens.md` serve pra alimentar esse `init` com um ponto de partida consciente, em vez de deixar a IA inventar cor/fonte na hora zero. O que fica fixo é a **estrutura** (ter uma escala, não valores soltos), não os valores em si.

Formato neutro (JSON), pra não prender a um framework — o mapeamento real acontece assim:

- **Angular (default deste template)**: os valores viram **os dois ao mesmo tempo, batendo entre si** — o tema do **PrimeNG** (Design Tokens da API de Theming, `definePreset`) pra componente, e o `tailwind.config` pra layout/espaçamento/utilitário (Tailwind é oficialmente suportado em Angular 20+) — ver `component-library.md`. Nunca mapear só um dos dois e deixar o outro no default de fábrica.
- **React (landing page isolada)**: `tailwind.config` ou tema do shadcn/ui, como antes.

O `ui` (`.pi/agents/ui.md`) deve sempre consumir tokens a partir do tema já mapeado (PrimeNG preset ou `DESIGN.md` do projeto), nunca inventar um valor de cor/espaçamento ad-hoc no meio de uma task.

## Cor

Evite o par roxo/azul de gradiente (P0 do catálogo de `avoid-ai-design`, ver `principios.md`) como default não-escolhido. Escolha uma cor de marca real quando o projeto tiver uma; até lá, use esta paleta neutra como placeholder — ela existe pra não deixar a task de `ui` cair no azul/indigo de fábrica por preguiça:

```json
{
  "color": {
    "brand": {
      "50":  "#f4f7f5",
      "100": "#e3ebe6",
      "300": "#9bb8a8",
      "500": "#3d6b52",
      "700": "#274538",
      "900": "#132420"
    },
    "neutral": {
      "0":   "#ffffff",
      "50":  "#f7f7f6",
      "200": "#e2e1de",
      "500": "#7a7873",
      "800": "#2c2b28",
      "950": "#161513"
    },
    "feedback": {
      "success": "#2f7a4f",
      "warning": "#a3670c",
      "danger":  "#b3392c",
      "info":    "#2f6f8f"
    }
  }
}
```

## Tipografia

Nunca `Inter`/`Roboto`/system default sem essa ter sido uma decisão consciente (é o P0 nº1 do catálogo). Escolha uma combinação com pelo menos uma fonte de display quando o projeto justificar (marketing, landing); pra dashboards/app Angular (o caso comum aqui), prioriza legibilidade sobre personalidade, mas ainda assim escolhida, não default:

```json
{
  "typography": {
    "display": "Fraunces",
    "body": "Source Sans 3",
    "mono": "IBM Plex Mono",
    "scale": {
      "xs": "0.75rem",
      "sm": "0.875rem",
      "base": "1rem",
      "lg": "1.125rem",
      "xl": "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem"
    }
  }
}
```

## Espaçamento

Escala geométrica, não "gap/padding uniforme em tudo" (P1 do catálogo — falta de ritmo):

```json
{
  "spacing": {
    "0": "0",
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "6": "1.5rem",
    "8": "2rem",
    "12": "3rem",
    "16": "4rem",
    "24": "6rem"
  }
}
```

## Raio e sombra

Não usar o mesmo raio/sombra em toda superfície por reflexo (P1 — no PrimeNG isso é o preset "Aura"/"Lara" default intocado, ver `component-library.md`). Ter no máximo 2-3 níveis, usados com intenção:

```json
{
  "radius": { "sm": "0.25rem", "md": "0.5rem", "lg": "0.75rem", "full": "9999px" },
  "shadow": {
    "sm": "0 1px 2px rgba(0,0,0,0.06)",
    "md": "0 4px 12px rgba(0,0,0,0.10)"
  }
}
```

## Movimento

Padrão: nenhum, a menos que a task de `ui` justifique. Se precisar, usar `anime.js` (ou a API vanilla do `Motion`, ver `component-library.md`) e nunca o mesmo "fade-in-up" genérico em tudo (P2) — variar a transição conforme o contexto (entrada de modal ≠ hover de card ≠ toast).

---

Este arquivo deixa de ser a fonte de verdade assim que o `DESIGN.md` do projeto real existir (ver primeiro parágrafo). A sequência de como isso acontece — rodar a cadeia de `principios.md`, gerar o `DESIGN.md`, mapear pro tema/`tailwind.config`, registrar a virada no `CONTEXT.md` — é passo do nascimento do projeto, parte da configuração de ambiente daquele projeto, não deste arquivo.