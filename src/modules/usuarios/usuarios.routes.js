const express = require('express');
const { query } = require('../../config/db');
const { ok, created, notFound, serverError, badRequest } = require('../../utils/response');
const { authMiddleware, requirePermiso } = require('../../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/usuarios
router.get('/', requirePermiso('usuarios','leer'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT u.id, u.email, u.nombre, u.apellido, u.estado, u.created_at,
             r.id as rol_id, r.nombre as rol_nombre
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      ORDER BY u.created_at DESC
    `);
    const data = rows.map(u => ({ ...u, roles: { id: u.rol_id, nombre: u.rol_nombre } }));
    return ok(res, data);
  } catch (err) { return serverError(res); }
});

// GET /api/v1/usuarios/roles/list
router.get('/roles/list', async (req, res) => {
  try {
    const { rows } = await query('SELECT id, nombre, descripcion FROM roles ORDER BY nombre');
    return ok(res, rows);
  } catch (err) { return serverError(res); }
});

// POST /api/v1/usuarios
const bcrypt = require('bcryptjs');
router.post('/', requirePermiso('usuarios','crear'), async (req, res) => {
  try {
    const { email, password, nombre, apellido, rol_id } = req.body;
    if (!email || !password || !nombre || !apellido || !rol_id)
      return badRequest(res, 'Todos los campos son requeridos');

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(`
      INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING id, email, nombre, apellido, estado, created_at
    `, [email.toLowerCase(), hash, nombre, apellido, rol_id]);
    return created(res, rows[0]);
  } catch (err) {
    if (err.code === '23505') return badRequest(res, 'El email ya existe');
    return serverError(res);
  }
});

// PUT /api/v1/usuarios/:id
router.put('/:id', requirePermiso('usuarios','modificar'), async (req, res) => {
  try {
    const { nombre, apellido, rol_id, estado } = req.body;
    const { rows } = await query(`
      UPDATE usuarios SET nombre=COALESCE($1,nombre), apellido=COALESCE($2,apellido),
      rol_id=COALESCE($3,rol_id), estado=COALESCE($4,estado), updated_at=NOW()
      WHERE id=$5 RETURNING id, email, nombre, apellido, estado
    `, [nombre, apellido, rol_id, estado, req.params.id]);
    if (!rows.length) return notFound(res, 'Usuario no encontrado');
    return ok(res, rows[0]);
  } catch (err) { return serverError(res); }
});

module.exports = router;
