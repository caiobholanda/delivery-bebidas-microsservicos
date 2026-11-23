const { erroHttp } = require('./erros');

function limparUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

const CATALOGO_URL = limparUrl(process.env.CATALOGO_URL);
const ESTOQUE_URL = limparUrl(process.env.ESTOQUE_URL);
const PAGAMENTO_URL = limparUrl(process.env.PAGAMENTO_URL);
const ENTREGAS_URL = limparUrl(process.env.ENTREGAS_URL);

async function requisitar(url, metodo = 'GET', corpo) {
  let resposta;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(60000)
    });
  } catch {
    throw erroHttp(503, `Serviço indisponível: ${url}`);
  }

  const texto = await resposta.text();
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    if (!resposta.ok) {
      throw erroHttp(503, `Serviço fora do ar ou endereço errado: ${new URL(url).origin}`);
    }
    throw erroHttp(502, `Resposta inválida de ${new URL(url).origin}`);
  }

  if (!resposta.ok) {
    const mensagem = dados?.erro || dados?.mensagem || dados?.message || dados?.detail || `Erro ao chamar ${url}`;
    if (resposta.status === 404 && mensagem === 'Rota não encontrada') {
      throw erroHttp(502, `Rota não encontrada em ${url}. Confira a URL do serviço no Environment do Render`);
    }
    throw erroHttp(resposta.status, mensagem);
  }
  return dados;
}

async function buscarBebida(bebidaId) {
  const bebida = await requisitar(`${CATALOGO_URL}/bebidas/${bebidaId}`);
  return {
    id: bebida.id,
    nome: bebida.nome,
    preco: Number(bebida.precoPromocional ?? bebida.preco)
  };
}

async function consultarEstoque(bebidaId) {
  const estoque = await requisitar(`${ESTOQUE_URL}/estoque/${bebidaId}`);
  return Number(estoque.quantidade);
}

function baixarEstoque(pedidoId, itens) {
  return requisitar(`${ESTOQUE_URL}/estoque/baixar`, 'POST', {
    pedidoId,
    itens: itens.map((item) => ({ bebidaId: item.bebida_id, quantidade: item.quantidade }))
  });
}

function restaurarEstoque(pedidoId) {
  return requisitar(`${ESTOQUE_URL}/estoque/restaurar`, 'POST', { pedidoId });
}

function criarPagamento(dados) {
  return requisitar(`${PAGAMENTO_URL}/pagamentos`, 'POST', dados);
}

function estornarPagamento(pagamentoId) {
  return requisitar(`${PAGAMENTO_URL}/pagamentos/${pagamentoId}/estornar`, 'POST');
}

function confirmarPagamento(pagamentoId) {
  return requisitar(`${PAGAMENTO_URL}/pagamentos/${pagamentoId}/confirmar`, 'POST');
}

async function gerarEntrega(pedido) {
  if (!ENTREGAS_URL) return null;
  return requisitar(`${ENTREGAS_URL}/entregas`, 'POST', {
    pedidoId: pedido.id,
    clienteId: pedido.cliente_id,
    endereco: pedido.endereco
  });
}

async function cancelarEntrega(pedidoId) {
  if (!ENTREGAS_URL) return null;
  return requisitar(`${ENTREGAS_URL}/entregas/pedido/${pedidoId}/cancelar`, 'PATCH');
}

module.exports = {
  buscarBebida,
  consultarEstoque,
  baixarEstoque,
  restaurarEstoque,
  criarPagamento,
  estornarPagamento,
  confirmarPagamento,
  gerarEntrega,
  cancelarEntrega
};
