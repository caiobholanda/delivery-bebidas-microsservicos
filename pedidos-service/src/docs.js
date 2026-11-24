const erro = {
  description: 'Erro',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } }
};

const clienteId = { name: 'clienteId', in: 'path', required: true, schema: { type: 'integer', example: 1 } };
const bebidaId = { name: 'bebidaId', in: 'path', required: true, schema: { type: 'integer', example: 2 } };
const pedidoId = { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } };

const carrinho = {
  description: 'Carrinho atualizado',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Carrinho' } } }
};

const pedido = {
  description: 'Pedido',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Pedido' } } }
};

function corpo(schema, exemplo) {
  return { required: true, content: { 'application/json': { schema, example: exemplo } } };
}

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Serviço de Pedidos',
    version: '1.0.0',
    description: 'Carrinho, cupons, finalização, consulta e cancelamento de pedidos do delivery de bebidas. Consome os serviços de Catálogo, Estoque, Pagamento e Entregas.'
  },
  servers: [
    { url: 'https://pedidos-service-caio.onrender.com', description: 'Render' },
    { url: 'http://localhost:3001', description: 'Local' }
  ],
  tags: [
    { name: 'Carrinho', description: 'Itens e cupom do carrinho do cliente' },
    { name: 'Pedidos', description: 'Finalização e acompanhamento dos pedidos' },
    { name: 'Sistema', description: 'Situação do serviço' }
  ],
  paths: {
    '/health': {
      get: { tags: ['Sistema'], summary: 'Verifica se o serviço está no ar', responses: { 200: { description: 'Serviço no ar' } } }
    },
    '/carrinho/{clienteId}': {
      get: { tags: ['Carrinho'], summary: 'Mostra o carrinho com subtotal, desconto e total', parameters: [clienteId], responses: { 200: carrinho, 400: erro } }
    },
    '/carrinho/{clienteId}/itens': {
      post: {
        tags: ['Carrinho'],
        summary: 'Adiciona uma bebida (preço vem do Catálogo, quantidade é conferida no Estoque)',
        parameters: [clienteId],
        requestBody: corpo({ type: 'object', required: ['bebidaId', 'quantidade'], properties: { bebidaId: { type: 'integer' }, quantidade: { type: 'integer' } } }, { bebidaId: 2, quantidade: 3 }),
        responses: { 201: carrinho, 400: erro, 404: erro, 409: erro }
      }
    },
    '/carrinho/{clienteId}/itens/{bebidaId}': {
      put: {
        tags: ['Carrinho'],
        summary: 'Altera a quantidade de um item (0 remove)',
        parameters: [clienteId, bebidaId],
        requestBody: corpo({ type: 'object', required: ['quantidade'], properties: { quantidade: { type: 'integer' } } }, { quantidade: 2 }),
        responses: { 200: carrinho, 400: erro, 404: erro, 409: erro }
      },
      delete: { tags: ['Carrinho'], summary: 'Remove um item do carrinho', parameters: [clienteId, bebidaId], responses: { 200: carrinho, 404: erro } }
    },
    '/carrinho/{clienteId}/cupom': {
      post: {
        tags: ['Carrinho'],
        summary: 'Aplica um cupom (confere validade e valor mínimo)',
        parameters: [clienteId],
        requestBody: corpo({ type: 'object', required: ['codigo'], properties: { codigo: { type: 'string' } } }, { codigo: 'BEMVINDO10' }),
        responses: { 200: carrinho, 400: erro }
      },
      delete: { tags: ['Carrinho'], summary: 'Remove o cupom', parameters: [clienteId], responses: { 200: carrinho } }
    },
    '/pedidos': {
      post: {
        tags: ['Pedidos'],
        summary: 'Finaliza o pedido: cobra, baixa o estoque e gera a entrega',
        requestBody: corpo(
          {
            type: 'object',
            required: ['clienteId', 'formaPagamento', 'endereco'],
            properties: {
              clienteId: { type: 'integer' },
              formaPagamento: { type: 'string', enum: ['pix', 'cartao', 'dinheiro'] },
              endereco: { type: 'string' },
              cartao: { type: 'object', properties: { numero: { type: 'string' }, nome: { type: 'string' }, validade: { type: 'string' }, cvv: { type: 'string' } } },
              trocoPara: { type: 'number' }
            }
          },
          { clienteId: 1, formaPagamento: 'pix', endereco: 'Rua A, 10' }
        ),
        responses: {
          201: { description: 'Pedido criado com o pagamento' },
          400: erro,
          402: { description: 'Pagamento recusado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } } },
          409: erro,
          502: erro
        }
      }
    },
    '/pedidos/{id}': {
      get: { tags: ['Pedidos'], summary: 'Consulta um pedido com os itens', parameters: [pedidoId], responses: { 200: pedido, 404: erro } }
    },
    '/pedidos/cliente/{clienteId}': {
      get: { tags: ['Pedidos'], summary: 'Histórico de pedidos do cliente', parameters: [clienteId], responses: { 200: { description: 'Lista de pedidos' } } }
    },
    '/pedidos/{id}/cancelar': {
      patch: { tags: ['Pedidos'], summary: 'Cancela: estorna o pagamento, devolve o estoque e cancela a entrega', parameters: [pedidoId], responses: { 200: pedido, 404: erro, 409: erro } }
    },
    '/pedidos/{id}/status': {
      patch: {
        tags: ['Pedidos'],
        summary: 'Atualiza o status (usado pelos serviços de Pagamento e Entregas)',
        parameters: [pedidoId],
        requestBody: corpo({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['confirmado', 'em_entrega', 'entregue'] } } }, { status: 'em_entrega' }),
        responses: { 200: pedido, 409: erro }
      }
    }
  },
  components: {
    schemas: {
      Erro: { type: 'object', properties: { erro: { type: 'string', example: 'Carrinho vazio' } } },
      Item: {
        type: 'object',
        properties: { bebidaId: { type: 'integer' }, nome: { type: 'string' }, precoUnitario: { type: 'number' }, quantidade: { type: 'integer' }, total: { type: 'number' } }
      },
      Carrinho: {
        type: 'object',
        properties: {
          clienteId: { type: 'integer' },
          itens: { type: 'array', items: { $ref: '#/components/schemas/Item' } },
          cupom: { type: 'string', nullable: true },
          subtotal: { type: 'number' },
          desconto: { type: 'number' },
          total: { type: 'number' }
        }
      },
      Pedido: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          clienteId: { type: 'integer' },
          status: { type: 'string', enum: ['aguardando_pagamento', 'confirmado', 'em_entrega', 'entregue', 'cancelado'] },
          total: { type: 'number' },
          formaPagamento: { type: 'string' },
          endereco: { type: 'string' },
          itens: { type: 'array', items: { $ref: '#/components/schemas/Item' } }
        }
      }
    }
  }
};
