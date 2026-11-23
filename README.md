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
- [Fluxo das telas](docs/FLUXO_TELAS.md)

## Links

| | URL |
|---|---|
| Front | https://delivery-bebidas-front.onrender.com |
| Front (login e catálogo) | https://delivery-bebidas-front-joao.onrender.com |
| Autenticação | https://autenticacao-service-joao.onrender.com |
| Catálogo | https://catalogo-service-joao.onrender.com |
| Pedidos | https://pedidos-service-caio.onrender.com |
| Pagamento | https://pagamento-service-caio.onrender.com |
| Estoque | https://estoque-service-vitor.onrender.com |
| Entregas | https://entregas-service-vitor.onrender.com |
| Front (estoque e entregas) | https://delivery-bebidas-front-vitor.onrender.com |

## Autenticação e Catálogo (João Gabriel)

Requisitos: Java 21 e MySQL 8. Os dois serviços usam Spring Boot e Maven.

Para rodar localmente (faça o mesmo em `catalogo-service`):

```bash
cd autenticacao-service
mvn spring-boot:run
```

Por padrão o serviço conecta no MySQL local (`root`, sem senha). Se o seu MySQL tem senha, defina antes de rodar:

```bash
export SPRING_DATASOURCE_PASSWORD=sua_senha
```

O banco e as tabelas são criados automaticamente na primeira execução. O Catálogo já vem com 12 bebidas de exemplo (ids de 1 a 12), e o Autenticação cria um administrador na primeira execução.

| Variável | Descrição |
|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:mysql://host:porta/banco` |
| `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` | Usuário e senha do banco |
| `ADMIN_EMAIL` / `ADMIN_SENHA` | Administrador criado na primeira execução (Autenticação) |
| `AUTENTICACAO_URL` | Endereço do serviço de Autenticação (Catálogo) |

Rotas e exemplos: [Contratos entre os serviços](docs/CONTRATOS.md). A página `frontend-autenticacao-catalogo/index.html` permite entrar, cadastrar, consultar o catálogo e adicionar bebidas ao carrinho.

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

## Estoque e Entregas (Vitor)

Requisitos: Python 3.11+ e MySQL 8. Os dois serviços usam FastAPI e SQLAlchemy.

Para rodar localmente (faça o mesmo em `entregas-service`):

```bash
cd estoque-service
python -m venv .venv
.venv\Scripts\activate        # no Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Abra o `.env` e troque `SUA_SENHA` pela senha do seu MySQL. Depois:

```bash
python main.py
```

O banco e as tabelas são criados automaticamente na primeira execução. O Estoque já vem com saldo para as 12 bebidas do catálogo (ids de 1 a 12) e o Entregas já vem com 3 entregadores. A documentação interativa das rotas fica em `/docs` (ex.: http://localhost:5001/docs).

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | `mysql+pymysql://usuario:senha@host:porta/banco` |
| `PEDIDOS_URL` | Endereço do serviço de Pedidos (Entregas avisa quando o pedido sai e quando é entregue) |

Rotas e exemplos: [Contratos entre os serviços](docs/CONTRATOS.md). A página `frontend-estoque-entregas/index.html` mostra o estoque, permite repor bebidas, atribuir entregadores e acompanhar as entregas.
