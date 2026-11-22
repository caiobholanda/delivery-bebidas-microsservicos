require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { iniciarBanco } = require('./db');
const pagamentosRoutes = require('./routes/pagamentos');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ servico: 'pagamento', status: 'ok' });
});

app.use('/pagamentos', pagamentosRoutes);

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

app.use((erro, req, res, next) => {
  const status = erro.status >= 400 && erro.status < 600 ? erro.status : 500;
  if (status === 500) console.error(erro);
  res.status(status).json({ erro: status === 500 ? 'Erro interno no servidor' : erro.message });
});

const PORT = process.env.PORT || 3002;

iniciarBanco()
  .then(() => {
    app.listen(PORT, () => console.log(`Serviço de pagamento rodando na porta ${PORT}`));
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
