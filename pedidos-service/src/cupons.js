function arredondar(valor) {
  return Math.round(valor * 100) / 100;
}

function dataSemHora(valor) {
  if (typeof valor === 'string') return valor.slice(0, 10);
  const data = new Date(valor);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function motivoCupomInvalido(cupom, subtotal, hoje = new Date()) {
  if (!cupom || !cupom.ativo) return 'Cupom não encontrado';
  if (cupom.validade && dataSemHora(cupom.validade) < dataSemHora(hoje)) return 'Cupom vencido';
  if (subtotal < cupom.valor_minimo) return `Cupom válido apenas para compras a partir de R$ ${Number(cupom.valor_minimo).toFixed(2)}`;
  return null;
}

function calcularDesconto(cupom, subtotal, hoje = new Date()) {
  if (!cupom || motivoCupomInvalido(cupom, subtotal, hoje)) return 0;
  if (cupom.tipo === 'percentual') return arredondar(subtotal * cupom.valor / 100);
  return Math.min(cupom.valor, subtotal);
}

module.exports = { arredondar, motivoCupomInvalido, calcularDesconto };
