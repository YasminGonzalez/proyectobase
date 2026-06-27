const express = require('express');
const { query, getClient } = require('../../config/db');
const { ok, created, notFound, serverError, badRequest } = require('../../utils/response');
const { authMiddleware, requirePermiso } = require('../../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/estadias
router.get('/', requirePermiso('estadias','leer'), async (req, res) => {
  try {
    const { estado = 'activa' } = req.query;
    const { rows } = await query(`
      SELECT e.*,
        json_build_object('id', hu.id, 'nombres', hu.nombres, 'apellidos', hu.apellidos, 'nro_doc', hu.nro_doc) as huespedes,
        json_build_object('id', h.id, 'numero', h.numero,
          'tipos_habitacion', json_build_object('nombre', th.nombre)) as habitaciones,
        (SELECT json_build_object('id', f.id, 'total', f.total, 'estado', f.estado)
         FROM folios f WHERE f.estadia_id=e.id LIMIT 1) as folios
      FROM estadias e
      JOIN huespedes hu ON hu.id=e.huesped_id
      JOIN habitaciones h ON h.id=e.habitacion_id
      JOIN tipos_habitacion th ON th.id=h.tipo_id
      WHERE e.estado=$1
      ORDER BY e.checkin_real DESC
    `, [estado]);
    // Wrap folios in array for frontend compatibility
    const result = rows.map(r => ({ ...r, folios: r.folios ? [r.folios] : [] }));
    return ok(res, result);
  } catch (err) { return serverError(res, err.message); }
});

// POST /api/v1/estadias/checkin
router.post('/checkin', requirePermiso('estadias','crear'), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { reserva_id, habitacion_id: hab_override, huesped_id: hue_override } = req.body;

    let huesped_id, habitacion_id, reserva;

    if (reserva_id) {
      const { rows } = await client.query(`
        SELECT r.*, h.numero, h.tipo_id FROM reservas r
        JOIN habitaciones h ON h.id=r.habitacion_id
        WHERE r.id=$1 AND r.estado='confirmada'
      `, [reserva_id]);
      if (!rows.length) throw new Error('Reserva no encontrada o no confirmada');
      reserva = rows[0];
      huesped_id = reserva.huesped_id;
      habitacion_id = reserva.habitacion_id;
    } else if (hab_override && hue_override) {
      habitacion_id = hab_override;
      huesped_id = hue_override;
    } else {
      throw new Error('Proporciona reserva_id o (habitacion_id + huesped_id)');
    }

    // Crear estadía
    const { rows: estadiaRows } = await client.query(`
      INSERT INTO estadias (reserva_id, habitacion_id, huesped_id, created_by)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [reserva_id||null, habitacion_id, huesped_id, req.user.id]);
    const estadia = estadiaRows[0];

    // Crear folio vacío
    const { rows: folioRows } = await client.query(`
      INSERT INTO folios (estadia_id, huesped_id) VALUES ($1,$2) RETURNING *
    `, [estadia.id, huesped_id]);
    const folio = folioRows[0];

    // Cargo automático de hospedaje
    const { rows: hab } = await client.query(`
      SELECT h.numero, th.precio_base, th.nombre
      FROM habitaciones h JOIN tipos_habitacion th ON th.id=h.tipo_id WHERE h.id=$1
    `, [habitacion_id]);

    if (reserva) {
      const noches = Math.ceil((new Date(reserva.fecha_checkout) - new Date(reserva.fecha_checkin)) / 86400000);
      if (noches > 0) {
        await client.query(`
          INSERT INTO cargos (folio_id, descripcion, cantidad, precio_unitario, tipo)
          VALUES ($1,$2,$3,$4,'hospedaje')
        `, [folio.id, `Hospedaje - ${hab[0]?.nombre} - ${noches} noche(s)`, noches, hab[0]?.precio_base || 0]);

        // Actualizar total folio
        await client.query(`
          UPDATE folios SET total=$1 WHERE id=$2
        `, [noches * (hab[0]?.precio_base || 0), folio.id]);
      }
    }

    // Actualizar estado reserva y habitación
    if (reserva_id) {
      await client.query(`UPDATE reservas SET estado='completada', updated_at=NOW() WHERE id=$1`, [reserva_id]);
    }
    await client.query(`UPDATE habitaciones SET estado='ocupada', updated_at=NOW() WHERE id=$1`, [habitacion_id]);

    await client.query('COMMIT');
    return created(res, { estadia, folio }, 'Check-in realizado exitosamente');
  } catch (err) {
    await client.query('ROLLBACK');
    return badRequest(res, err.message);
  } finally {
    client.release();
  }
});

// POST /api/v1/estadias/:id/checkout
router.post('/:id/checkout', requirePermiso('estadias','modificar'), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: est } = await client.query('SELECT * FROM estadias WHERE id=$1 AND estado=$2', [req.params.id, 'activa']);
    if (!est.length) throw new Error('Estadía no encontrada o ya cerrada');

    const estadia = est[0];
    await client.query(`
      UPDATE estadias SET checkout_real=NOW(), estado='cerrada', checkout_by=$1 WHERE id=$2
    `, [req.user.id, estadia.id]);

    // Cerrar folio si está abierto
    await client.query(`
      UPDATE folios SET estado='cerrado', updated_at=NOW()
      WHERE estadia_id=$1 AND estado='abierto'
    `, [estadia.id]);

    // Habitación a limpieza
    await client.query(`UPDATE habitaciones SET estado='limpieza', updated_at=NOW() WHERE id=$1`, [estadia.habitacion_id]);

    await client.query('COMMIT');
    return ok(res, null, 'Check-out realizado. Habitación en limpieza.');
  } catch (err) {
    await client.query('ROLLBACK');
    return badRequest(res, err.message);
  } finally {
    client.release();
  }
});

// GET /api/v1/estadias/:id
router.get('/:id', requirePermiso('estadias','leer'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT e.*, hu.nombres, hu.apellidos, hu.nro_doc, h.numero as habitacion_numero
      FROM estadias e
      JOIN huespedes hu ON hu.id=e.huesped_id
      JOIN habitaciones h ON h.id=e.habitacion_id
      WHERE e.id=$1
    `, [req.params.id]);
    if (!rows.length) return notFound(res);
    return ok(res, rows[0]);
  } catch (err) { return serverError(res); }
});

module.exports = router;
