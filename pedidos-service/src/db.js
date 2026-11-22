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
  connectionLimit: 5
});

async function criarBancoSeNaoExistir() {
  const url = new URL(process.env.DATABASE_URL);
  const nomeBanco = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/';
  const conexao = await mysql.createConnection({ uri: url.toString(), ssl });
  await conexao.query(`CREATE DATABASE IF NOT EXISTS \`${nomeBanco}\``);
  await conexao.end();
}

async function iniciarBanco() {
  await criarBancoSeNaoExistir();
  const sql = fs.readFileSync(path.join(__dirname, '..', 'database.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { pool, iniciarBanco };
