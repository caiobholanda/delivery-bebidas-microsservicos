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

## Documentação

- [Deploy na nuvem (TiDB + Render)](docs/DEPLOY.md)
- [Contratos entre os serviços](docs/CONTRATOS.md)

## Links

| | URL |
|---|---|
| Front | https://delivery-bebidas-front.onrender.com |
| Pedidos | https://pedidos-service-caio.onrender.com |
| Pagamento | https://pagamento-service-caio.onrender.com |

## Pedidos e Pagamento (Caio)

Requisitos: Node.js 18+ e MySQL 8.

Para rodar localmente (faça o mesmo em `pagamento-service`):

```bash
cd pedidos-service
cp .env.example .env
npm install
```

Abra o `.env` e troque `SUA_SENHA` pela senha do seu MySQL. Se o MySQL não estiver na porta 3306, ajuste também a porta. Depois:

```bash
npm start
```

O banco e as tabelas são criados automaticamente na primeira execução.

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | `mysql://usuario:senha@host:porta/banco` |
| `DB_SSL` | `true` para bancos na nuvem que exigem SSL |
| `CATALOGO_URL`, `ESTOQUE_URL`, `ENTREGAS_URL` | Endereços dos serviços dos colegas |
| `PAGAMENTO_URL` / `PEDIDOS_URL` | Endereço do outro serviço do Caio |
