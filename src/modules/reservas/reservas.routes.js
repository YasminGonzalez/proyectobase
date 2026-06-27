const express = require('express');
const { query, getClient } = require('../../config/db');
const { ok, created, notFound, serverError, badRequest, conflict } = require('../../utils/response');
const { authMiddleware, clienteAuthMiddleware, requirePermiso } = require('../../middleware/auth');

const router = express.Router();

// GET /api/v1/reservas — staff
router.get('/', authMiddleware, requirePermiso('reservas','leer'), async (req, res) => {
  try {
    const { estado, limit = 100, offset = 0 } = req.query;
    let sql = `
      SELECT r.*,
        json_build_object('id', hu.id, 'nombres', hu.nombres, 'apellidos', hu.apellidos,
          'nro_doc', hu.nro_doc, 'telefono', hu.telefono, 'email', hu.email) as huespedes,
        json_build_object('id', h.id, 'numero', h.numero, 'piso', h.piso,
          'tipos_habitacion', json_build_object('nombre', th.nombre, 'precio_base', th.precio_base)
        ) as habitaciones
      FROM reservas r
      JOIN huespedes hu ON hu.id = r.huesped_id
      JOIN habitaciones h ON h.id = r.habitacion_id
      JOIN tipos_habitacion th ON th.id = h.tipo_id
      WHERE 1=1
    `;
    const params = [];
    if (estado) { params.push(estado); sql += ` AND r.estado=$${params.length}`; }
    sql += ` ORDER BY r.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(limit, offset);
    const { rows } = await query(sql, params);
    return ok(res, rows);
  } catch (err) { return serverError(res, err.message); }
});

// GET /api/v1/reservas/hoy/llegadas
router.get('/hoy/llegadas', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT r.*,
        json_build_object('id', hu.id, 'nombres', hu.nombres, 'apellidos', hu.apellidos,
          'nro_doc', hu.nro_doc, 'telefono', hu.telefono) as huespedes,
        json_build_object('id', h.id, 'numero', h.numero,
          'tipos_habitacion', json_build_object('nombre', th.nombre)) as habitaciones
      FROM reservas r
      JOIN huespedes hu ON hu.id=r.huesped_id
      JOIN habitaciones h ON h.id=r.habitacion_id
      JOIN tipos_habitacion th ON th.id=h.tipo_id
      WHERE r.fecha_checkin = CURRENT_DATE
      AND r.estado = 'confirmada'
      ORDER BY h.numero
    `);
    return ok(res, rows);
  } catch (err) { return serverError(res); }
});

// GET /api/v1/reservas/:id
router.get('/:id', authMiddleware, requirePermiso('reservas','leer'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT r.*,
        json_build_object('id', hu.id, 'nombres', hu.nombres, 'apellidos', hu.apellidos, 'nro_doc', hu.nro_doc) as huespedes,
        json_build_object('id', h.id, 'numero', h.numero, 'tipos_habitacion',
          json_build_object('nombre', th.nombre, 'precio_base', th.precio_base)) as habitaciones
      FROM reservas r
      JOIN huespedes hu ON hu.id=r.huesped_id
      JOIN habitaciones h ON h.id=r.habitacion_id
      JOIN tipos_habitacion th ON th.id=h.tipo_id
      WHERE r.id=$1
    `, [req.params.id]);
    if (!rows.length) return notFound(res);
    return ok(res, rows[0]);
  } catch (err) { return serverError(res); }
});

// POST /api/v1/reservas — staff
router.post('/', authMiddleware, requirePermiso('reservas','crear'), async (req, res) => {
  try {
    const { huesped_id, habitacion_id, fecha_checkin, fecha_checkout, adultos=1, ninos=0, notas, origen='mostrador' } = req.body;
    if (!huesped_id || !habitacion_id || !fecha_checkin || !fecha_checkout)
      return badRequest(res, 'Campos requeridos: huesped_id, habitacion_id, fechas');

    // Verificar disponibilidad
    const { rows: conflicto } = await query(`
      SELECT id FROM reservas WHERE habitacion_id=$1 AND estado IN ('confirmada','pendiente')
      AND fecha_checkin < $3 AND fecha_checkout > $2
    `, [habitacion_id, fecha_checkin, fecha_checkout]);
    if (conflicto.length) return conflict(res, 'Habitación no disponible en esas fechas');

    // Calcular total
    const { rows: hab } = await query('SELECT th.precio_base FROM habitaciones h JOIN tipos_habitacion th ON th.id=h.tipo_id WHERE h.id=$1', [habitacion_id]);
    const noches = Math.ceil((new Date(fecha_checkout) - new Date(fecha_checkin)) / 86400000);
    const total = hab[0]?.precio_base * noches || 0;

    const { rows } = await query(`
      INSERT INTO reservas (huesped_id, habitacion_id, fecha_checkin, fecha_checkout, adultos, ninos, total_estimado, notas, origen, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [huesped_id, habitacion_id, fecha_checkin, fecha_checkout, adultos, ninos, total, notas||null, origen, req.user.id]);

    // Retornar con info de habitación
    const { rows: full } = await query(`
      SELECT r.*,
        json_build_object('id', h.id, 'numero', h.numero, 'tipos_habitacion',
          json_build_object('nombre', th.nombre)) as habitaciones
      FROM reservas r JOIN habitaciones h ON h.id=r.habitacion_id
      JOIN tipos_habitacion th ON th.id=h.tipo_id WHERE r.id=$1
    `, [rows[0].id]);
    return created(res, full[0]);
  } catch (err) { return serverError(res, err.message); }
});

// PATCH /api/v1/reservas/:id/cancelar
router.patch('/:id/cancelar', authMiddleware, requirePermiso('reservas','modificar'), async (req, res) => {
  try {
    const { motivo_cancelacion } = req.body;
    const { rows } = await query(`
      UPDATE reservas SET estado='cancelada', motivo_cancelacion=$1, updated_at=NOW()
      WHERE id=$2 AND estado IN ('confirmada','pendiente')
      RETURNING *
    `, [motivo_cancelacion||null, req.params.id]);
    if (!rows.length) return notFound(res, 'Reserva no encontrada o ya procesada');
    return ok(res, rows[0], 'Reserva cancelada');
  } catch (err) { return serverError(res); }
});

// PATCH /api/v1/reservas/:id/estado
router.patch('/:id/estado', authMiddleware, requirePermiso('reservas','modificar'), async (req, res) => {
  try {
    const { estado } = req.body;
    const { rows } = await query(`
      UPDATE reservas SET estado=$1, updated_at=NOW() WHERE id=$2 RETURNING *
    `, [estado, req.params.id]);
    if (!rows.length) return notFound(res);
    return ok(res, rows[0]);
  } catch (err) { return serverError(res); }
});

// ─── CLIENTE: cancelar su propia reserva
router.patch('/:id/cliente/cancelar', clienteAuthMiddleware, async (req, res) => {
  try {
    const { rows: reserva } = await query('SELECT * FROM reservas WHERE id=$1', [req.params.id]);
    if (!reserva.length) return notFound(res);
    if (reserva[0].cliente_id !== req.cliente.id) return serverError(res, 'No autorizado');
    if (!['confirmada','pendiente'].includes(reserva[0].estado))
      return badRequest(res, 'No se puede cancelar esta reserva');

    const { rows } = await query(`
      UPDATE reservas SET estado='cancelada', motivo_cancelacion='Cancelada por el cliente', updated_at=NOW()
      WHERE id=$1 RETURNING *
    `, [req.params.id]);
    return ok(res, rows[0], 'Reserva cancelada');
  } catch (err) { return serverError(res); }
});

module.exports = router;
