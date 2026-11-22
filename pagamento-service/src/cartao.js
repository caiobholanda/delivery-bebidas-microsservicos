const { erroHttp } = require('./erros');

function luhnValido(numero) {
  let soma = 0;
  let dobrar = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let digito = Number(numero[i]);
    if (dobrar) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    soma += digito;
    dobrar = !dobrar;
  }
  return soma % 10 === 0;
}

function identificarBandeira(numero) {
  if (numero.startsWith('4')) return 'visa';
  if (/^5[1-5]/.test(numero)) return 'mastercard';
  if (/^3[47]/.test(numero)) return 'amex';
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|6277|6362|6363|6504|6505|6516)/.test(numero)) return 'elo';
  return 'outra';
}

function cartaoVencido(validade) {
  const [mes, ano] = validade.split('/').map(Number);
  const primeiroDiaDepoisDoVencimento = new Date(2000 + ano, mes, 1);
  return primeiroDiaDepoisDoVencimento <= new Date();
}

function validarCartao(cartao) {
  if (!cartao) throw erroHttp(400, 'Dados do cartão são obrigatórios');

  const numero = String(cartao.numero || '').replace(/\D/g, '');
  const validade = String(cartao.validade || '').trim();
  const cvv = String(cartao.cvv || '').trim();
  const nome = String(cartao.nome || '').trim();

  if (numero.length < 13 || numero.length > 19) throw erroHttp(400, 'Número do cartão inválido');
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(validade)) throw erroHttp(400, 'Validade deve estar no formato MM/AA');
  if (!/^\d{3,4}$/.test(cvv)) throw erroHttp(400, 'CVV inválido');
  if (!nome) throw erroHttp(400, 'Nome impresso no cartão é obrigatório');

  return {
    aprovado: luhnValido(numero) && !cartaoVencido(validade),
    final: numero.slice(-4),
    bandeira: identificarBandeira(numero)
  };
}

module.exports = { validarCartao };
