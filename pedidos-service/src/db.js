const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  multipleStatements: true,
  decimalNumbers: true,
  connectionLimit: 5
});

async function iniciarBanco() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'database.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { pool, iniciarBanco };
