require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const documentacao = require('./docs');
const { pool, iniciarBanco } = require('./db');
const carrinhoRoutes = require('./routes/carrinho');
const pedidosRoutes = require('./routes/pedidos');

const app = express();
app.use(cors());
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

const PORT = process.env.PORT || 3001;

iniciarBanco()
  .then(() => {
    app.listen(PORT, () => console.log(`Serviço de pedidos rodando na porta ${PORT}`));
  })
  .catch((erro) => {
    const motivo = erro.code === 'ECONNREFUSED'
      ? 'MySQL não está rodando ou a porta está errada'
      : erro.code === 'ER_ACCESS_DENIED_ERROR'
        ? 'usuário ou senha incorretos'
        : erro.message || erro.code;
    console.error(`Erro ao conectar no banco: ${motivo}. Confira a DATABASE_URL no arquivo .env`);
    process.exit(1);
  });
