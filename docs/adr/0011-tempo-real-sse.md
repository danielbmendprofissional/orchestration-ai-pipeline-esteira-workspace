# ADR-0011 — Atualização ao vivo por Server-Sent Events

Status: Aceito · 2026-10-22

A tela da Entrega recebe mudanças de estado (pipeline, deploy por Destino, resultado de agente, Ação do bot) por **SSE**: a API empurra eventos, o front escuta. Mão única basta, funciona com o cookie de sessão na mesma origem (ADR-0004) sem CORS, e com **Redis pub/sub** (canais com `Redis:KeyPrefix`) funciona com mais de uma instância da API. Se a conexão cair, o front volta a polling até reconectar.

## Considered Options

- **Polling**: simples, mas atrasa e multiplica requisições com muitas telas abertas.
- **WebSocket/SignalR**: bidirecional sem necessidade; mais uma peça no nginx/Ingress.
