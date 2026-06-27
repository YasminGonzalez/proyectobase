/**
 * Pool de conexiones PostgreSQL (Supabase directo via pg)
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('❌ Error en pool de PostgreSQL:', err.message);
});

/**
 * Ejecutar query con parámetros
 */
const query = (text, params) => pool.query(text, params);

/**
 * Obtener cliente del pool (para transacciones)
 */
const getClient = () => pool.connect();

/**
 * Verificar conexión
 */
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW() as now, current_database() as db');
    console.log(`✅ PostgreSQL conectado: ${result.rows[0].db} @ ${result.rows[0].now}`);
    return true;
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
    return false;
  }
};

module.exports = { pool, query, getClient, testConnection };
