const { pool } = require('./db');
const { erroHttp } = require('./erros');
const { arredondar, motivoCupomInvalido, calcularDesconto } = require('./cupons');

async function buscarCupom(codigo) {
  const [linhas] = await pool.query('SELECT * FROM cupons WHERE codigo = ?', [codigo]);
  return linhas[0] || null;
}

async function obterCarrinhoId(clienteId) {
  const [existentes] = await pool.query('SELECT id FROM carrinhos WHERE cliente_id = ?', [clienteId]);
  if (existentes.length) return existentes[0].id;
  await pool.query('INSERT IGNORE INTO carrinhos (cliente_id) VALUES (?)', [clienteId]);
  const [linhas] = await pool.query('SELECT id FROM carrinhos WHERE cliente_id = ?', [clienteId]);
  return linhas[0].id;
}

async function montarCarrinho(clienteId) {
  const [[carrinhos], [itens]] = await Promise.all([
    pool.query(
      `SELECT c.id, c.cupom_codigo, cp.codigo, cp.tipo, cp.valor, cp.valor_minimo, cp.validade, cp.ativo
       FROM carrinhos c LEFT JOIN cupons cp ON cp.codigo = c.cupom_codigo
       WHERE c.cliente_id = ?`,
      [clienteId]
    ),
    pool.query(
      `SELECT i.bebida_id, i.nome, i.preco_unitario, i.quantidade
       FROM itens_carrinho i JOIN carrinhos c ON c.id = i.carrinho_id
       WHERE c.cliente_id = ? ORDER BY i.id`,
      [clienteId]
    )
  ]);

  const carrinho = carrinhos[0] || { id: await obterCarrinhoId(clienteId), cupom_codigo: null };
  const carrinhoId = carrinho.id;
  const subtotal = arredondar(itens.reduce((soma, item) => soma + item.preco_unitario * item.quantidade, 0));
  const cupom = carrinho.cupom_codigo && carrinho.codigo ? carrinho : null;
  const desconto = calcularDesconto(cupom, subtotal);

  return {
    carrinhoId,
    clienteId,
    itens: itens.map((item) => ({
      bebidaId: item.bebida_id,
      nome: item.nome,
      precoUnitario: item.preco_unitario,
      quantidade: item.quantidade,
      total: arredondar(item.preco_unitario * item.quantidade)
    })),
    cupom: carrinho.cupom_codigo,
    cupomAviso: cupom ? motivoCupomInvalido(cupom, subtotal) : null,
    subtotal,
    desconto,
    total: arredondar(subtotal - desconto)
  };
}

async function validarCupomParaCarrinho(codigo, subtotal) {
  const cupom = await buscarCupom(codigo);
  const motivo = motivoCupomInvalido(cupom, subtotal);
  if (motivo) throw erroHttp(400, motivo);
  return cupom;
}

module.exports = { arredondar, obterCarrinhoId, montarCarrinho, validarCupomParaCarrinho };
