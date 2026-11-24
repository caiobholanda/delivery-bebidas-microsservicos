const test = require('node:test');
const assert = require('node:assert');
const { validarCartao } = require('../src/cartao');

const valido = { numero: '4111 1111 1111 1111', nome: 'CAIO BARSI', validade: '12/99', cvv: '123' };

test('cartao valido e aprovado e guarda so os 4 ultimos digitos', () => {
  const resultado = validarCartao(valido);
  assert.deepStrictEqual(resultado, { aprovado: true, final: '1111', bandeira: 'visa' });
});

test('numero que falha no algoritmo de Luhn e recusado', () => {
  assert.strictEqual(validarCartao({ ...valido, numero: '4111111111111112' }).aprovado, false);
});

test('cartao vencido e recusado', () => {
  assert.strictEqual(validarCartao({ ...valido, validade: '01/20' }).aprovado, false);
});

test('identifica a bandeira mastercard', () => {
  assert.strictEqual(validarCartao({ ...valido, numero: '5555555555554444' }).bandeira, 'mastercard');
});

test('numero curto demais gera erro 400', () => {
  assert.throws(() => validarCartao({ ...valido, numero: '123' }), { status: 400, message: 'Número do cartão inválido' });
});

test('validade fora do formato MM/AA gera erro 400', () => {
  assert.throws(() => validarCartao({ ...valido, validade: '2029-12' }), { status: 400 });
});

test('cvv invalido gera erro 400', () => {
  assert.throws(() => validarCartao({ ...valido, cvv: '12' }), { status: 400, message: 'CVV inválido' });
});

test('nome vazio gera erro 400', () => {
  assert.throws(() => validarCartao({ ...valido, nome: '  ' }), { status: 400 });
});

test('sem dados do cartao gera erro 400', () => {
  assert.throws(() => validarCartao(undefined), { status: 400 });
});
