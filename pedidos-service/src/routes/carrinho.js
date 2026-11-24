const express = require('express');
const { exigirPerfil, garantirDono } = require('../autenticacao');
const { pool } = require('../db');
const { erroHttp, idValido } = require('../erros');
const { buscarBebida, consultarEstoque } = require('../servicosExternos');
const { obterCarrinhoId, montarCarrinho, validarCupomParaCarrinho } = require('../carrinhoService');

const router = express.Router();

router.use(exigirPerfil('cliente'));

function lerCliente(req) {
  const clienteId = idValido(req.params.clienteId);
  if (!clienteId) throw erroHttp(400, 'clienteId inválido');
  garantirDono(req, clienteId);
  return clienteId;
}

async function garantirEstoque(bebidaId, quantidade) {
  const disponivel = await consultarEstoque(bebidaId);
  if (quantidade > disponivel) {
    throw erroHttp(409, `Estoque insuficiente. Disponível: ${disponivel}`);
  }
}

router.get('/:clienteId', async (req, res) => {
  const clienteId = lerCliente(req);
  res.json(await montarCarrinho(clienteId));
});

router.post('/:clienteId/itens', async (req, res) => {
  const clienteId = lerCliente(req);
  const { bebidaId, quantidade } = req.body || {};
  const id = idValido(bebidaId);
  const qtd = idValido(quantidade);
  if (!id || !qtd) throw erroHttp(400, 'Informe bebidaId e quantidade maiores que zero');

  const [carrinhoId, bebida, disponivel] = await Promise.all([
    obterCarrinhoId(clienteId),
    buscarBebida(id),
    consultarEstoque(id)
  ]);
  const [existentes] = await pool.query(
    'SELECT quantidade FROM itens_carrinho WHERE carrinho_id = ? AND bebida_id = ?',
    [carrinhoId, id]
  );
  const novaQuantidade = (existentes[0]?.quantidade || 0) + qtd;
  if (novaQuantidade > disponivel) {
    throw erroHttp(409, `Estoque insuficiente. Disponível: ${disponivel}`);
  }

  if (existentes.length) {
    await pool.query(
      'UPDATE itens_carrinho SET quantidade = ?, preco_unitario = ?, nome = ? WHERE carrinho_id = ? AND bebida_id = ?',
      [novaQuantidade, bebida.preco, bebida.nome, carrinhoId, id]
    );
  } else {
    await pool.query(
      'INSERT INTO itens_carrinho (carrinho_id, bebida_id, nome, preco_unitario, quantidade) VALUES (?, ?, ?, ?, ?)',
      [carrinhoId, id, bebida.nome, bebida.preco, novaQuantidade]
    );
  }

  res.status(201).json(await montarCarrinho(clienteId));
});

router.put('/:clienteId/itens/:bebidaId', async (req, res) => {
  const clienteId = lerCliente(req);
  const bebidaId = idValido(req.params.bebidaId);
  const quantidade = Number((req.body || {}).quantidade);
  if (!bebidaId || !Number.isInteger(quantidade) || quantidade < 0) {
    throw erroHttp(400, 'Quantidade inválida');
  }

  const carrinhoId = await obterCarrinhoId(clienteId);
  const [existentes] = await pool.query(
    'SELECT id FROM itens_carrinho WHERE carrinho_id = ? AND bebida_id = ?',
    [carrinhoId, bebidaId]
  );
  if (!existentes.length) throw erroHttp(404, 'Item não está no carrinho');

  if (quantidade === 0) {
    await pool.query('DELETE FROM itens_carrinho WHERE id = ?', [existentes[0].id]);
  } else {
    await garantirEstoque(bebidaId, quantidade);
    await pool.query('UPDATE itens_carrinho SET quantidade = ? WHERE id = ?', [quantidade, existentes[0].id]);
  }

  res.json(await montarCarrinho(clienteId));
});

router.delete('/:clienteId/itens/:bebidaId', async (req, res) => {
  const clienteId = lerCliente(req);
  const bebidaId = idValido(req.params.bebidaId);
  if (!bebidaId) throw erroHttp(400, 'bebidaId inválido');

  const carrinhoId = await obterCarrinhoId(clienteId);
  const [resultado] = await pool.query(
    'DELETE FROM itens_carrinho WHERE carrinho_id = ? AND bebida_id = ?',
    [carrinhoId, bebidaId]
  );
  if (!resultado.affectedRows) throw erroHttp(404, 'Item não está no carrinho');

  res.json(await montarCarrinho(clienteId));
});

router.post('/:clienteId/cupom', async (req, res) => {
  const clienteId = lerCliente(req);
  const codigo = String((req.body || {}).codigo || '').trim().toUpperCase();
  if (!codigo) throw erroHttp(400, 'Informe o código do cupom');

  const carrinho = await montarCarrinho(clienteId);
  if (!carrinho.itens.length) throw erroHttp(400, 'Carrinho vazio');
  await validarCupomParaCarrinho(codigo, carrinho.subtotal);

  await pool.query('UPDATE carrinhos SET cupom_codigo = ? WHERE id = ?', [codigo, carrinho.carrinhoId]);
  res.json(await montarCarrinho(clienteId));
});

router.delete('/:clienteId/cupom', async (req, res) => {
  const clienteId = lerCliente(req);
  const carrinhoId = await obterCarrinhoId(clienteId);
  await pool.query('UPDATE carrinhos SET cupom_codigo = NULL WHERE id = ?', [carrinhoId]);
  res.json(await montarCarrinho(clienteId));
});

module.exports = router;
