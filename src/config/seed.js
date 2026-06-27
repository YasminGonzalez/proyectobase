/**
 * Script para inicializar la base de datos local
 * Usa el cliente de Supabase para ejecutar el schema
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('./config/supabase');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Iniciando seed de base de datos...\n');

  try {
    // Verificar conexión
    const { data, error } = await supabaseAdmin.from('roles').select('count').limit(1);
    if (error && error.code === '42P01') {
      console.log('❌ Las tablas no existen. Por favor ejecuta el schema primero.');
      console.log('   Opción 1: Usa el Supabase Dashboard > SQL Editor > Pega el contenido de supabase/schema.sql');
      console.log('   Opción 2: Usa supabase CLI: supabase db push');
      process.exit(1);
    }

    // Crear usuario admin si no existe
    const hash = await bcrypt.hash('Admin123!', 12);
    
    // Obtener rol admin
    const { data: roles } = await supabaseAdmin.from('roles').select('id, nombre');
    const rolAdmin = roles?.find(r => r.nombre === 'admin');
    const rolGerente = roles?.find(r => r.nombre === 'gerente');
    const rolRecep = roles?.find(r => r.nombre === 'recepcionista');

    if (!rolAdmin) {
      console.log('❌ Roles no encontrados. Ejecuta primero el schema SQL.');
      process.exit(1);
    }

    // Crear usuarios de prueba
    const usuarios = [
      { email: 'admin@hotel.com', password_hash: hash, nombre: 'Admin', apellido: 'Sistema', rol_id: rolAdmin.id },
      { email: 'gerente@hotel.com', password_hash: await bcrypt.hash('Gerente123!', 12), nombre: 'Carlos', apellido: 'García', rol_id: rolGerente.id },
      { email: 'recepcion@hotel.com', password_hash: await bcrypt.hash('Recep123!', 12), nombre: 'María', apellido: 'López', rol_id: rolRecep.id }
    ];

    for (const u of usuarios) {
      const { error: ue } = await supabaseAdmin.from('usuarios').upsert(u, { onConflict: 'email' });
      if (ue) console.log(`  ⚠️  Error creando ${u.email}: ${ue.message}`);
      else console.log(`  ✅ Usuario: ${u.email}`);
    }

    console.log('\n✅ Seed completado exitosamente!\n');
    console.log('📋 Credenciales de acceso:');
    console.log('   Admin:         admin@hotel.com     / Admin123!');
    console.log('   Gerente:       gerente@hotel.com   / Gerente123!');
    console.log('   Recepcionista: recepcion@hotel.com / Recep123!\n');

  } catch (err) {
    console.error('❌ Error en seed:', err.message);
    process.exit(1);
  }
}

seed();
