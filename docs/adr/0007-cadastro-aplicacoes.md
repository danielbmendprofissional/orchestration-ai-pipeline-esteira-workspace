# ADR-0007 — Cadastro de aplicações dentro da Esteira; configuração de CI por pull

Status: Aceito · 2026-10-22 · Discovery fechado (ver ADR-0008). Substitui a versão "Proposto" de 2026-10-21, que escrevia variáveis no GitLab

A Esteira tem área própria de cadastro: **Aplicação → Projetos → Ambientes → Destinos**, mais os papéis de cada pessoa na Aplicação. A Aplicação aponta para um **grupo do GitLab**, e a Esteira lista os projetos do grupo para marcar quais são Projetos dela (stack sugerida pelo `APP_TECHNOLOGY`, editável). A configuração não secreta de CI de cada Projeto por Ambiente/Destino mora **só na Esteira** e a pipeline a **puxa** na resposta do `esteira-abrir`. A Esteira **não guarda nem escreve segredo**: segredos, chaves de segurança e variáveis globais continuam como variáveis do GitLab, cadastradas lá.

## Considered Options

- **Push** (a Esteira escreve as variáveis no GitLab via API, versão anterior desta ADR): duas cópias da mesma configuração para dessincronizar, e a Esteira precisaria decidir como tratar segredo (guardar cifrado ou escrever às cegas).

## Consequences

- O formato da configuração é JSON estruturado (um Ambiente pode ter vários Destinos, cada um com a sua configuração), não dotenv. O template itera os Destinos (`docs/mudancas-template.md`, itens 3 e o child pipeline por Destino).
- O token usado para listar projetos do grupo é o mesmo bot por grupo da ADR-0008.
- O `FluxoDeploy` passa a referenciar Projeto (e, por ele, Aplicação) por ID, não mais sigla de sistema. `ConfiguracaoSistema` vira a política de severidade da Aplicação por Ambiente.
