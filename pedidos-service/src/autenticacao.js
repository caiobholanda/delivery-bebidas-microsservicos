const { erroHttp } = require('./erros');

const AUTENTICACAO_URL = (process.env.AUTENTICACAO_URL || 'https://autenticacao-service-joao.onrender.com').trim().replace(/\/+$/, '');
const VALIDADE_CACHE_MS = 5 * 60 * 1000;
const sessoesValidadas = new Map();

async function consultarAutenticacao(cabecalho) {
  try {
    return await fetch(`${AUTENTICACAO_URL}/auth/validar`, {
      headers: { Authorization: cabecalho },
      signal: AbortSignal.timeout(60000)
    });
  } catch {
    return null;
  }
}

async function usuarioDoToken(cabecalho) {
  if (!cabecalho || !cabecalho.startsWith('Bearer ') || cabecalho.length < 8) {
    throw erroHttp(401, 'Faça login para continuar');
  }

  const guardada = sessoesValidadas.get(cabecalho);
  if (guardada && guardada.expira > Date.now()) return guardada.usuario;

  let resposta = await consultarAutenticacao(cabecalho);
  if (!resposta || [502, 503, 504].includes(resposta.status)) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    resposta = await consultarAutenticacao(cabecalho);
  }

  if (!resposta) throw erroHttp(503, 'Serviço de autenticação indisponível. Tente de novo em instantes');
  if ([401, 403, 404].includes(resposta.status)) throw erroHttp(401, 'Sessão expirada. Faça login novamente');
  if (!resposta.ok) throw erroHttp(503, 'Serviço de autenticação indisponível. Tente de novo em instantes');

  const usuario = await resposta.json();
  sessoesValidadas.set(cabecalho, { usuario, expira: Date.now() + VALIDADE_CACHE_MS });
  return usuario;
}

function exigirPerfil(...perfis) {
  return async (req, res, next) => {
    req.usuario = await usuarioDoToken(req.get('authorization'));
    if (!perfis.includes(req.usuario.perfil)) {
      throw erroHttp(403, 'Seu perfil não tem acesso a esta função');
    }
    next();
  };
}

function garantirDono(req, clienteId) {
  if (req.usuario.perfil === 'administrador') return;
  if (Number(req.usuario.id) !== Number(clienteId)) {
    throw erroHttp(403, 'Você só pode acessar os seus próprios dados');
  }
}

setInterval(() => {
  const agora = Date.now();
  for (const [chave, sessao] of sessoesValidadas) {
    if (sessao.expira <= agora) sessoesValidadas.delete(chave);
  }
}, VALIDADE_CACHE_MS).unref();

module.exports = { exigirPerfil, garantirDono };
