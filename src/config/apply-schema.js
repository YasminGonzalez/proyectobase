/**
 * Aplica el schema SQL a PostgreSQL/Supabase
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function applySchema() {
  const client = await pool.connect();
  console.log('\n🏨 Aplicando schema a PostgreSQL...\n');

  try {
    // Leer schema
    const schemaFile = path.join(__dirname, '../../supabase/schema.sql');
    const schema = fs.readFileSync(schemaFile, 'utf8');

    // Ejecutar como una sola transacción
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');

    console.log('✅ Schema aplicado exitosamente\n');

    // Crear usuarios staff de prueba
    console.log('🌱 Creando usuarios de prueba...\n');
    const roles = await client.query('SELECT id, nombre FROM roles ORDER BY nombre');
    const rolMap = {};
    roles.rows.forEach(r => rolMap[r.nombre] = r.id);

    const users = [
      { email: 'admin@hotel.com', password: 'Admin123!', nombre: 'Admin', apellido: 'Sistema', rol: 'admin' },
      { email: 'gerente@hotel.com', password: 'Gerente123!', nombre: 'Carlos', apellido: 'García', rol: 'gerente' },
      { email: 'recepcion@hotel.com', password: 'Recep123!', nombre: 'María', apellido: 'López', rol: 'recepcionista' },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 12);
      await client.query(`
        INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE SET password_hash=$2, nombre=$3, apellido=$4, rol_id=$5
      `, [u.email, hash, u.nombre, u.apellido, rolMap[u.rol]]);
      console.log(`  ✅ Staff: ${u.email} / ${u.password}`);
    }

    // Crear cliente de prueba
    const clientHash = await bcrypt.hash('Cliente123!', 12);
    await client.query(`
      INSERT INTO clientes (email, password_hash, nombres, apellidos, tipo_doc, nro_doc, telefono)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET password_hash=$2
    `, ['cliente@test.com', clientHash, 'Juan', 'Pérez', 'DNI', '12345678', '+51999888777']);
    console.log(`  ✅ Cliente: cliente@test.com / Cliente123!\n`);

    console.log('═══════════════════════════════════════════\n');
    console.log('🎉 Base de datos lista!\n');
    console.log('📋 Credenciales Staff:');
    console.log('   admin@hotel.com     → Admin123!');
    console.log('   gerente@hotel.com   → Gerente123!');
    console.log('   recepcion@hotel.com → Recep123!\n');
    console.log('📋 Credenciales Cliente:');
    console.log('   cliente@test.com    → Cliente123!\n');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error:', err.message);
    // Si falla por objetos existentes, intentar solo el seed
    if (err.message.includes('already exists') || err.message.includes('ya existe')) {
      console.log('\n⚠️  Schema ya existe, ejecutando solo seed...\n');
      await runSeedOnly(client);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function runSeedOnly(client) {
  try {
    const roles = await client.query('SELECT id, nombre FROM roles ORDER BY nombre');
    const rolMap = {};
    roles.rows.forEach(r => rolMap[r.nombre] = r.id);

    const users = [
      { email: 'admin@hotel.com', password: 'Admin123!', nombre: 'Admin', apellido: 'Sistema', rol: 'admin' },
      { email: 'gerente@hotel.com', password: 'Gerente123!', nombre: 'Carlos', apellido: 'García', rol: 'gerente' },
      { email: 'recepcion@hotel.com', password: 'Recep123!', nombre: 'María', apellido: 'López', rol: 'recepcionista' },
    ];

    for (const u of users) {
      if (!rolMap[u.rol]) { console.log(`  ⚠️  Rol ${u.rol} no encontrado`); continue; }
      const hash = await bcrypt.hash(u.password, 12);
      await client.query(`
        INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE SET password_hash=$2
      `, [u.email, hash, u.nombre, u.apellido, rolMap[u.rol]]);
      console.log(`  ✅ ${u.email}`);
    }

    const clientHash = await bcrypt.hash('Cliente123!', 12);
    await client.query(`
      INSERT INTO clientes (email, password_hash, nombres, apellidos, tipo_doc, nro_doc)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET password_hash=$2
    `, ['cliente@test.com', clientHash, 'Juan', 'Pérez', 'DNI', '12345678']);
    console.log(`  ✅ cliente@test.com\n`);
    console.log('✅ Seed completado\n');
  } catch (e) {
    console.error('Error en seed:', e.message);
  }
}

applySchema();
