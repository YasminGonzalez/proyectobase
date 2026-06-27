require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
let supabaseAdmin = null;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.warn('⚠️  Advertencia: SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY no configurados.');
  console.warn('⚠️  La funcionalidad de subir fotos a Supabase Storage estará deshabilitada hasta que se configuren.');
} else {
  try {
    // Cliente para operaciones de usuario (con JWT)
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    // Cliente con privilegios de admin (service role)
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  } catch (err) {
    console.error('❌ Error al inicializar clientes de Supabase:', err.message);
  }
}

module.exports = { supabase, supabaseAdmin };
