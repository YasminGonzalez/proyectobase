const express = require('express');
const { query } = require('../../config/db');
const { ok, created, notFound, serverError, badRequest } = require('../../utils/response');
const { authMiddleware, requirePermiso } = require('../../middleware/auth');

const router = express.Router();

// GET /api/v1/huespedes — requiere auth staff
router.get('/', authMiddleware, requirePermiso('huespedes','leer'), async (req, res) => {
  try {
    const { limit = 100, offset = 0, q } = req.query;
    let sql = `
      SELECT h.*, c.email as cliente_email
      FROM huespedes h
      LEFT JOIN clientes c ON c.id = h.cliente_id
      WHERE 1=1
    `;
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (h.nombres ILIKE $${params.length} OR h.apellidos ILIKE $${params.length} OR h.nro_doc ILIKE $${params.length} OR h.email ILIKE $${params.length})`;
    }
    sql += ` ORDER BY h.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(limit, offset);
    const { rows } = await query(sql, params);
    return ok(res, rows);
  } catch (err) { return serverError(res); }
});

// GET /api/v1/huespedes/buscar/doc
router.get('/buscar/doc', authMiddleware, async (req, res) => {
  try {
    const { nro_doc } = req.query;
    if (!nro_doc) return badRequest(res, 'nro_doc requerido');
    
    // 1. Buscar en Huéspedes
    const { rows } = await query('SELECT * FROM huespedes WHERE nro_doc=$1 LIMIT 1', [nro_doc]);
    if (rows.length) {
      return ok(res, rows[0]);
    }
    
    // 2. Fallback: Buscar en Clientes registrados
    const { rows: clienteRows } = await query(
      'SELECT id as cliente_id, nombres, apellidos, tipo_doc, nro_doc, email, telefono, nacionalidad FROM clientes WHERE nro_doc=$1 LIMIT 1',
      [nro_doc]
    );
    if (clienteRows.length) {
      return ok(res, {
        id: null,
        cliente_id: clienteRows[0].cliente_id,
        nombres: clienteRows[0].nombres,
        apellidos: clienteRows[0].apellidos,
        tipo_doc: clienteRows[0].tipo_doc,
        nro_doc: clienteRows[0].nro_doc,
        email: clienteRows[0].email,
        telefono: clienteRows[0].telefono,
        nacionalidad: clienteRows[0].nacionalidad
      });
    }

    return notFound(res, 'Huésped o Cliente no encontrado');
  } catch (err) { return serverError(res); }
});

// GET /api/v1/huespedes/:id
router.get('/:id', authMiddleware, requirePermiso('huespedes','leer'), async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM huespedes WHERE id=$1', [req.params.id]);
    if (!rows.length) return notFound(res, 'Huésped no encontrado');
    // Historial de reservas
    const { rows: reservas } = await query(`
      SELECT r.id, r.fecha_checkin, r.fecha_checkout, r.estado, r.total_estimado,
             h.numero as habitacion_numero, th.nombre as tipo_habitacion
      FROM reservas r
      JOIN habitaciones h ON h.id=r.habitacion_id
      JOIN tipos_habitacion th ON th.id=h.tipo_id
      WHERE r.huesped_id=$1 ORDER BY r.created_at DESC
    `, [req.params.id]);
    return ok(res, { ...rows[0], historial: reservas });
  } catch (err) { return serverError(res); }
});

// POST /api/v1/huespedes
router.post('/', authMiddleware, requirePermiso('huespedes','crear'), async (req, res) => {
  try {
    const { tipo_doc='DNI', nro_doc, nombres, apellidos, email, telefono, nacionalidad='Peruana', fecha_nacimiento, preferencias, notas, cliente_id } = req.body;
    if (!nro_doc || !nombres || !apellidos) return badRequest(res, 'nro_doc, nombres y apellidos requeridos');
    const { rows } = await query(`
      INSERT INTO huespedes (tipo_doc, nro_doc, nombres, apellidos, email, telefono, nacionalidad, fecha_nacimiento, preferencias, notas, cliente_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (tipo_doc, nro_doc) DO UPDATE
      SET nombres=$3, apellidos=$4, email=COALESCE($5,huespedes.email), telefono=COALESCE($6,huespedes.telefono), cliente_id=COALESCE($11,huespedes.cliente_id), updated_at=NOW()
      RETURNING *
    `, [tipo_doc, nro_doc, nombres, apellidos, email||null, telefono||null, nacionalidad, fecha_nacimiento||null, preferencias||null, notas||null, cliente_id||null]);
    return created(res, rows[0]);
  } catch (err) {
    if (err.code === '23505') return badRequest(res, 'El número de documento ya existe');
    return serverError(res, err.message);
  }
});

// PUT /api/v1/huespedes/:id
router.put('/:id', authMiddleware, requirePermiso('huespedes','modificar'), async (req, res) => {
  try {
    const { tipo_doc, nro_doc, nombres, apellidos, email, telefono, nacionalidad, fecha_nacimiento, preferencias, notas } = req.body;
    const { rows } = await query(`
      UPDATE huespedes SET tipo_doc=COALESCE($1,tipo_doc), nro_doc=COALESCE($2,nro_doc),
      nombres=COALESCE($3,nombres), apellidos=COALESCE($4,apellidos),
      email=COALESCE($5,email), telefono=COALESCE($6,telefono),
      nacionalidad=COALESCE($7,nacionalidad), fecha_nacimiento=COALESCE($8,fecha_nacimiento),
      preferencias=COALESCE($9,preferencias), notas=COALESCE($10,notas), updated_at=NOW()
      WHERE id=$11 RETURNING *
    `, [tipo_doc, nro_doc, nombres, apellidos, email, telefono, nacionalidad, fecha_nacimiento||null, preferencias, notas, req.params.id]);
    if (!rows.length) return notFound(res, 'Huésped no encontrado');
    return ok(res, rows[0]);
  } catch (err) { return serverError(res); }
});

module.exports = router;
