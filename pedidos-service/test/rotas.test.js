process.env.DATABASE_URL = 'mysql://teste:teste@127.0.0.1:1/bd_teste';
process.env.AUTENTICACAO_URL = 'http://127.0.0.1:45871';

const http = require('http');
const test = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const { pool } = require('../src/db');

const USUARIOS = {
  'Bearer token-cliente-1': { id: 1, nome: 'Cliente', email: 'c@teste.com', perfil: 'cliente' },
  'Bearer token-admin': { id: 9, nome: 'Admin', email: 'a@teste.com', perfil: 'administrador' },
  'Bearer token-entregador': { id: 8, nome: 'Entregador', email: 'e@teste.com', perfil: 'entregador' }
};

const autenticacaoFalsa = http.createServer((req, res) => {
  const usuario = USUARIOS[req.headers.authorization];
  res.writeHead(usuario ? 200 : 401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(usuario || { erro: 'Token inválido' }));
});

let servidor;
let base;

test.before(() => new Promise((resolve) => {
  autenticacaoFalsa.listen(45871);
  servidor = app.listen(0, () => {
    base = `http://127.0.0.1:${servidor.address().port}`;
    resolve();
  });
}));

test.after(async () => {
  servidor.close();
  autenticacaoFalsa.close();
  await pool.end();
});

async function chamar(caminho, metodo = 'GET', corpo, token) {
  const cabecalhos = { 'Content-Type': 'application/json' };
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
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

test('finalizar pedido sem login responde 401', async () => {
  const { status, dados } = await chamar('/pedidos', 'POST', { clienteId: 1, formaPagamento: 'pix', endereco: 'Rua A' });
  assert.strictEqual(status, 401);
  assert.match(dados.erro, /login/);
});

test('carrinho sem login responde 401', async () => {
  const { status } = await chamar('/carrinho/1');
  assert.strictEqual(status, 401);
});

test('token invalido responde 401', async () => {
  const { status } = await chamar('/carrinho/1', 'GET', undefined, 'token-falso');
  assert.strictEqual(status, 401);
});

test('administrador nao pode comprar', async () => {
  const { status } = await chamar('/carrinho/1/itens', 'POST', { bebidaId: 1, quantidade: 1 }, 'token-admin');
  assert.strictEqual(status, 403);
});

test('entregador nao pode comprar nem ver pedidos de clientes', async () => {
  assert.strictEqual((await chamar('/carrinho/8', 'GET', undefined, 'token-entregador')).status, 403);
  assert.strictEqual((await chamar('/pedidos/cliente/1', 'GET', undefined, 'token-entregador')).status, 403);
});

test('cliente nao acessa o carrinho de outro cliente', async () => {
  const { status, dados } = await chamar('/carrinho/2', 'GET', undefined, 'token-cliente-1');
  assert.strictEqual(status, 403);
  assert.match(dados.erro, /seus próprios dados/);
});

test('cliente nao finaliza pedido em nome de outro cliente', async () => {
  const { status } = await chamar('/pedidos', 'POST', { clienteId: 2, formaPagamento: 'pix', endereco: 'Rua A' }, 'token-cliente-1');
  assert.strictEqual(status, 403);
});

test('finalizar com forma de pagamento invalida responde 400', async () => {
  const { status, dados } = await chamar('/pedidos', 'POST', { clienteId: 1, formaPagamento: 'boleto', endereco: 'Rua A' }, 'token-cliente-1');
  assert.strictEqual(status, 400);
  assert.match(dados.erro, /pix, cartao ou dinheiro/);
});

test('finalizar sem endereco responde 400', async () => {
  const { status, dados } = await chamar('/pedidos', 'POST', { clienteId: 1, formaPagamento: 'pix', endereco: '   ' }, 'token-cliente-1');
  assert.strictEqual(status, 400);
  assert.match(dados.erro, /endereço/);
});

test('adicionar item com quantidade zero responde 400', async () => {
  const { status } = await chamar('/carrinho/1/itens', 'POST', { bebidaId: 1, quantidade: 0 }, 'token-cliente-1');
  assert.strictEqual(status, 400);
});

test('administrador com id de pedido invalido recebe 400', async () => {
  const { status, dados } = await chamar('/pedidos/abc', 'GET', undefined, 'token-admin');
  assert.strictEqual(status, 400);
  assert.strictEqual(dados.erro, 'id inválido');
});

test('rota interna de status continua sem login e valida o id', async () => {
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
