const crypto = require('crypto');
const express = require('express');
const { pool } = require('../db');
const { erroHttp, idValido } = require('../erros');
const { validarCartao } = require('../cartao');

const router = express.Router();

const METODOS = ['pix', 'cartao', 'dinheiro'];
const PEDIDOS_URL = process.env.PEDIDOS_URL;

function formatarPagamento(pagamento) {
  return {
    id: pagamento.id,
    pedidoId: pagamento.pedido_id,
    metodo: pagamento.metodo,
    valor: pagamento.valor,
    status: pagamento.status,
    codigoPix: pagamento.codigo_pix,
    pixExpiraEm: pagamento.pix_expira_em,
    cartaoFinal: pagamento.cartao_final,
    cartaoBandeira: pagamento.cartao_bandeira,
    trocoPara: pagamento.troco_para,
    troco: pagamento.troco_para ? Math.round((pagamento.troco_para - pagamento.valor) * 100) / 100 : null,
    criadoEm: pagamento.criado_em,
    confirmadoEm: pagamento.confirmado_em,
    estornadoEm: pagamento.estornado_em
  };
}

async function buscarPagamento(id) {
  const [linhas] = await pool.query('SELECT * FROM pagamentos WHERE id = ?', [id]);
  if (!linhas.length) throw erroHttp(404, 'Pagamento não encontrado');
  return linhas[0];
}

async function avisarPedidoConfirmado(pedidoId) {
  const resposta = await fetch(`${PEDIDOS_URL}/pedidos/${pedidoId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'confirmado' }),
    signal: AbortSignal.timeout(60000)
  });
  if (!resposta.ok) throw new Error(`Serviço de pedidos respondeu ${resposta.status}`);
}

router.post('/', async (req, res) => {
  const { pedidoId, valor, metodo, cartao, trocoPara } = req.body || {};
  const idPedido = idValido(pedidoId);
  const valorPago = Number(valor);

  if (!idPedido) throw erroHttp(400, 'pedidoId inválido');
  if (!(valorPago > 0)) throw erroHttp(400, 'Valor deve ser maior que zero');
  if (!METODOS.includes(metodo)) throw erroHttp(400, 'Método deve ser pix, cartao ou dinheiro');

  const [ativos] = await pool.query(
    "SELECT id FROM pagamentos WHERE pedido_id = ? AND status IN ('pendente', 'aprovado')",
    [idPedido]
  );
  if (ativos.length) throw erroHttp(409, 'Este pedido já possui um pagamento em andamento');

  const dados = {
    pedido_id: idPedido,
    metodo,
    valor: valorPago,
    status: 'pendente',
    codigo_pix: null,
    pix_expira_em: null,
    cartao_final: null,
    cartao_bandeira: null,
    troco_para: null,
    confirmado_em: null
  };

  if (metodo === 'pix') {
    dados.codigo_pix = `PIX${idPedido}${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
    dados.pix_expira_em = new Date(Date.now() + 30 * 60 * 1000);
  }

  if (metodo === 'cartao') {
    const resultado = validarCartao(cartao);
    dados.cartao_final = resultado.final;
    dados.cartao_bandeira = resultado.bandeira;
    dados.status = resultado.aprovado ? 'aprovado' : 'recusado';
    dados.confirmado_em = resultado.aprovado ? new Date() : null;
  }

  if (metodo === 'dinheiro' && trocoPara !== undefined && trocoPara !== null && trocoPara !== '') {
    const troco = Number(trocoPara);
    if (!(troco >= valorPago)) throw erroHttp(400, 'Troco deve ser para um valor maior ou igual ao total');
    dados.troco_para = troco;
  }

  const [resultado] = await pool.query('INSERT INTO pagamentos SET ?', [dados]);
  const pagamento = await buscarPagamento(resultado.insertId);
  res.status(201).json(formatarPagamento(pagamento));
});

router.get('/pedido/:pedidoId', async (req, res) => {
  const pedidoId = idValido(req.params.pedidoId);
  if (!pedidoId) throw erroHttp(400, 'pedidoId inválido');
  const [linhas] = await pool.query('SELECT * FROM pagamentos WHERE pedido_id = ? ORDER BY id DESC', [pedidoId]);
  res.json(linhas.map(formatarPagamento));
});

router.get('/:id', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) throw erroHttp(400, 'id inválido');
  res.json(formatarPagamento(await buscarPagamento(id)));
});

router.post('/:id/confirmar', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) throw erroHttp(400, 'id inválido');
  const pagamento = await buscarPagamento(id);

  if (pagamento.status !== 'pendente') {
    throw erroHttp(409, `Pagamento com status "${pagamento.status}" não pode ser confirmado`);
  }
  if (pagamento.metodo === 'pix' && new Date(pagamento.pix_expira_em) < new Date()) {
    await pool.query("UPDATE pagamentos SET status = 'cancelado' WHERE id = ?", [id]);
    throw erroHttp(410, 'Código Pix expirado');
  }

  await pool.query("UPDATE pagamentos SET status = 'aprovado', confirmado_em = NOW() WHERE id = ?", [id]);

  let aviso = null;
  if (pagamento.metodo !== 'dinheiro') {
    try {
      await avisarPedidoConfirmado(pagamento.pedido_id);
    } catch (erro) {
      aviso = `Pagamento aprovado, mas o pedido não foi atualizado: ${erro.message}`;
      console.error(aviso);
    }
  }

  res.json({ ...formatarPagamento(await buscarPagamento(id)), aviso });
});

router.post('/:id/estornar', async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) throw erroHttp(400, 'id inválido');
  const pagamento = await buscarPagamento(id);

  if (pagamento.status === 'aprovado') {
    await pool.query("UPDATE pagamentos SET status = 'estornado', estornado_em = NOW() WHERE id = ?", [id]);
  } else if (pagamento.status === 'pendente') {
    await pool.query("UPDATE pagamentos SET status = 'cancelado' WHERE id = ?", [id]);
  } else {
    throw erroHttp(409, `Pagamento com status "${pagamento.status}" não pode ser estornado`);
  }

  res.json(formatarPagamento(await buscarPagamento(id)));
});

module.exports = router;
