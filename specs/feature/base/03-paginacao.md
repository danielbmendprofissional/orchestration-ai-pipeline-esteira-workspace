# B1 — Paginação por headers `X-*`

## Contexto necessário
- esteira-api/CLAUDE.md (camadas, padrões, testes)
- esteira-api/docs/PENDENCIAS.md
- docs/adr/0002-paginacao.md (a decisão; esta spec não repete o contrato, só o aplica)
- docs/adr/0003-erros.md e specs/feature/base/02-result-e-problem-details.md (precisa estar feita: a lista paginada nasce como `Result` e os testes usam o `ApiDeTeste` dela)
- docs/adr/0014-identificadores.md (o que sai na lista é `PublicId`, nunca `long`)

## Ideia
A paginação herdada lê e escreve um header único `Pagination` com JSON (Newtonsoft) e o `BaseHandler` ainda pagina em memória. Esta fatia troca pelo contrato da ADR-0002 antes da primeira lista de negócio (A1): **request** com `X-Page`/`X-Page-Size` e `?sort=&order=`; **response** com o array puro no corpo e `X-Total-Count`, `X-Total-Pages`, `X-Page`, `X-Page-Size` nos headers. Contagem, ordenação, `Skip` e `Take` sempre no banco.

Fora desta fatia: o helper de `core/http/` do front que lê e escreve esses headers (F0.5); filtros de negócio (`?busca=` e afins nascem em cada lista, A1 em diante); documentação dos headers no OpenAPI; listas reais (nenhuma existe ainda).

## Dados
N/A — nenhuma tabela, nenhuma migration.

## Backend

### Contrato (detalhes que a ADR-0002 não fixa)
- `X-Page` ausente → 1; `X-Page-Size` ausente → 10. Máximo de `X-Page-Size`: 100.
- Valor não inteiro, `X-Page` < 1, `X-Page-Size` < 1 ou > 100 → 400 `Validation` (`paginacao.pagina-invalida`, `paginacao.tamanho-invalido`). Nunca corrige em silêncio.
- `order` diferente de `asc`/`desc` (sem diferenciar maiúsculas) → 400 `paginacao.sentido-invalido`; ausente → `asc`.
- `sort` é o nome de uma propriedade do DTO da lista, como sai no JSON (camelCase, comparação sem diferenciar maiúsculas). Nome que não existe → 400 `paginacao.ordenacao-invalida`.
- Página além da última → 200 com `[]` e os quatro headers (`X-Total-Count` real, `X-Page` a pedida).
- Sem `sort`, vale a **ordenação padrão da consulta**, obrigatória; com `sort`, a padrão entra como desempate — a mesma página pedida duas vezes devolve os mesmos itens.

### Checklist
- [ ] **`PaginacaoDto`** (Application) vira só entrada: `Pagina`, `TamanhoPagina`, `Ordenacao`, `Sentido`; constantes `TamanhoPadrao = 10`, `TamanhoMaximo = 100`. Sai o `[JsonIgnore]`/Newtonsoft e o `TotalItems` mutável.
- [ ] **`PaginaDto<T>`** (Application) é a saída: `Itens`, `Pagina`, `TamanhoPagina`, `Total`, `TotalPaginas`. Substitui `IRespostaPaginada` (`Resultados` como `object` sai).
- [ ] **`PaginarAsync`** (`Esteira.Data/.../PaginacaoExtensions`) recebe a query, o `PaginacaoDto`, a projeção e a **ordenação padrão** (obrigatória), conta e pagina no banco, e devolve `Result<PaginaDto<TDto>>` — falha `paginacao.ordenacao-invalida` quando o `sort` não existe no DTO. Sai o atalho "`pagination is null` devolve tudo".
- [ ] **`OrdenacaoExtensions`**: deixa de lançar; quem chama sabe se o campo existe antes de ordenar (o `Result` sai do `PaginarAsync`). Suporta `ThenBy` para o desempate.
- [ ] **`BaseHandler.Paginacao`** (paginação em memória) removido; se o `BaseHandler` ficar só com log e sem uso, sai também.
- [ ] **Api — leitura:** `PaginacaoHttpExtensions` lê `X-Page`/`X-Page-Size` dos headers e `sort`/`order` da query string, e devolve `Result<PaginacaoDto>` com os erros de validação acima (todos os inválidos de uma vez). O controller de lista devolve essa falha sem chamar o MediatR.
- [ ] **Api — escrita:** o filtro de resultado da B2, quando o `Result` de sucesso traz um `PaginaDto<T>`, escreve os quatro headers e responde 200 com `Itens` como array puro. `PaginacaoResultFilter` e o header `Pagination` somem (um ponto só traduz `Result`).
- [ ] **CORS** expõe `X-Total-Count`, `X-Total-Pages`, `X-Page`, `X-Page-Size` (constantes num lugar só, usadas pelo filtro e pelo `WithExposedHeaders`).
- [ ] Nenhum `Newtonsoft` sobra em paginação.
- [ ] `esteira-api/CLAUDE.md`: a linha de paginação descreve o padrão novo (consulta de lista recebe `PaginacaoDto`, chama `PaginarAsync` com ordenação padrão, devolve `Result<PaginaDto<T>>`) e perde o "`BaseHandler.Paginacao` é legado".

## Frontend
N/A — o helper de `core/http/` que lê os headers é da F0.5.

## Infra
N/A — CORS só vale em Development (em produção o front fala pelo mesmo domínio).

## Critérios (EARS)
1. Quando uma lista é pedida com `X-Page` e `X-Page-Size` válidos, a API deve responder 200 com o array puro dos itens daquela página e os headers `X-Total-Count`, `X-Total-Pages`, `X-Page` e `X-Page-Size`.
2. Quando a lista é pedida sem `X-Page`/`X-Page-Size`, a API deve usar página 1 e tamanho 10 e informá-los nos headers de resposta.
3. Se `X-Page` ou `X-Page-Size` não for inteiro, for menor que 1, ou `X-Page-Size` for maior que 100, a API deve recusar com 400 (`paginacao.pagina-invalida` / `paginacao.tamanho-invalido`) sem executar a consulta.
4. Quando `?sort=<campo>&order=desc` é informado com um campo do DTO, a API deve devolver os itens ordenados por esse campo, decrescente.
5. Se `sort` não for um campo do DTO da lista, a API deve recusar com 400 (`paginacao.ordenacao-invalida`).
6. Se `order` não for `asc` nem `desc`, a API deve recusar com 400 (`paginacao.sentido-invalido`).
7. Quando a página pedida passa da última, a API deve responder 200 com array vazio e `X-Total-Count` com o total real.
8. Enquanto houver itens com o mesmo valor no campo de `sort`, a mesma página pedida duas vezes deve devolver os mesmos itens na mesma ordem (desempate pela ordenação padrão).
9. Quando a lista é paginada, a contagem e o recorte da página devem acontecer no banco — a consulta não traz para a memória mais itens do que o tamanho da página.
10. Quando o front chama de outra origem em Development, a resposta deve expor os quatro headers `X-*` no CORS.

## Testes
- **Integração — `PaginarAsync`** (`Esteira.Integration.Tests`, Postgres real): um `DbContext` **só de teste** com uma tabela de itens num schema próprio de teste (criado pelo teste, fora das migrations da Esteira), semeada com itens que repetem valor no campo ordenável. Critérios 4, 5, 7, 8 e 9 (9 pelo SQL gerado — `LIMIT`/`OFFSET` e `COUNT` na consulta, via interceptor ou log do EF).
- **Integração — HTTP** (`ApiDeTeste` da B2): controller e query **só de teste** sobre o mesmo `DbContext` de teste. Critérios 1, 2, 3 (cada caso de valor inválido), 5, 6 e 7 pelo contrato HTTP — headers, corpo como array JSON (não objeto), formato `errors[]`. Critério 10: requisição com `Origin` em ambiente Development, assert no `Access-Control-Expose-Headers`.
- **Application** (`Esteira.Application.Tests`): `PaginacaoDto`/`PaginaDto<T>` — cálculo de `TotalPaginas` (total 0, total exato, total com resto).
- `grep -rn "\"Pagination\"\|IRespostaPaginada\|PaginacaoResultFilter" src test` não acha nada.
- `dotnet test --solution Esteira.slnx` verde, sem warnings novos.
