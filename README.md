# Delivery de Bebidas - Microsserviços

Trabalho 4 - UNIFOR

Sistema de delivery de bebidas dividido em microsserviços. Cada serviço tem seu próprio banco MySQL e os serviços se comunicam por HTTP (API REST com JSON).

## Equipe

| Integrante | Linguagem | Serviços |
|---|---|---|
| João Gabriel | Java | Autenticação, Catálogo |
| Vitor Costa | Python | Estoque, Entregas |
| Caio Barsi | JavaScript (Node.js) | Pedidos, Pagamento |

## Serviços

| Serviço | Banco | Pasta |
|---|---|---|
| Autenticação | bd_autenticacao | autenticacao-service |
| Catálogo | bd_catalogo | catalogo-service |
| Estoque | bd_estoque | estoque-service |
| Entregas | bd_entregas | entregas-service |
| Pedidos | bd_pedidos | pedidos-service |
| Pagamento | bd_pagamentos | pagamento-service |

## Pedidos e Pagamento (Caio)

Para rodar localmente:

```bash
cd pedidos-service
cp .env.example .env
npm install
npm start
```

O mesmo vale para `pagamento-service`. As tabelas são criadas automaticamente ao iniciar.
