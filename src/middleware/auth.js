const jwt = require('jsonwebtoken');
const { unauthorized, forbidden, serverError } = require('../utils/response');
const { query } = require('../config/db');

/**
 * Middleware JWT para STAFF (usuarios internos)
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return unauthorized(res, 'Token requerido');

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return unauthorized(res, err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido');
    }

    if (decoded.type !== 'staff') return unauthorized(res, 'Token de tipo incorrecto');

    // Cargar usuario con permisos
    const result = await query(`
      SELECT u.id, u.email, u.nombre, u.apellido, u.estado,
             r.id as rol_id, r.nombre as rol_nombre,
             COALESCE(
               json_agg(json_build_object('modulo', p.modulo, 'accion', p.accion)) 
               FILTER (WHERE p.id IS NOT NULL), '[]'
             ) as permisos
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      LEFT JOIN rol_permiso rp ON rp.rol_id = r.id
      LEFT JOIN permisos p ON p.id = rp.permiso_id
      WHERE u.id = $1
      GROUP BY u.id, r.id
    `, [decoded.userId]);

    if (!result.rows.length) return unauthorized(res, 'Usuario no encontrado');
    const usuario = result.rows[0];
    if (usuario.estado !== 'activo') return unauthorized(res, 'Usuario inactivo');

    req.user = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol_nombre,
      permisos: usuario.permisos || [],
      type: 'staff'
    };
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError' || err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token inválido o expirado');
    }
    return serverError(res, 'Error de conexión o autenticación interna');
  }
};

/**
 * Middleware JWT para CLIENTES (portal web)
 */
const clienteAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return unauthorized(res, 'Token requerido');

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return unauthorized(res, err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido');
    }

    if (decoded.type !== 'cliente') return unauthorized(res, 'Token de tipo incorrecto');

    const result = await query(
      'SELECT id, email, nombres, apellidos, estado FROM clientes WHERE id = $1',
      [decoded.clienteId]
    );

    if (!result.rows.length) return unauthorized(res, 'Cliente no encontrado');
    const cliente = result.rows[0];
    if (cliente.estado !== 'activo') return unauthorized(res, 'Cuenta inactiva');

    req.cliente = { ...cliente, type: 'cliente' };
    next();
  } catch (err) {
    console.error('Cliente Auth error:', err.message);
    if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError' || err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Token de cliente inválido o expirado');
    }
    return serverError(res, 'Error de conexión o autenticación de cliente interna');
  }
};

/**
 * Verificar permiso RBAC (para staff)
 */
const requirePermiso = (modulo, accion) => (req, res, next) => {
  if (!req.user) return unauthorized(res);
  if (req.user.rol === 'admin') return next();
  const tiene = req.user.permisos.some(p => p.modulo === modulo && p.accion === accion);
  if (!tiene) return forbidden(res, `Sin permiso: ${accion} en ${modulo}`);
  next();
};

/**
 * Verificar rol específico
 */
const requireRol = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res);
  if (!roles.includes(req.user.rol)) return forbidden(res, 'Rol insuficiente');
  next();
};

module.exports = { authMiddleware, clienteAuthMiddleware, requirePermiso, requireRol };
