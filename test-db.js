/**
 * Test script to verify connection to Supabase PostgreSQL
 */
const { testConnection, query } = require('./src/config/db');

async function runTest() {
  console.log('🔄 Probando conexión a la base de datos...');
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Error: No se pudo conectar.');
    return;
  }

  try {
    const res = await query('SELECT COUNT(*) as total_usuarios FROM usuarios');
    console.log(`✅ Consulta exitosa. Total usuarios en DB: ${res.rows[0].total_usuarios}`);
    
    const resHabs = await query('SELECT COUNT(*) as total_habs FROM habitaciones');
    console.log(`✅ Consulta exitosa. Total habitaciones en DB: ${resHabs.rows[0].total_habs}`);

    const resClientes = await query('SELECT COUNT(*) as total_clientes FROM clientes');
    console.log(`✅ Consulta exitosa. Total clientes en DB: ${resClientes.rows[0].total_clientes}`);
  } catch (err) {
    console.error('❌ Error ejecutando consulta:', err.message);
  }
}

runTest();
