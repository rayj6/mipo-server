const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;

async function getPool(useDatabase = true) {
  if (pool) return pool;
  const dbConfig = { ...config.db };
  if (!useDatabase) delete dbConfig.database;
  pool = mysql.createPool(dbConfig);
  return pool;
}

async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

/** For INSERT/UPDATE: returns ResultSetHeader with insertId, etc. */
async function execute(sql, params = []) {
  const p = await getPool();
  const [result] = await p.execute(sql, params);
  return result;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, queryOne, execute, close };
