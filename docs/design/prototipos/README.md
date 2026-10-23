# Protótipos do D0 — referência visual da Esteira

Protótipos HTML aprovados na fatia D0 (definição do design do `esteira-frontend`). São a **referência visual** para as specs e para quem implementa as telas. Não são código de produção: dados fictícios, JavaScript simples, sem Angular nem spartan.

Para ver: abra qualquer `prototipo-*.html` no navegador. Precisa de internet só para carregar as fontes (Google Fonts). Os protótipos têm um seletor **"Ver como"** que troca a pessoa logada e mostra o que cada papel vê e pode fazer. Alguns também têm um seletor de **cenário de demonstração**.

## Telas

| Arquivo | Tela | O que mostra |
|---|---|---|
| `prototipo-aguardando.html` | Aguardando você | Caixa de pendências da pessoa: Decisões, Para corrigir, Para acompanhar. Cada item leva ao lugar da decisão. |
| `prototipo-entregas.html` | Entregas | Lista paginada (filtros por estado e aplicação) e painel com indicadores e gráficos. |
| `prototipo-entrega.html` | Entrega | Mapa de etapas dos Fluxos parceiros e o detalhe de cada etapa (vulnerabilidades, agentes, deploys, aprovações). Cenários: normal, falha no deploy, gate bloqueou, cancelada, rollback, hotfix. |
| `prototipo-abrir-entrega.html` | Abrir entrega | Assistente em 3 passos numa tela: aplicação e tipo, projetos e versões, issues; resumo no final. |
| `prototipo-aplicacoes.html` | Aplicações | Lista e detalhe com abas Projetos, Ambientes e destinos, Política de segurança, Pessoas e papéis. |
| `prototipo-excecoes.html` | Exceções | Lista por estado, detalhe com aprovar/reprovar/renovar/revogar e o pedido que nasce do achado. |
| `prototipo-auditoria.html` | Auditoria | Linha do tempo só de leitura, com antes/depois de cada alteração. |
| `prototipo-fontes.html` | Escolha da fonte | Comparação das 5 opções avaliadas; a escolhida está marcada. |
| `logo-cao.html` | Logo | Logo aprovado. |

`base.css` (estilos) e `comum.js` (ícones, menu lateral, fonte) são compartilhados por todas as telas.

## Decisões visuais

- Fundo preto/grafite. Azul `#0A4EE4` só em marca, ação principal e seleção.
- Fonte: **Mona Sans** no texto e **Geist Mono** em código (versões, hashes, regras).
- Ícones de status no estilo do GitHub Actions; status nunca só por cor.
- Abas logo abaixo do cabeçalho do bloco.
- Botões de ação fora do bloco, no canto inferior direito. Reprovar/Cancelar à esquerda da ação principal. Sem texto explicativo ao lado do botão: o motivo de um botão desativado vai no `title`.
- Avisos no sino do topo.
- Histórico nunca dentro da tela: só um link "ver na auditoria", que abre a Auditoria já filtrada.
- Listas paginadas e enxutas, com o detalhe ao passar o mouse ou numa gaveta lateral. Edição de cadastro sempre em gaveta, não em campos abertos na tabela.
- Gráficos com azul `#2D6BFF` e laranja `#D9732A` (verde × vermelho reprova para daltonismo).
- Responsivo de 2560 a 320 px: conteúdo limitado a 1680 px e centralizado; menu vira só ícones abaixo de 1100 px e barra no topo abaixo de 760 px. O uso no celular (toque no lugar de hover, aprovar pelo e-mail) ainda será tratado.

## Regras de negócio decididas junto com as telas

Ainda não estão nas specs; entram nelas na próxima etapa.

- **Abrir entrega:** a versão sugerida parte da maior versão já usada no Projeto, publicada ou em andamento (com a v4.0.0-rc2 em andamento, sugere v4.1.0 ou v5.0.0). No hotfix: um Projeto só, PATCH+1 sobre produção, issues opcionais, mas sem issue o motivo é obrigatório.
- **Dependência entre Projetos:** declarada no cadastro da Aplicação (aba Projetos); vem marcada em toda Entrega nova e pode ser mudada só para aquela Entrega.
- **Exceção:** vale nos Ambientes escolhidos; prazo máximo por tipo (falso positivo até 180 dias, risco aceito até 90); renovar é um pedido novo, aprovado de novo; o pedido nasce do Achado (na tela da Entrega); reprovar e revogar exigem motivo; quem pediu pode cancelar o próprio pedido.
- **Auditoria:** só leitura; cada pessoa vê os registros das Aplicações em que tem papel, o MOR vê tudo; além de pessoas, o bot da Esteira e as pipelines aparecem como autores.
