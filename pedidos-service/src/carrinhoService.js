const { pool } = require('./db');
const { erroHttp } = require('./erros');

function arredondar(valor) {
  return Math.round(valor * 100) / 100;
}

async function buscarCupom(codigo) {
  const [linhas] = await pool.query('SELECT * FROM cupons WHERE codigo = ?', [codigo]);
  return linhas[0] || null;
}

function motivoCupomInvalido(cupom, subtotal) {
  if (!cupom || !cupom.ativo) return 'Cupom não encontrado';
  if (cupom.validade && new Date(cupom.validade) < new Date(new Date().toDateString())) return 'Cupom vencido';
  if (subtotal < cupom.valor_minimo) return `Cupom válido apenas para compras a partir de R$ ${cupom.valor_minimo.toFixed(2)}`;
  return null;
}

function calcularDesconto(cupom, subtotal) {
  if (!cupom || motivoCupomInvalido(cupom, subtotal)) return 0;
  if (cupom.tipo === 'percentual') return arredondar(subtotal * cupom.valor / 100);
  return Math.min(cupom.valor, subtotal);
}

async function obterCarrinhoId(clienteId) {
  await pool.query('INSERT IGNORE INTO carrinhos (cliente_id) VALUES (?)', [clienteId]);
  const [linhas] = await pool.query('SELECT id FROM carrinhos WHERE cliente_id = ?', [clienteId]);
  return linhas[0].id;
}

async function montarCarrinho(clienteId) {
  const carrinhoId = await obterCarrinhoId(clienteId);
  const [[carrinho]] = await pool.query('SELECT * FROM carrinhos WHERE id = ?', [carrinhoId]);
  const [itens] = await pool.query(
    'SELECT bebida_id, nome, preco_unitario, quantidade FROM itens_carrinho WHERE carrinho_id = ? ORDER BY id',
    [carrinhoId]
  );

  const subtotal = arredondar(itens.reduce((soma, item) => soma + item.preco_unitario * item.quantidade, 0));
  const cupom = carrinho.cupom_codigo ? await buscarCupom(carrinho.cupom_codigo) : null;
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
