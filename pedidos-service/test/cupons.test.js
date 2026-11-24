const test = require('node:test');
const assert = require('node:assert');
const { arredondar, motivoCupomInvalido, calcularDesconto } = require('../src/cupons');

const bemVindo = { codigo: 'BEMVINDO10', tipo: 'percentual', valor: 10, valor_minimo: 0, validade: null, ativo: 1 };
const gelada = { codigo: 'GELADA5', tipo: 'fixo', valor: 5, valor_minimo: 30, validade: null, ativo: 1 };
const vencido = { codigo: 'VENCIDO20', tipo: 'percentual', valor: 20, valor_minimo: 0, validade: '2024-01-01', ativo: 1 };
const hoje = new Date('2026-11-23T12:00:00');

test('arredonda para duas casas', () => {
  assert.strictEqual(arredondar(3.295), 3.3);
  assert.strictEqual(arredondar(10), 10);
});

test('cupom percentual aplica a porcentagem do subtotal', () => {
  assert.strictEqual(calcularDesconto(bemVindo, 32.95, hoje), 3.3);
});

test('cupom fixo desconta o valor quando passa do minimo', () => {
  assert.strictEqual(calcularDesconto(gelada, 40, hoje), 5);
});

test('cupom fixo nunca deixa o total negativo', () => {
  const grande = { ...gelada, valor: 50, valor_minimo: 0 };
  assert.strictEqual(calcularDesconto(grande, 20, hoje), 20);
});

test('cupom abaixo do valor minimo nao da desconto e explica o motivo', () => {
  assert.strictEqual(calcularDesconto(gelada, 13, hoje), 0);
  assert.match(motivoCupomInvalido(gelada, 13, hoje), /a partir de R\$ 30\.00/);
});

test('cupom vencido e recusado', () => {
  assert.strictEqual(motivoCupomInvalido(vencido, 100, hoje), 'Cupom vencido');
  assert.strictEqual(calcularDesconto(vencido, 100, hoje), 0);
});

test('cupom inexistente ou inativo e recusado', () => {
  assert.strictEqual(motivoCupomInvalido(null, 100, hoje), 'Cupom não encontrado');
  assert.strictEqual(motivoCupomInvalido({ ...bemVindo, ativo: 0 }, 100, hoje), 'Cupom não encontrado');
});

test('cupom valido no ultimo dia da validade', () => {
  assert.strictEqual(motivoCupomInvalido({ ...bemVindo, validade: '2026-11-23' }, 10, hoje), null);
});
