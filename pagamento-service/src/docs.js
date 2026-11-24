const erro = {
  description: 'Erro',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } }
};

const pagamento = {
  description: 'Pagamento',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Pagamento' } } }
};

const pagamentoId = { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1 } };

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Serviço de Pagamento',
    version: '1.0.0',
    description: 'Pagamentos por Pix, cartão e dinheiro do delivery de bebidas. É chamado pelo serviço de Pedidos e avisa o Pedidos quando o Pix é confirmado. O cartão nunca é salvo inteiro, só os 4 últimos dígitos.'
  },
  servers: [
    { url: 'https://pagamento-service-caio.onrender.com', description: 'Render' },
    { url: 'http://localhost:3002', description: 'Local' }
  ],
  tags: [
    { name: 'Pagamentos', description: 'Criação, consulta, confirmação e estorno' },
    { name: 'Sistema', description: 'Situação do serviço' }
  ],
  paths: {
    '/health': {
      get: { tags: ['Sistema'], summary: 'Verifica se o serviço está no ar', responses: { 200: { description: 'Serviço no ar' } } }
    },
    '/pagamentos': {
      post: {
        tags: ['Pagamentos'],
        summary: 'Inicia um pagamento: Pix gera código (30 min), cartão aprova ou recusa, dinheiro calcula o troco',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['pedidoId', 'valor', 'metodo'],
                properties: {
                  pedidoId: { type: 'integer' },
                  valor: { type: 'number' },
                  metodo: { type: 'string', enum: ['pix', 'cartao', 'dinheiro'] },
                  cartao: { type: 'object', properties: { numero: { type: 'string' }, nome: { type: 'string' }, validade: { type: 'string', example: '12/29' }, cvv: { type: 'string' } } },
                  trocoPara: { type: 'number' }
                }
              },
              example: { pedidoId: 1, valor: 29.65, metodo: 'cartao', cartao: { numero: '4111111111111111', nome: 'CAIO', validade: '12/29', cvv: '123' } }
            }
          }
        },
        responses: { 201: pagamento, 400: erro, 409: erro }
      }
    },
    '/pagamentos/{id}': {
      get: { tags: ['Pagamentos'], summary: 'Consulta um pagamento', parameters: [pagamentoId], responses: { 200: pagamento, 404: erro } }
    },
    '/pagamentos/pedido/{pedidoId}': {
      get: {
        tags: ['Pagamentos'],
        summary: 'Pagamentos de um pedido, do mais recente para o mais antigo',
        parameters: [{ name: 'pedidoId', in: 'path', required: true, schema: { type: 'integer', example: 1 } }],
        responses: { 200: { description: 'Lista de pagamentos' } }
      }
    },
    '/pagamentos/{id}/confirmar': {
      post: { tags: ['Pagamentos'], summary: 'Confirma um Pix ou dinheiro pendente e avisa o serviço de Pedidos', parameters: [pagamentoId], responses: { 200: pagamento, 404: erro, 409: erro, 410: erro } }
    },
    '/pagamentos/{id}/estornar': {
      post: { tags: ['Pagamentos'], summary: 'Estorna um pagamento aprovado ou cancela um pendente', parameters: [pagamentoId], responses: { 200: pagamento, 404: erro, 409: erro } }
    }
  },
  components: {
    schemas: {
      Erro: { type: 'object', properties: { erro: { type: 'string', example: 'Pagamento não encontrado' } } },
      Pagamento: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          pedidoId: { type: 'integer' },
          metodo: { type: 'string', enum: ['pix', 'cartao', 'dinheiro'] },
          valor: { type: 'number' },
          status: { type: 'string', enum: ['pendente', 'aprovado', 'recusado', 'cancelado', 'estornado'] },
          codigoPix: { type: 'string', nullable: true },
          cartaoFinal: { type: 'string', nullable: true, example: '1111' },
          cartaoBandeira: { type: 'string', nullable: true, example: 'visa' },
          troco: { type: 'number', nullable: true }
        }
      }
    }
  }
};
