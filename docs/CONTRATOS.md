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

O Pedidos confere a mudança antes de aceitar: `confirmado` só com pagamento `aprovado` no serviço de Pagamento; `em_entrega` só com a entrega `atribuida` ou `em_rota`; `entregue` só com a entrega `em_rota`. Assim ninguém marca um pedido como pago ou entregue chamando a rota direto.

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

Ao finalizar, o Pedidos confere cada item no Catálogo. Se o preço mudou ou a bebida foi excluída, o carrinho é atualizado e a resposta é 409 explicando o que mudou.

`PATCH /pedidos/{id}/cancelar` aceita pedidos `aguardando_pagamento` e `confirmado`, e também `em_entrega` quando a entrega está `falhou`.

### Front → Pagamento

| Método | Rota |
|---|---|
| GET | `/pagamentos/{id}` |
| GET | `/pagamentos/pedido/{pedidoId}` |
| POST | `/pagamentos/{id}/confirmar` |

---

## Rotas do Autenticação e do Catálogo (João)

### Autenticação

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/auth/cadastro` | `{ "nome": "Maria", "email": "maria@email.com", "senha": "123456", "dataNascimento": "2000-05-10" }` | 201 com `{ "id", "nome", "email", "perfil" }` |
| POST | `/auth/login` | `{ "email": "maria@email.com", "senha": "123456" }` | 200 com `{ "token", "usuario": { "id", "nome", "email", "perfil" } }` |
| GET | `/auth/validar` | cabeçalho `Authorization: Bearer {token}` | 200 com `{ "id", "nome", "email", "perfil" }` |
| PUT | `/auth/senha` | `{ "senhaAtual": "...", "novaSenha": "..." }` com `Authorization` | 200 e a sessão é encerrada |

- Só maiores de 18 anos podem se cadastrar (400 caso contrário). E-mail repetido: 409. Login errado: 401.
- Perfis: `cliente`, `entregador` e `administrador`. O cadastro público cria sempre `cliente`.
- `POST /auth/entregadores` (só administrador, `Authorization: Bearer`) cria uma conta com perfil `entregador`. Corpo igual ao do cadastro: `{ "nome", "email", "senha", "dataNascimento" }`.
- O `id` retornado é o `clienteId` usado nos serviços de Pedidos e Entregas.
- O token vale por 24 horas.

### Catálogo

| Método | Rota | Quem usa |
|---|---|---|
| GET | `/bebidas?busca=&categoria=&precoMin=&precoMax=&ordem=` | Front. `ordem`: `preco_asc`, `preco_desc` (padrão: nome) |
| GET | `/bebidas/destaques` | Front |
| GET | `/bebidas/promocoes` | Front |
| GET | `/bebidas/{id}` | Front e serviço de Pedidos |
| GET | `/categorias` | Front (filtro de categorias) |
| POST | `/bebidas` | Administrador (exige `Authorization`). Retorna 201 |
| PUT | `/bebidas/{id}` | Administrador (exige `Authorization`) |

Corpo do POST e do PUT:
```json
{ "nome": "Heineken 350ml", "categoria": "Cerveja", "descricao": "Lata gelada", "preco": 6.5, "precoPromocional": 5.9, "destaque": true }
```
- `precoPromocional` é opcional e precisa ser menor que `preco`.
- Sem token: 401. Token de quem não é administrador: 403.
- O Catálogo chama `GET /auth/validar` do serviço de Autenticação para conferir o token.
- Não existe rota para apagar bebida: o histórico de pedidos guarda o `bebidaId`.

---

## Rotas do Estoque e das Entregas (Vitor)

### Estoque

| Método | Rota | Corpo | Quem usa |
|---|---|---|---|
| GET | `/estoque` | | Front |
| GET | `/estoque/reposicao` | | Front (bebidas no mínimo ou abaixo dele) |
| GET | `/estoque/{bebidaId}` | | Front e serviço de Pedidos |
| GET | `/estoque/{bebidaId}/movimentacoes` | | Front (últimas 50) |
| POST | `/estoque/verificar` | `{ "itens": [ { "bebidaId": 1, "quantidade": 2 } ] }` | Quem precisar conferir vários itens de uma vez |
| POST | `/estoque/baixar` | `{ "pedidoId": 1, "itens": [ ... ] }` | Serviço de Pedidos |
| POST | `/estoque/restaurar` | `{ "pedidoId": 1 }` | Serviço de Pedidos |
| POST | `/estoque/{bebidaId}/repor` | `{ "quantidade": 24 }` | Front |
| PUT | `/estoque/{bebidaId}` | `{ "quantidade": 50, "quantidadeMinima": 10 }` (os dois são opcionais) | Front (ajuste de inventário) |

Resposta de `GET /estoque/{bebidaId}`:
```json
{ "bebidaId": 1, "quantidade": 120, "quantidadeMinima": 24, "precisaRepor": false, "atualizadoEm": "2026-11-20T14:02:11" }
```
- Bebida sem estoque cadastrado (ex.: recém-criada no catálogo) responde 200 com `quantidade: 0`. A primeira reposição cria o registro.

Resposta de `POST /estoque/verificar`:
```json
{ "disponivel": false, "itens": [ { "bebidaId": 12, "solicitado": 6, "emEstoque": 4, "disponivel": false } ] }
```

- `baixar` é tudo ou nada: se faltar qualquer item, responde 409 e não baixa nenhum. Chamar `baixar` duas vezes para o mesmo pedido também dá 409.
- `restaurar` devolve só o que foi baixado para o pedido e pode ser chamado mais de uma vez sem duplicar (a segunda chamada devolve `itens: []`).
- Toda baixa, restauração, reposição e ajuste fica registrada em `movimentacoes`.

### Entregas

| Método | Rota | Corpo | Quem usa |
|---|---|---|---|
| POST | `/entregas` | `{ "pedidoId": 1, "clienteId": 1, "endereco": "Rua A, 10" }` | Serviço de Pedidos. Retorna 201 |
| GET | `/entregas?status=&entregadorId=` | | Front |
| GET | `/entregas/{id}` | | Front |
| GET | `/entregas/pedido/{pedidoId}` | | Front |
| PATCH | `/entregas/{id}/atribuir` | `{ "entregadorId": 1 }` | Front |
| PATCH | `/entregas/{id}/iniciar` | | Front (entregador saiu) |
| PATCH | `/entregas/{id}/finalizar` | | Front (entregue) |
| PATCH | `/entregas/{id}/falha` | `{ "motivo": "Cliente ausente" }` | Front |
| PATCH | `/entregas/pedido/{pedidoId}/cancelar` | | Serviço de Pedidos |

Status da entrega:

```
aguardando_entregador → atribuida → em_rota → entregue
                                       ↓
                                    falhou → atribuida (nova tentativa)
```
- `cancelada` só a partir de `aguardando_entregador`, `atribuida` ou `falhou`. Em rota ou entregue: 409.
- Ao `iniciar` a primeira tentativa, o Entregas chama `PATCH /pedidos/{id}/status` com `em_entrega`. Ao `finalizar`, chama com `entregue`. Se o Pedidos recusar, a entrega não muda de status.
- Pedido que já tem entrega: 409.

### Entregadores

| Método | Rota | Corpo |
|---|---|---|
| GET | `/entregadores?ativos=true&email=` | |
| GET | `/entregadores/{id}` | |
| GET | `/entregadores/{id}/entregas` | |
| POST | `/entregadores` | `{ "nome": "Carlos Souza", "email": "entregador@gmail.com", "telefone": "85999810021", "veiculo": "moto", "placa": "PMX1A23" }` |
| PATCH | `/entregadores/{id}/status` | `{ "ativo": false }` |

- `veiculo`: `moto`, `carro` ou `bicicleta`. Placa obrigatória para moto e carro.
- Entregador inativo não recebe entregas. Não dá para desativar quem está com entrega em rota (409).

---

## Padrões combinados

- JSON com nomes em camelCase (`bebidaId`, `pedidoId`, `clienteId`).
- Erros no formato `{ "erro": "mensagem" }`.
- IDs numéricos.
- `clienteId` vem do serviço de Autenticação (João).
- Todo serviço tem `GET /health`.
- Rotas protegidas recebem `Authorization: Bearer {token}`, obtido em `POST /auth/login`.
- CORS liberado.
