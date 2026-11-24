const express = require('express');
const { exigirPerfil, garantirDono } = require('../autenticacao');
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

async function inserirPedido(clienteId, carrinho, formaPagamento, endereco) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const [[{ proximo }]] = await conexao.query('SELECT COALESCE(MAX(id), 0) + 1 AS proximo FROM pedidos FOR UPDATE');
    await conexao.query(
      `INSERT INTO pedidos (id, cliente_id, status, subtotal, desconto, total, cupom_codigo, forma_pagamento, endereco)
       VALUES (?, ?, 'aguardando_pagamento', ?, ?, ?, ?, ?, ?)`,
      [proximo, clienteId, carrinho.subtotal, carrinho.desconto, carrinho.total, carrinho.cupom, formaPagamento, endereco]
    );
    await conexao.query(
      'INSERT INTO itens_pedido (pedido_id, bebida_id, nome, preco_unitario, quantidade) VALUES ?',
      [carrinho.itens.map((item) => [proximo, item.bebidaId, item.nome, item.precoUnitario, item.quantidade])]
    );
    await conexao.commit();
    return proximo;
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

async function salvarPedido(clienteId, carrinho, formaPagamento, endereco) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await inserirPedido(clienteId, carrinho, formaPagamento, endereco);
    } catch (erro) {
      if (erro.code !== 'ER_DUP_ENTRY' || tentativa === 3) throw erro;
    }
  }
}

async function removerPedido(pedidoId) {
  await pool.query('DELETE FROM itens_pedido WHERE pedido_id = ?', [pedidoId]);
  await pool.query('DELETE FROM pedidos WHERE id = ?', [pedidoId]);
}

const clientesFinalizando = new Set();

async function limparCarrinho(carrinhoId) {
  await Promise.all([
    pool.query('DELETE FROM itens_carrinho WHERE carrinho_id = ?', [carrinhoId]),
    pool.query('UPDATE carrinhos SET cupom_codigo = NULL WHERE id = ?', [carrinhoId])
  ]);
}

router.post('/', exigirPerfil('cliente'), async (req, res) => {
  const { clienteId, formaPagamento, endereco, cartao, trocoPara } = req.body || {};
  const idCliente = idValido(clienteId);
  if (!idCliente) throw erroHttp(400, 'clienteId inválido');
  garantirDono(req, idCliente);
  if (!FORMAS_PAGAMENTO.includes(formaPagamento)) throw erroHttp(400, 'Forma de pagamento deve ser pix, cartao ou dinheiro');
  if (!endereco || !String(endereco).trim()) throw erroHttp(400, 'Informe o endereço de entrega');

  if (clientesFinalizando.has(idCliente)) {
    throw erroHttp(409, 'Seu pedido já está sendo processado. Aguarde.');
  }
  clientesFinalizando.add(idCliente);
  try {
    res.status(201).json(await finalizarPedido(idCliente, formaPagamento, String(endereco).trim(), cartao, trocoPara));
  } finally {
    clientesFinalizando.delete(idCliente);
  }
});

function reais(valor) {
  return `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
}

async function conferirItensNoCatalogo(carrinho) {
  const atuais = await Promise.all(carrinho.itens.map((item) => externos.buscarBebida(item.bebidaId).catch((erro) => {
    if (erro.status === 404) return null;
    throw erro;
  })));
  const avisos = [];
  for (const [posicao, item] of carrinho.itens.entries()) {
    const atual = atuais[posicao];
    if (!atual) {
      avisos.push(`"${item.nome}" saiu do catálogo e foi retirada do carrinho`);
      await pool.query('DELETE FROM itens_carrinho WHERE carrinho_id = ? AND bebida_id = ?', [carrinho.carrinhoId, item.bebidaId]);
    } else if (Number(atual.preco) !== Number(item.precoUnitario)) {
      avisos.push(`O preço de "${atual.nome}" mudou de ${reais(item.precoUnitario)} para ${reais(atual.preco)}`);
      await pool.query(
        'UPDATE itens_carrinho SET nome = ?, preco_unitario = ? WHERE carrinho_id = ? AND bebida_id = ?',
        [atual.nome, atual.preco, carrinho.carrinhoId, item.bebidaId]
      );
    }
  }
  if (avisos.length) throw erroHttp(409, `${avisos.join('. ')}. Confira o carrinho e finalize de novo.`);
}

async function finalizarPedido(idCliente, formaPagamento, endereco, cartao, trocoPara) {
  const carrinho = await montarCarrinho(idCliente);
  if (!carrinho.itens.length) throw erroHttp(400, 'Carrinho vazio');
  await conferirItensNoCatalogo(carrinho);
  if (carrinho.cupom) await validarCupomParaCarrinho(carrinho.cupom, carrinho.subtotal);

  const pedidoId = await salvarPedido(idCliente, carrinho, formaPagamento, endereco);

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
    await removerPedido(pedidoId);
    throw erroHttp(erro.status === 400 ? 400 : 502, `Falha no pagamento: ${erro.message}`);
  }

  if (pagamento.status === 'recusado') {
    await removerPedido(pedidoId);
    throw erroHttp(402, 'Pagamento recusado. Confira os dados do cartão ou escolha outra forma de pagamento.');
  }

  try {
    await externos.baixarEstoque(pedidoId, carrinho.itens.map((item) => ({
      bebida_id: item.bebidaId,
      quantidade: item.quantidade
    })));
  } catch (erro) {
    await externos.estornarPagamento(pagamento.id).catch(() => {});
    await removerPedido(pedidoId);
    throw erroHttp(erro.status === 409 ? 409 : 502, `Não foi possível reservar o estoque: ${erro.message}`);
  }

  const confirmado = pagamento.status === 'aprovado' || formaPagamento === 'dinheiro';
  await atualizarStatus(pedidoId, confirmado ? 'confirmado' : 'aguardando_pagamento', pagamento.id);
  await limparCarrinho(carrinho.carrinhoId);

  const { pedido, itens } = await buscarPedido(pedidoId);
  if (confirmado) await solicitarEntrega(pedido);

  return { pedido: formatarPedido(pedido, itens), pagamento };
}

router.get('/cliente/:clienteId', exigirPerfil('cliente', 'administrador'), async (req, res) => {
  const clienteId = idValido(req.params.clienteId);
  if (!clienteId) throw erroHttp(400, 'clienteId inválido');
  garantirDono(req, clienteId);

  const [pedidos] = await pool.query(
    'SELECT * FROM pedidos WHERE cliente_id = ? ORDER BY criado_em DESC, id DESC',
    [clienteId]
  );
  res.json(pedidos.map((pedido) => formatarPedido(pedido)));
});

router.get('/:id', exigirPerfil('cliente', 'administrador'), async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) throw erroHttp(400, 'id inválido');
  const { pedido, itens } = await buscarPedido(id);
  garantirDono(req, pedido.cliente_id);
  res.json(formatarPedido(pedido, itens));
});

async function entregaFalhou(pedidoId) {
  const entrega = await externos.buscarEntregaDoPedido(pedidoId).catch(() => null);
  return entrega?.status === 'falhou';
}

async function estornarSeNecessario(pagamentoId) {
  try {
    await externos.estornarPagamento(pagamentoId);
  } catch (erro) {
    if (erro.status !== 409) throw erro;
  }
}

router.patch('/:id/cancelar', exigirPerfil('cliente', 'administrador'), async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) throw erroHttp(400, 'id inválido');
  const { pedido } = await buscarPedido(id);
  garantirDono(req, pedido.cliente_id);

  const podeCancelar = ['aguardando_pagamento', 'confirmado'].includes(pedido.status)
    || (pedido.status === 'em_entrega' && await entregaFalhou(id));
  if (!podeCancelar) {
    throw erroHttp(409, `Pedido com status "${pedido.status}" não pode ser cancelado`);
  }

  if (pedido.pagamento_id) await estornarSeNecessario(pedido.pagamento_id);
  await externos.restaurarEstoque(id);
  await atualizarStatus(id, 'cancelado');
  if (pedido.status !== 'aguardando_pagamento') await cancelarEntregaDoPedido(id);

  const atualizado = await buscarPedido(id);
  res.json(formatarPedido(atualizado.pedido, atualizado.itens));
});

const SITUACAO_DA_ENTREGA = {
  em_entrega: ['atribuida', 'em_rota'],
  entregue: ['em_rota', 'entregue']
};

async function conferirMudancaDeStatus(pedidoId, status) {
  if (status === 'confirmado') {
    const pagamentos = await externos.listarPagamentosDoPedido(pedidoId);
    if (!pagamentos.some((pagamento) => pagamento.status === 'aprovado')) {
      throw erroHttp(409, 'O pedido só é confirmado depois que o pagamento for aprovado');
    }
    return;
  }
  const entrega = await externos.buscarEntregaDoPedido(pedidoId);
  if (entrega && !SITUACAO_DA_ENTREGA[status].includes(entrega.status)) {
    throw erroHttp(409, `A entrega do pedido está "${entrega.status}" e não permite marcar o pedido como "${status}"`);
  }
}

router.patch('/:id/status', async (req, res) => {
  const id = idValido(req.params.id);
  const { status } = req.body || {};
  if (!id) throw erroHttp(400, 'id inválido');

  const { pedido } = await buscarPedido(id);
  const permitidos = TRANSICOES[pedido.status] || [];
  if (!permitidos.includes(status)) {
    throw erroHttp(409, `Não é possível mudar de "${pedido.status}" para "${status}"`);
  }

  await conferirMudancaDeStatus(id, status);

  if (status === 'entregue' && pedido.forma_pagamento === 'dinheiro' && pedido.pagamento_id) {
    await externos.confirmarPagamento(pedido.pagamento_id);
  }

  await atualizarStatus(id, status);
  const atualizado = await buscarPedido(id);
  if (status === 'confirmado') await solicitarEntrega(atualizado.pedido);

  res.json(formatarPedido(atualizado.pedido, atualizado.itens));
});

module.exports = router;
