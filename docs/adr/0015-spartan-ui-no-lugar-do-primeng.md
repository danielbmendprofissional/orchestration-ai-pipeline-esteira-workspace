# ADR-0015 — spartan/ui no lugar do PrimeNG

Status: Aceito · 2026-10-22 · Substitui a linha "Componentes" da ADR-0005

A partir do **PrimeNG 22** (e dos pacotes `@primeuix/*`) a licença deixou de ser MIT: é a PrimeUI License, comercial, com chave verificada pelo pacote. A licença Community gratuita exige que a organização tenha menos de US$ 1 milhão de faturamento, menos de 5 desenvolvedores e menos de 10 funcionários, com renovação anual. O PrimeNG 21 ainda é MIT, mas só aceita Angular 21. A Esteira usa **spartan/ui**: `@spartan-ng/brain` (primitivas acessíveis sobre o Angular CDK, MIT) mais os componentes de estilo (helm) **copiados para `src/app/shared/ui`** pela CLI do spartan e estilizados com Tailwind.

## Considered Options

- **PrimeNG 22 Community**: grátis só enquanto a organização usuária cumprir todos os critérios; chave de licença e renovação anual; vira custo por desenvolvedor se a Esteira for usada numa organização maior.
- **Angular Material + CDK** (MIT): completo e acessível, mas o visual Material é marcado e sair dele com tokens próprios custa mais — pesa contra `docs/design/principios.md`.
- **Angular 21 + PrimeNG 21** (último MIT): congela a stack sem atualização.

## Consequences

- Tokens com fonte única no `src/styles.css`: o `@theme` do Tailwind alimenta os utilitários e o `:root` traduz os mesmos valores para as variáveis que o helm lê (`--primary`, `--background`…). O tema de fábrica do spartan (`stone`, `zinc`…) não é usado.
- Componente novo: `npx ng g @spartan-ng/cli:ui <nome>` (configuração em `components.json`; alias `@spartan-ng/helm/<nome>`). O código copiado é nosso: ajustar a variante no próprio arquivo, não sobrescrever com classe solta na página.
- Menos componentes prontos que o PrimeNG; tabela de dados usa o helm de table sobre TanStack Table.
- O `ai-base` ainda recomenda PrimeNG: pendência registrada em `ai-base/PENDENCIAS.md`.
