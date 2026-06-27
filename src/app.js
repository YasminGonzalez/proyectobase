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
