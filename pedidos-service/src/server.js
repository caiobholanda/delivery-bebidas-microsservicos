require('dotenv').config();
const app = require('./app');
const { iniciarBanco } = require('./db');

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
