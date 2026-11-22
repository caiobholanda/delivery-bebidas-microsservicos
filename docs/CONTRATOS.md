# Contratos entre os serviços

Os serviços conversam por HTTP com JSON. Este arquivo lista o que cada serviço chama e o que precisa responder. Se alguém mudar uma rota ou um campo, atualize aqui e avise o time.

---

## Rotas que o serviço de Pedidos chama

### Catálogo (João)

`GET /bebidas/{id}`

Resposta 200:
```json
{ "id": 1, "nome": "Heineken 350ml", "preco": 6.5, "precoPromocional": null }
```
- `precoPromocional` é opcional. Se vier preenchido, ele é usado no lugar de `preco`.
- Se a bebida não existir: 404 com `{ "erro": "Bebida não encontrada" }`.

### Estoque (Vitor)

`GET /estoque/{bebidaId}`

Resposta 200:
```json
{ "quantidade": 10 }
```

`POST /estoque/baixar`

Corpo:
```json
{ "pedidoId": 1, "itens": [ { "bebidaId": 1, "quantidade": 2 } ] }
```
Resposta 200 se baixou tudo. 409 se faltar estoque de algum item (nesse caso não baixa nada).

`POST /estoque/restaurar`

Corpo:
```json
{ "pedidoId": 1 }
```
Devolve ao estoque o que foi baixado para esse pedido. Resposta 200.

### Entregas (Vitor)

`POST /entregas`

Corpo:
```json
{ "pedidoId": 1, "clienteId": 1, "endereco": "Rua A, 10" }
```
Resposta 201.

`PATCH /entregas/pedido/{pedidoId}/cancelar`

Cancela a entrega de um pedido cancelado. Resposta 200.

---

## Rotas do serviço de Pedidos que os outros chamam

### Entregas (Vitor) → Pedidos

`PATCH /pedidos/{id}/status`

Corpo:
```json
{ "status": "em_entrega" }
```
ou
```json
{ "status": "entregue" }
```
Transições permitidas: `confirmado → em_entrega → entregue`. Fora disso: 409.

Quando o status vira `entregue` e o pagamento é em dinheiro, o Pedidos confirma o pagamento automaticamente.

### Pagamento (Caio) → Pedidos

`PATCH /pedidos/{id}/status` com `{ "status": "confirmado" }` quando o Pix é pago.

### Front → Pedidos

| Método | Rota | Corpo |
|---|---|---|
| GET | `/carrinho/{clienteId}` | |
| POST | `/carrinho/{clienteId}/itens` | `{ "bebidaId": 1, "quantidade": 2 }` |
| PUT | `/carrinho/{clienteId}/itens/{bebidaId}` | `{ "quantidade": 3 }` |
| DELETE | `/carrinho/{clienteId}/itens/{bebidaId}` | |
| POST | `/carrinho/{clienteId}/cupom` | `{ "codigo": "BEMVINDO10" }` |
| DELETE | `/carrinho/{clienteId}/cupom` | |
| POST | `/pedidos` | `{ "clienteId": 1, "formaPagamento": "pix", "endereco": "Rua A, 10" }` |
| GET | `/pedidos/{id}` | |
| GET | `/pedidos/cliente/{clienteId}` | |
| PATCH | `/pedidos/{id}/cancelar` | |

Para cartão, `POST /pedidos` também recebe:
```json
{ "cartao": { "numero": "4111111111111111", "nome": "CAIO", "validade": "12/29", "cvv": "123" } }
```
Para dinheiro, opcionalmente `{ "trocoPara": 50 }`.

### Front → Pagamento

| Método | Rota |
|---|---|
| GET | `/pagamentos/{id}` |
| GET | `/pagamentos/pedido/{pedidoId}` |
| POST | `/pagamentos/{id}/confirmar` |

---

## Padrões combinados

- JSON com nomes em camelCase (`bebidaId`, `pedidoId`, `clienteId`).
- Erros no formato `{ "erro": "mensagem" }`.
- IDs numéricos.
- `clienteId` vem do serviço de Autenticação (João).
- Todo serviço tem `GET /health`.
- CORS liberado.
