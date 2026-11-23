const express = require('express');
const { pool } = require('../db');
const { erroHttp, idValido } = require('../erros');
const externos = require('../servicosExternos');
const { montarCarrinho, validarCupomParaCarrinho } = require('../carrinhoService');

const router = express.Router();

const FORMAS_PAGAMENTO = ['pix', 'cartao', 'dinheiro'];

const TRANSICOES = {
  aguardando_pagamento: ['confirmado'],
  confirmado: ['em_entrega'],
  em_entrega: ['entregue']
};

function formatarPedido(pedido, itens) {
  return {
    id: pedido.id,
    clienteId: pedido.cliente_id,
    status: pedido.status,
    subtotal: pedido.subtotal,
    desconto: pedido.desconto,
    total: pedido.total,
    cupom: pedido.cupom_codigo,
    formaPagamento: pedido.forma_pagamento,
    pagamentoId: pedido.pagamento_id,
    endereco: pedido.endereco,
    criadoEm: pedido.criado_em,
    atualizadoEm: pedido.atualizado_em,
    itens: itens?.map((item) => ({
      bebidaId: item.bebida_id,
      nome: item.nome,
      precoUnitario: item.preco_unitario,
      quantidade: item.quantidade
    }))
  };
}

async function buscarPedido(id) {
  const [[pedidos], [itens]] = await Promise.all([
    pool.query('SELECT * FROM pedidos WHERE id = ?', [id]),
    pool.query('SELECT * FROM itens_pedido WHERE pedido_id = ?', [id])
  ]);
  if (!pedidos.length) throw erroHttp(404, 'Pedido não encontrado');
  return { pedido: pedidos[0], itens };
}

async function atualizarStatus(id, status, pagamentoId) {
  if (pagamentoId) {
    await pool.query('UPDATE pedidos SET status = ?, pagamento_id = ? WHERE id = ?', [status, pagamentoId, id]);
  } else {
    await pool.query('UPDATE pedidos SET status = ? WHERE id = ?', [status, id]);
  }
}

async function solicitarEntrega(pedido) {
  try {
    await externos.gerarEntrega(pedido);
  } catch (erro) {
    console.error(`Falha ao gerar entrega do pedido ${pedido.id}:`, erro.message);
  }
}

async function cancelarEntregaDoPedido(pedidoId) {
  try {
    await externos.cancelarEntrega(pedidoId);
  } catch (erro) {
    console.error(`Falha ao cancelar entrega do pedido ${pedidoId}:`, erro.message);
  }
}

async function salvarPedido(clienteId, carrinho, formaPagamento, endereco) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const [resultado] = await conexao.query(
      `INSERT INTO pedidos (cliente_id, status, subtotal, desconto, total, cupom_codigo, forma_pagamento, endereco)
       VALUES (?, 'aguardando_pagamento', ?, ?, ?, ?, ?, ?)`,
      [clienteId, carrinho.subtotal, carrinho.desconto, carrinho.total, carrinho.cupom, formaPagamento, endereco]
    );
    const pedidoId = resultado.insertId;
    for (const item of carrinho.itens) {
      await conexao.query(
        'INSERT INTO itens_pedido (pedido_id, bebida_id, nome, preco_unitario, quantidade) VALUES (?, ?, ?, ?, ?)',
        [pedidoId, item.bebidaId, item.nome, item.precoUnitario, item.quantidade]
      );
    }
    await conexao.commit();
    return pedidoId;
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

async function limparCarrinho(carrinhoId) {
  await Promise.all([
    pool.query('DELETE FROM itens_carrinho WHERE carrinho_id = ?', [carrinhoId]),
    pool.query('UPDATE carrinhos SET cupom_codigo = NULL WHERE id = ?', [carrinhoId])
  ]);
}

router.post('/', async (req, res) => {
  const { clienteId, formaPagamento, endereco, cartao, trocoPara } = req.body || {};
  const idCliente = idValido(clienteId);
  if (!idCliente) throw erroHttp(400, 'clienteId inválido');
  if (!FORMAS_PAGAMENTO.includes(formaPagamento)) throw erroHttp(400, 'Forma de pagamento deve ser pix, cartao ou dinheiro');
  if (!endereco || !String(endereco).trim()) throw erroHttp(400, 'Informe o endereço de entrega');

  const carrinho = await montarCarrinho(idCliente);
  if (!carrinho.itens.length) throw erroHttp(400, 'Carrinho vazio');
  if (carrinho.cupom) await validarCupomParaCarrinho(carrinho.cupom, carrinho.subtotal);

  const pedidoId = await salvarPedido(idCliente, carrinho, formaPagamento, String(endereco).trim());

  try {
    await externos.baixarEstoque(pedidoId, carrinho.itens.map((item) => ({
      bebida_id: item.bebidaId,
      quantidade: item.quantidade
    })));
  } catch (erro) {
    await atualizarStatus(pedidoId, 'cancelado');
    throw erroHttp(erro.status === 409 ? 409 : 502, `Não foi possível reservar o estoque: ${erro.message}`);
  }

  let pagamento;
  try {
    pagamento = await externos.criarPagamento({
      pedidoId,
      valor: carrinho.total,
      metodo: formaPagamento,
      cartao,
      trocoPara
    });
  } catch (erro) {
    await externos.restaurarEstoque(pedidoId).catch(() => {});
    await atualizarStatus(pedidoId, 'cancelado');
    throw erroHttp(erro.status === 400 ? 400 : 502, `Falha no pagamento: ${erro.message}`);
  }

  if (pagamento.status === 'recusado') {
    await externos.restaurarEstoque(pedidoId).catch(() => {});
    await atualizarStatus(pedidoId, 'cancelado', pagamento.id);
    throw erroHttp(402, 'Pagamento recusado');
  }

  const confirmado = pagamento.status === 'aprovado' || formaPagamento === 'dinheiro';
  await atualizarStatus(pedidoId, confirmado ? 'confirmado' : 'aguardando_pagamento', pagamento.id);
  await limparCarrinho(carrinho.carrinhoId);

  const { pedido, itens } = await buscarPedido(pedidoId);
  if (confirmado) await solicitarEntrega(pedido);

  res.status(201).json({ pedido: formatarPedido(pedido, itens), pagamento });
});

router.get('/cliente/:clienteId', async (req, res) => {
  const clienteId = idValido(req.params.clienteId);
  if (!clienteId) throw erroHttp(400, 'clienteId inválido');

  const [pedidos] = await pool.query(
    'SELECT * FROM pedidos WHERE cliente_id = ? ORDER BY criado_em DESC, id DESC',
    [clienteId]
  );
  res.json(pedidos.map((pedido) => formatarPedido(pedido)));
});

router.get('/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) throw erroHttp(400, 'id inválido');
  const { pedido, itens } = await buscarPedido(id);
  res.json(formatarPedido(pedido, itens));
});

router.patch('/:id/cancelar', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) throw erroHttp(400, 'id inválido');
  const { pedido } = await buscarPedido(id);

  if (!['aguardando_pagamento', 'confirmado'].includes(pedido.status)) {
    throw erroHttp(409, `Pedido com status "${pedido.status}" não pode ser cancelado`);
  }

  if (pedido.pagamento_id) await externos.estornarPagamento(pedido.pagamento_id);
  await externos.restaurarEstoque(id);
  await atualizarStatus(id, 'cancelado');
  if (pedido.status === 'confirmado') await cancelarEntregaDoPedido(id);

  const atualizado = await buscarPedido(id);
  res.json(formatarPedido(atualizado.pedido, atualizado.itens));
});

router.patch('/:id/status', async (req, res) => {
  const id = idValido(req.params.id);
  const { status } = req.body || {};
  if (!id) throw erroHttp(400, 'id inválido');

  const { pedido } = await buscarPedido(id);
  const permitidos = TRANSICOES[pedido.status] || [];
  if (!permitidos.includes(status)) {
    throw erroHttp(409, `Não é possível mudar de "${pedido.status}" para "${status}"`);
  }

  if (status === 'entregue' && pedido.forma_pagamento === 'dinheiro' && pedido.pagamento_id) {
    await externos.confirmarPagamento(pedido.pagamento_id);
  }

  await atualizarStatus(id, status);
  const atualizado = await buscarPedido(id);
  if (status === 'confirmado') await solicitarEntrega(atualizado.pedido);

  res.json(formatarPedido(atualizado.pedido, atualizado.itens));
});

module.exports = router;
