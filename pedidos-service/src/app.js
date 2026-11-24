const express = require('express');
const { aplicarSeguranca } = require('./seguranca');
const swaggerUi = require('swagger-ui-express');
const documentacao = require('./docs');
const { pool } = require('./db');
const carrinhoRoutes = require('./routes/carrinho');
const pedidosRoutes = require('./routes/pedidos');

const app = express();
aplicarSeguranca(app);
app.use(express.json());

app.get('/health', async (req, res) => {
  const inicio = Date.now();
  try {
    await pool.query('SELECT 1');
    res.json({ servico: 'pedidos', status: 'ok', banco: 'ok', tempoBancoMs: Date.now() - inicio, ativoHaSegundos: Math.round(process.uptime()) });
  } catch (erro) {
    res.status(503).json({ servico: 'pedidos', status: 'erro', banco: 'indisponível' });
  }
});

app.get('/docs.json', (req, res) => res.json(documentacao));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(documentacao, { customSiteTitle: 'Serviço de Pedidos - API' }));

app.use('/carrinho', carrinhoRoutes);
app.use('/pedidos', pedidosRoutes);

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

app.use((erro, req, res, next) => {
  const status = erro.status >= 400 && erro.status < 600 ? erro.status : 500;
  if (status === 500) console.error(erro);
  res.status(status).json({ erro: status === 500 ? 'Erro interno no servidor' : erro.message });
});

module.exports = app;
