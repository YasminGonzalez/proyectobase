/**
 * Script para aplicar el schema SQL directamente via Supabase
 * Requiere DATABASE_URL o acceso directo via API
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function applySchema() {
  console.log('\n🏨 Hotel Management System — Setup de Base de Datos\n');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey || supabaseUrl.includes('127.0.0.1')) {
    console.log('⚠️  Supabase local no detectado o no configurado.\n');
    console.log('📋 INSTRUCCIONES PARA APLICAR EL SCHEMA:\n');
    console.log('Opción 1 — Supabase Dashboard (RECOMENDADO):');
    console.log('  1. Ve a https://supabase.com y crea un proyecto');
    console.log('  2. Ve a SQL Editor en el dashboard');
    console.log('  3. Copia y pega el contenido de: supabase/schema.sql');
    console.log('  4. Ejecuta el script');
    console.log('  5. Copia las credenciales del proyecto a tu .env\n');
    console.log('Opción 2 — Supabase CLI (Local):');
    console.log('  1. npm install -g supabase');
    console.log('  2. supabase start');
    console.log('  3. supabase db push\n');
    console.log('📁 Schema SQL: ./supabase/schema.sql\n');
    return;
  }

  console.log(`🔗 Conectando a: ${supabaseUrl}\n`);

  // Leer schema
  const schemaPath = path.join(__dirname, '../../supabase/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Dividir en statements
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 5 && !s.startsWith('--'));

  console.log(`📊 Ejecutando ${statements.length} statements...\n`);

  let ok = 0, err = 0;

  for (const stmt of statements) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey
        },
        body: JSON.stringify({ sql: stmt + ';' })
      });
      ok++;
    } catch (e) {
      err++;
    }
  }

  console.log(`✅ Completado: ${ok} exitosos, ${err} con error\n`);
  
  // Ejecutar seed
  console.log('🌱 Ejecutando seed de usuarios...\n');
  const { exec } = require('child_process');
  exec('node src/config/seed.js', { cwd: path.join(__dirname, '../..') }, (e, stdout, stderr) => {
    console.log(stdout);
    if (stderr) console.error(stderr);
  });
}

applySchema().catch(console.error);
