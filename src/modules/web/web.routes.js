const express = require('express');
const { query } = require('../../config/db');
const { ok, created, notFound, serverError, badRequest, conflict } = require('../../utils/response');
const { clienteAuthMiddleware } = require('../../middleware/auth');

const router = express.Router();

// GET /api/v1/web/habitaciones/disponibles — público
router.get('/habitaciones/disponibles', async (req, res) => {
  try {
    const { fecha_checkin, fecha_checkout } = req.query;
    if (!fecha_checkin || !fecha_checkout) return badRequest(res, 'Fechas requeridas');

    const { rows } = await query(`
      SELECT h.id, h.numero, h.piso, h.estado,
             json_build_object('id', th.id, 'nombre', th.nombre, 'descripcion', th.descripcion,
               'capacidad', th.capacidad, 'precio_base', th.precio_base, 'amenidades', th.amenidades
             ) as tipos_habitacion
      FROM habitaciones h
      JOIN tipos_habitacion th ON th.id=h.tipo_id
      WHERE h.estado='disponible'
      AND h.id NOT IN (
        SELECT r.habitacion_id FROM reservas r
        WHERE r.estado IN ('confirmada','pendiente')
        AND r.fecha_checkin < $2 AND r.fecha_checkout > $1
      )
      ORDER BY th.precio_base, h.numero
    `, [fecha_checkin, fecha_checkout]);
    return ok(res, rows);
  } catch (err) { return serverError(res, err.message); }
});

// GET /api/v1/web/tipos — público: tipos de habitación para el portal
router.get('/tipos', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM tipos_habitacion ORDER BY precio_base');
    return ok(res, rows);
  } catch (err) { return serverError(res); }
});

// POST /api/v1/web/reservas — REQUIERE login de cliente
router.post('/reservas', clienteAuthMiddleware, async (req, res) => {
  try {
    const {
      habitacion_id, fecha_checkin, fecha_checkout,
      tipo_doc='DNI', nro_doc, adultos=1, ninos=0, notas
    } = req.body;

    if (!habitacion_id || !fecha_checkin || !fecha_checkout)
      return badRequest(res, 'habitacion_id y fechas son requeridos');

    // Verificar disponibilidad
    const { rows: conflicto } = await query(`
      SELECT id FROM reservas WHERE habitacion_id=$1
      AND estado IN ('confirmada','pendiente')
      AND fecha_checkin < $3 AND fecha_checkout > $2
    `, [habitacion_id, fecha_checkin, fecha_checkout]);
    if (conflicto.length) return conflict(res, 'Habitación no disponible en esas fechas');

    // Obtener / crear huésped desde los datos del cliente
    const cliente = req.cliente;
    let huesped_id;

    // Buscar si ya existe huésped vinculado a este cliente
    const { rows: huespedExistente } = await query(
      'SELECT id FROM huespedes WHERE cliente_id=$1 LIMIT 1', [cliente.id]
    );

    if (huespedExistente.length) {
      huesped_id = huespedExistente[0].id;
    } else {
      // Crear huésped desde datos del cliente
      const { rows: clienteData } = await query(
        'SELECT * FROM clientes WHERE id=$1', [cliente.id]
      );
      const c = clienteData[0];
      const { rows: nuevo } = await query(`
        INSERT INTO huespedes (cliente_id, tipo_doc, nro_doc, nombres, apellidos, email, telefono, nacionalidad)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (tipo_doc, nro_doc) DO UPDATE SET cliente_id=$1, updated_at=NOW()
        RETURNING id
      `, [cliente.id, c.tipo_doc || tipo_doc, c.nro_doc || nro_doc || 'N/A',
          c.nombres, c.apellidos, c.email, c.telefono, c.nacionalidad || 'Peruana']);
      huesped_id = nuevo[0].id;
    }

    // Calcular total
    const { rows: hab } = await query(`
      SELECT h.numero, th.precio_base, th.nombre
      FROM habitaciones h JOIN tipos_habitacion th ON th.id=h.tipo_id WHERE h.id=$1
    `, [habitacion_id]);
    if (!hab.length) return notFound(res, 'Habitación no encontrada');

    const noches = Math.ceil((new Date(fecha_checkout) - new Date(fecha_checkin)) / 86400000);
    if (noches <= 0) return badRequest(res, 'Las fechas son inválidas');
    const total = parseFloat(hab[0].precio_base) * noches;

    // Crear reserva
    const { rows } = await query(`
      INSERT INTO reservas (huesped_id, cliente_id, habitacion_id, fecha_checkin, fecha_checkout,
        adultos, ninos, total_estimado, notas, origen, estado)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'web','confirmada')
      RETURNING *
    `, [huesped_id, cliente.id, habitacion_id, fecha_checkin, fecha_checkout,
        adultos, ninos, total, notas||null]);

    const reserva = rows[0];

    // Retornar con datos de habitación
    const { rows: full } = await query(`
      SELECT r.*, json_build_object('numero', h.numero, 'tipos_habitacion',
        json_build_object('nombre', th.nombre, 'precio_base', th.precio_base)) as habitaciones
      FROM reservas r JOIN habitaciones h ON h.id=r.habitacion_id
      JOIN tipos_habitacion th ON th.id=h.tipo_id WHERE r.id=$1
    `, [reserva.id]);

    return created(res, full[0], `¡Reserva confirmada! Hab. ${hab[0].numero} — ${noches} noche(s) — Total: S/ ${total.toFixed(2)}`);
  } catch (err) {
    return serverError(res, err.message);
  }
});

// GET /api/v1/web/mis-reservas — Reservas del cliente autenticado
router.get('/mis-reservas', clienteAuthMiddleware, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT r.id, r.fecha_checkin, r.fecha_checkout, r.estado, r.origen,
             r.adultos, r.ninos, r.total_estimado, r.notas, r.created_at,
             h.numero as habitacion_numero,
             th.nombre as tipo_habitacion, th.precio_base
      FROM reservas r
      JOIN habitaciones h ON h.id=r.habitacion_id
      JOIN tipos_habitacion th ON th.id=h.tipo_id
      WHERE r.cliente_id=$1
      ORDER BY r.created_at DESC
    `, [req.cliente.id]);
    return ok(res, rows);
  } catch (err) { return serverError(res, err.message); }
});

module.exports = router;
