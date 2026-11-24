const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida. Crie o arquivo .env a partir do .env.example.');
  process.exit(1);
}

const ssl = process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined;

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl,
  multipleStatements: true,
  decimalNumbers: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 300000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 30000
});

const TENTATIVAS_INICIO = 6;
const ERROS_DEFINITIVOS = ['ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ENOTFOUND'];

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function criarBancoSeNaoExistir() {
  const url = new URL(process.env.DATABASE_URL);
  const nomeBanco = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/';
  const conexao = await mysql.createConnection({ uri: url.toString(), ssl, connectTimeout: 30000 });
  await conexao.query(`CREATE DATABASE IF NOT EXISTS \`${nomeBanco}\``);
  await conexao.end();
}

async function prepararBanco() {
  await criarBancoSeNaoExistir();
  const sql = fs.readFileSync(path.join(__dirname, '..', 'database.sql'), 'utf8');
  await pool.query(sql);
}

async function iniciarBanco() {
  for (let tentativa = 1; ; tentativa++) {
    try {
      await prepararBanco();
      return;
    } catch (erro) {
      if (ERROS_DEFINITIVOS.includes(erro.code) || tentativa === TENTATIVAS_INICIO) throw erro;
      console.warn(`Banco ainda não respondeu (${erro.code || erro.message}). Tentativa ${tentativa} de ${TENTATIVAS_INICIO}, tentando de novo em ${tentativa * 5}s...`);
      await esperar(tentativa * 5000);
    }
  }
}

module.exports = { pool, iniciarBanco };
