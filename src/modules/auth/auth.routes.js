const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/db');
const { ok, unauthorized, badRequest, serverError, created, conflict } = require('../../utils/response');
const { authMiddleware, clienteAuthMiddleware } = require('../../middleware/auth');

const router = express.Router();

// ─── STAFF AUTH ─────────────────────────────────────────────

/**
 * POST /api/v1/auth/login  — Login general unificado (Staff y Clientes)
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return badRequest(res, 'Email y contraseña requeridos');

    const emailLower = email.toLowerCase().trim();

    // 1. Intentar buscar en Usuarios (Staff)
    const staffResult = await query(`
      SELECT u.id, u.email, u.password_hash, u.nombre, u.apellido, u.estado,
             r.nombre as rol
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      WHERE u.email = $1
    `, [emailLower]);

    if (staffResult.rows.length) {
      const u = staffResult.rows[0];
      if (u.estado !== 'activo') return unauthorized(res, 'Usuario staff inactivo');

      const valido = await bcrypt.compare(password, u.password_hash);
      if (!valido) return unauthorized(res, 'Credenciales inválidas');

      const token = jwt.sign(
        { userId: u.id, email: u.email, rol: u.rol, type: 'staff' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      return ok(res, {
        token,
        tipo: 'staff',
        usuario: { id: u.id, email: u.email, nombre: u.nombre, apellido: u.apellido, rol: u.rol }
      }, 'Login staff exitoso');
    }

    // 2. Intentar buscar en Clientes
    const clienteResult = await query(`
      SELECT id, email, password_hash, nombres, apellidos, estado
      FROM clientes
      WHERE email = $1
    `, [emailLower]);

    if (clienteResult.rows.length) {
      const c = clienteResult.rows[0];
      if (c.estado !== 'activo') return unauthorized(res, 'Cuenta de cliente inactiva');

      const valido = await bcrypt.compare(password, c.password_hash);
      if (!valido) return unauthorized(res, 'Credenciales inválidas');

      const token = jwt.sign(
        { clienteId: c.id, email: c.email, type: 'cliente' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_CLIENT_EXPIRES_IN || '7d' }
      );

      return ok(res, {
        token,
        tipo: 'cliente',
        usuario: { id: c.id, email: c.email, nombre: c.nombres, nombres: c.nombres, apellido: c.apellidos, apellidos: c.apellidos, rol: 'cliente' }
      }, 'Login cliente exitoso');
    }

    return unauthorized(res, 'Credenciales inválidas');
  } catch (err) {
    console.error(err);
    return serverError(res);
  }
});

/**
 * GET /api/v1/auth/me
 */
router.get('/me', authMiddleware, (req, res) => ok(res, req.user));

/**
 * POST /api/v1/auth/cambiar-password
 */
router.post('/cambiar-password', authMiddleware, async (req, res) => {
  try {
    const { password_actual, password_nuevo } = req.body;
    if (!password_actual || !password_nuevo) return badRequest(res, 'Ambos passwords requeridos');
    if (password_nuevo.length < 8) return badRequest(res, 'Mínimo 8 caracteres');

    const { rows } = await query('SELECT password_hash FROM usuarios WHERE id=$1', [req.user.id]);
    if (!await bcrypt.compare(password_actual, rows[0].password_hash))
      return unauthorized(res, 'Password actual incorrecto');

    const hash = await bcrypt.hash(password_nuevo, 12);
    await query('UPDATE usuarios SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
    return ok(res, null, 'Password actualizado');
  } catch (err) {
    return serverError(res);
  }
});

// ─── CLIENTE AUTH ─────────────────────────────────────────────

/**
 * POST /api/v1/auth/cliente/registro  — Registro de nuevo cliente
 */
router.post('/cliente/registro', async (req, res) => {
  try {
    const { email, password, nombres, apellidos, tipo_doc = 'DNI', nro_doc, telefono, nacionalidad = 'Peruana', fecha_nacimiento } = req.body;

    if (!email || !password || !nombres || !apellidos)
      return badRequest(res, 'email, password, nombres y apellidos son requeridos');
    if (password.length < 8)
      return badRequest(res, 'El password debe tener al menos 8 caracteres');

    // Verificar email único
    const existe = await query('SELECT id FROM clientes WHERE email=$1', [email.toLowerCase()]);
    if (existe.rows.length) return conflict(res, 'Este email ya está registrado');

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(`
      INSERT INTO clientes (email, password_hash, nombres, apellidos, tipo_doc, nro_doc, telefono, nacionalidad, fecha_nacimiento)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, email, nombres, apellidos, tipo_doc, nro_doc, telefono, created_at
    `, [email.toLowerCase(), hash, nombres, apellidos, tipo_doc, nro_doc || null, telefono || null, nacionalidad, fecha_nacimiento || null]);

    const cliente = rows[0];
    const token = jwt.sign(
      { clienteId: cliente.id, email: cliente.email, type: 'cliente' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_CLIENT_EXPIRES_IN || '7d' }
    );

    return created(res, { token, cliente }, '¡Cuenta creada exitosamente! Bienvenido a Hotel Luxe');
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return conflict(res, 'El correo electrónico ya está registrado.');
    }
    return serverError(res, 'Error al procesar el registro.');
  }
});

/**
 * POST /api/v1/auth/cliente/login  — Login de cliente
 */
router.post('/cliente/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return badRequest(res, 'Email y contraseña requeridos');

    const { rows } = await query(
      'SELECT id, email, password_hash, nombres, apellidos, estado FROM clientes WHERE email=$1',
      [email.toLowerCase().trim()]
    );

    if (!rows.length) return unauthorized(res, 'Credenciales inválidas');
    const c = rows[0];
    if (c.estado !== 'activo') return unauthorized(res, 'Cuenta inactiva');

    const valido = await bcrypt.compare(password, c.password_hash);
    if (!valido) return unauthorized(res, 'Credenciales inválidas');

    const token = jwt.sign(
      { clienteId: c.id, email: c.email, type: 'cliente' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_CLIENT_EXPIRES_IN || '7d' }
    );

    return ok(res, {
      token,
      cliente: { id: c.id, email: c.email, nombres: c.nombres, apellidos: c.apellidos }
    }, '¡Bienvenido!');
  } catch (err) {
    return serverError(res);
  }
});

/**
 * GET /api/v1/auth/cliente/me
 */
router.get('/cliente/me', clienteAuthMiddleware, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.id, c.email, c.nombres, c.apellidos, c.tipo_doc, c.nro_doc, c.telefono, c.nacionalidad, c.created_at,
             COUNT(r.id) as total_reservas
      FROM clientes c
      LEFT JOIN reservas r ON r.cliente_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `, [req.cliente.id]);
    return ok(res, rows[0]);
  } catch (err) {
    return serverError(res);
  }
});

/**
 * GET /api/v1/auth/cliente/mis-reservas
 */
router.get('/cliente/mis-reservas', clienteAuthMiddleware, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT r.id, r.fecha_checkin, r.fecha_checkout, r.estado, r.origen,
             r.adultos, r.ninos, r.total_estimado, r.notas, r.created_at,
             h.numero as habitacion_numero,
             th.nombre as tipo_habitacion, th.precio_base
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      JOIN tipos_habitacion th ON th.id = h.tipo_id
      WHERE r.cliente_id = $1
      ORDER BY r.created_at DESC
    `, [req.cliente.id]);
    return ok(res, rows);
  } catch (err) {
    return serverError(res);
  }
});

/**
 * PUT /api/v1/auth/cliente/perfil — Actualizar perfil de cliente
 */
router.put('/cliente/perfil', clienteAuthMiddleware, async (req, res) => {
  try {
    const { nombres, apellidos, telefono, tipo_doc, nro_doc, nacionalidad, fecha_nacimiento } = req.body;
    const { rows } = await query(`
      UPDATE clientes SET nombres=$1, apellidos=$2, telefono=$3, tipo_doc=$4, nro_doc=$5,
      nacionalidad=$6, fecha_nacimiento=$7, updated_at=NOW()
      WHERE id=$8
      RETURNING id, email, nombres, apellidos, tipo_doc, nro_doc, telefono, nacionalidad
    `, [nombres, apellidos, telefono, tipo_doc, nro_doc, nacionalidad, fecha_nacimiento || null, req.cliente.id]);
    return ok(res, rows[0], 'Perfil actualizado');
  } catch (err) {
    return serverError(res);
  }
});

module.exports = router;
