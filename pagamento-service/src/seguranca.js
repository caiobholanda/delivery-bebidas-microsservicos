const cors = require('cors');

const FRONTS_PADRAO = [
  'https://delivery-bebidas-front.onrender.com',
  'https://delivery-bebidas-front-joao.onrender.com',
  'https://delivery-bebidas-front-vitor.onrender.com'
];

const LIMITE_POR_MINUTO = Number(process.env.LIMITE_POR_MINUTO) || 300;

function origensPermitidas() {
  const extras = (process.env.FRONTS_PERMITIDOS || '').split(',').map((origem) => origem.trim()).filter(Boolean);
  return [...FRONTS_PADRAO, ...extras];
}

function origemPermitida(origem, req) {
  if (!origem || origem === 'null') return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem)) return true;
  if (origem === `${req.protocol}://${req.get('host')}`) return true;
  return origensPermitidas().includes(origem);
}

const corsRestrito = cors((req, callback) => {
  callback(null, { origin: origemPermitida(req.get('origin'), req) });
});

function cabecalhosDeSeguranca(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer'
  });
  next();
}

const acessos = new Map();

function limitarRequisicoes(req, res, next) {
  const agora = Date.now();
  const registro = acessos.get(req.ip);
  if (!registro || agora - registro.inicio > 60000) {
    acessos.set(req.ip, { inicio: agora, total: 1 });
    return next();
  }
  registro.total++;
  if (registro.total > LIMITE_POR_MINUTO) {
    res.set('Retry-After', String(Math.ceil((registro.inicio + 60000 - agora) / 1000)));
    return res.status(429).json({ erro: 'Muitas requisições. Tente de novo em instantes.' });
  }
  next();
}

setInterval(() => {
  const limite = Date.now() - 60000;
  for (const [ip, registro] of acessos) {
    if (registro.inicio < limite) acessos.delete(ip);
  }
}, 60000).unref();

function aplicarSeguranca(app) {
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cabecalhosDeSeguranca);
  app.use(limitarRequisicoes);
  app.use(corsRestrito);
}

module.exports = { aplicarSeguranca, origemPermitida };
