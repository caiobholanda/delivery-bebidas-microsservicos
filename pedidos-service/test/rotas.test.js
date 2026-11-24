process.env.DATABASE_URL = 'mysql://teste:teste@127.0.0.1:1/bd_teste';

const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const { pool } = require('../src/db');

let servidor;
let base;

test.before(() => new Promise((resolve) => {
  servidor = app.listen(0, () => {
    base = `http://127.0.0.1:${servidor.address().port}`;
    resolve();
  });
}));

test.after(async () => {
  servidor.close();
  await pool.end();
});

async function chamar(caminho, metodo = 'GET', corpo) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: typeof corpo === 'string' ? corpo : corpo && JSON.stringify(corpo)
  });
  return { status: resposta.status, dados: await resposta.json() };
}

test('health responde 503 quando o banco esta fora do ar', async () => {
  const { status, dados } = await chamar('/health');
  assert.strictEqual(status, 503);
  assert.strictEqual(dados.banco, 'indisponível');
});

test('rota inexistente responde 404 em JSON', async () => {
  const { status, dados } = await chamar('/nao-existe');
  assert.strictEqual(status, 404);
  assert.strictEqual(dados.erro, 'Rota não encontrada');
});

test('documentacao da API esta disponivel', async () => {
  const { status, dados } = await chamar('/docs.json');
  assert.strictEqual(status, 200);
  assert.ok(dados.paths['/pedidos']);
});

test('id de pedido invalido responde 400', async () => {
  const { status, dados } = await chamar('/pedidos/abc');
  assert.strictEqual(status, 400);
  assert.strictEqual(dados.erro, 'id inválido');
});

test('finalizar sem cliente valido responde 400', async () => {
  const { status } = await chamar('/pedidos', 'POST', { clienteId: 0, formaPagamento: 'pix', endereco: 'Rua A' });
  assert.strictEqual(status, 400);
});

test('finalizar com forma de pagamento invalida responde 400', async () => {
  const { status, dados } = await chamar('/pedidos', 'POST', { clienteId: 1, formaPagamento: 'boleto', endereco: 'Rua A' });
  assert.strictEqual(status, 400);
  assert.match(dados.erro, /pix, cartao ou dinheiro/);
});

test('finalizar sem endereco responde 400', async () => {
  const { status, dados } = await chamar('/pedidos', 'POST', { clienteId: 1, formaPagamento: 'pix', endereco: '   ' });
  assert.strictEqual(status, 400);
  assert.match(dados.erro, /endereço/);
});

test('adicionar item com quantidade zero responde 400', async () => {
  const { status } = await chamar('/carrinho/1/itens', 'POST', { bebidaId: 1, quantidade: 0 });
  assert.strictEqual(status, 400);
});

test('mudar para status nao permitido responde 400 antes de consultar o banco', async () => {
  const { status } = await chamar('/pedidos/abc/status', 'PATCH', { status: 'entregue' });
  assert.strictEqual(status, 400);
});

test('JSON mal formado responde 400', async () => {
  const { status } = await chamar('/pedidos', 'POST', '{ isso nao e json');
  assert.strictEqual(status, 400);
});

test('responde com cabecalhos de seguranca e sem X-Powered-By', async () => {
  const resposta = await fetch(`${base}/nao-existe`);
  assert.strictEqual(resposta.headers.get('x-content-type-options'), 'nosniff');
  assert.strictEqual(resposta.headers.get('x-powered-by'), null);
});

test('libera CORS para o front do projeto e bloqueia outros sites', async () => {
  const permitido = await fetch(`${base}/docs.json`, { headers: { Origin: 'https://delivery-bebidas-front.onrender.com' } });
  assert.strictEqual(permitido.headers.get('access-control-allow-origin'), 'https://delivery-bebidas-front.onrender.com');
  const bloqueado = await fetch(`${base}/docs.json`, { headers: { Origin: 'https://site-qualquer.com' } });
  assert.strictEqual(bloqueado.headers.get('access-control-allow-origin'), null);
});
