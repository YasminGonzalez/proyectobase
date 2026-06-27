require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { testConnection } = require('./config/db');

// Routes
const authRoutes = require('./modules/auth/auth.routes');
const usuariosRoutes = require('./modules/usuarios/usuarios.routes');
const huespedesRoutes = require('./modules/huespedes/huespedes.routes');
const habitacionesRoutes = require('./modules/habitaciones/habitaciones.routes');
const reservasRoutes = require('./modules/reservas/reservas.routes');
const estadiasRoutes = require('./modules/estadias/estadias.routes');
const foliosRoutes = require('./modules/folios/folios.routes');
const inventarioRoutes = require('./modules/inventario/inventario.routes');
const reportesRoutes = require('./modules/reportes/reportes.routes');
const webRoutes = require('./modules/web/web.routes');
const configRoutes = require('./modules/config/config.routes');

const app = express();

// ── Seguridad ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));

// ── Body parsing ───────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Static files ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── Health check ───────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'Hotel Management System',
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development'
}));

// ── Test DB page (no indexada) ─────────────────────────────
app.get('/test-db', async (req, res) => {
  // Asegurar que no sea indexada por motores de búsqueda
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  
  const start = Date.now();
  const dbStatus = {
    connected: false,
    timestamp: null,
    dbName: null,
    latency: null,
    error: null,
    counts: { usuarios: 0, habitaciones: 0, clientes: 0 }
  };

  try {
    const { query } = require('./config/db');
    const result = await query('SELECT NOW() as now, current_database() as db');
    dbStatus.timestamp = result.rows[0].now;
    dbStatus.dbName = result.rows[0].db;
    dbStatus.latency = Date.now() - start;
    dbStatus.connected = true;

    // Obtener contadores rápidos de entidades principales
    const { rows: uRes } = await query('SELECT COUNT(*) as cnt FROM usuarios');
    const { rows: hRes } = await query('SELECT COUNT(*) as cnt FROM habitaciones');
    const { rows: cRes } = await query('SELECT COUNT(*) as cnt FROM huespedes');
    dbStatus.counts.usuarios = uRes[0].cnt;
    dbStatus.counts.habitaciones = hRes[0].cnt;
    dbStatus.counts.clientes = cRes[0].cnt;
  } catch (err) {
    dbStatus.error = err.message;
    dbStatus.latency = Date.now() - start;
  }

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Prueba de Conexión a Base de Datos - Hotel Luxe</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #fbf9f8;
      --text-color: #1b1c1c;
      --card-bg: #ffffff;
      --primary: #000000;
      --secondary: #775a19;
      --success: #10b981;
      --error: #ef4444;
      --border: #eae8e7;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      width: 100%;
      max-width: 540px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
      animation: fadeIn 0.6s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      text-align: center;
    }
    .subtitle {
      font-size: 14px;
      color: #75777e;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 700;
      margin-bottom: 30px;
      text-align: center;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 24px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .status-badge.success {
      background-color: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .status-badge.error {
      background-color: #fef2f2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }
    .status-icon {
      font-size: 20px;
      margin-right: 8px;
    }
    .metrics {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-bottom: 24px;
    }
    .metric-item {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px dashed var(--border);
      font-size: 14px;
    }
    .metric-label {
      color: #44474d;
      font-weight: 500;
    }
    .metric-value {
      font-weight: 600;
      color: var(--primary);
      text-align: right;
      word-break: break-all;
    }
    .error-box {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      color: #991b1b;
      padding: 16px;
      border-radius: 6px;
      font-size: 13px;
      margin-top: 16px;
      white-space: pre-wrap;
      font-family: monospace;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 12px;
      color: #75777e;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Hotel Luxe</h1>
    <p class="subtitle">Diagnóstico de Base de Datos</p>
    
    <div class="status-badge ${dbStatus.connected ? 'success' : 'error'}">
      <span class="status-icon">${dbStatus.connected ? '🟢' : '🔴'}</span>
      ${dbStatus.connected ? 'Conexión Exitosa' : 'Conexión Fallida'}
    </div>

    <div class="metrics">
      <div class="metric-item">
        <span class="metric-label">Estado</span>
        <span class="metric-value" style="color: ${dbStatus.connected ? 'var(--success)' : 'var(--error)'}">
          ${dbStatus.connected ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
      <div class="metric-item">
        <span class="metric-label">Latencia de Consulta</span>
        <span class="metric-value">${dbStatus.latency} ms</span>
      </div>
      ${dbStatus.connected ? `
        <div class="metric-item">
          <span class="metric-label">Base de Datos (Supabase)</span>
          <span class="metric-value">${dbStatus.dbName}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Fecha/Hora Servidor DB</span>
          <span class="metric-value">${dbStatus.timestamp}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Entidades Consultadas</span>
          <span class="metric-value">
            Usuarios: ${dbStatus.counts.usuarios} | 
            Habitaciones: ${dbStatus.counts.habitaciones} | 
            Huéspedes: ${dbStatus.counts.clientes}
          </span>
        </div>
      ` : ''}
      <div class="metric-item">
        <span class="metric-label">Entorno</span>
        <span class="metric-value">${process.env.NODE_ENV || 'development'}</span>
      </div>
    </div>

    ${dbStatus.error ? `
      <div class="error-box">
        <strong>Detalle del error:</strong><br>${dbStatus.error}
      </div>
    ` : ''}

    <p class="footer">Esta página tiene directivas de no-indexación para motores de búsqueda.</p>
  </div>
</body>
</html>
  `;

  res.send(html);
});

// ── API Routes ─────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/usuarios', usuariosRoutes);
app.use('/api/v1/huespedes', huespedesRoutes);
app.use('/api/v1/habitaciones', habitacionesRoutes);
app.use('/api/v1/reservas', reservasRoutes);
app.use('/api/v1/estadias', estadiasRoutes);
app.use('/api/v1/folios', foliosRoutes);
app.use('/api/v1/inventario', inventarioRoutes);
app.use('/api/v1/reportes', reportesRoutes);
app.use('/api/v1/web', webRoutes);
app.use('/api/v1/config', configRoutes);

// ── 404 API ────────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ status: 'error', message: 'Ruta no encontrada' }));

// ── SPA fallback ───────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
});

// Verificar conexión a DB al arrancar
testConnection();

module.exports = app;
