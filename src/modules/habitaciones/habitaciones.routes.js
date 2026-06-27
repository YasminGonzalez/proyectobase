const express = require('express');
const multer = require('multer');
const { query } = require('../../config/db');
const { ok, created, notFound, serverError, badRequest } = require('../../utils/response');
const { authMiddleware, requirePermiso, requireRol } = require('../../middleware/auth');
const { uploadToStorage } = require('../../utils/storage');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// GET /api/v1/habitaciones — público (para disponibilidad web)
router.get('/', async (req, res) => {
  try {
    const { estado, piso, tipo_id } = req.query;
    let sql = `
      SELECT h.*, th.nombre as tipo_nombre, th.descripcion as tipo_descripcion,
             th.capacidad, th.precio_base, th.amenidades, th.imagen_url,
             json_build_object('id', th.id, 'nombre', th.nombre, 'descripcion', th.descripcion,
               'capacidad', th.capacidad, 'precio_base', th.precio_base, 'amenidades', th.amenidades
             ) as tipos_habitacion
      FROM habitaciones h
      JOIN tipos_habitacion th ON th.id = h.tipo_id
      WHERE 1=1
    `;
    const params = [];
    if (estado) { params.push(estado); sql += ` AND h.estado=$${params.length}`; }
    if (piso) { params.push(piso); sql += ` AND h.piso=$${params.length}`; }
    if (tipo_id) { params.push(tipo_id); sql += ` AND h.tipo_id=$${params.length}`; }
    sql += ' ORDER BY h.piso, h.numero';
    const { rows } = await query(sql, params);
    return ok(res, rows);
  } catch (err) { return serverError(res); }
});

// GET /api/v1/habitaciones/tipos/list — público
router.get('/tipos/list', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM tipos_habitacion ORDER BY precio_base');
    return ok(res, rows);
  } catch (err) { return serverError(res); }
});

// GET /api/v1/habitaciones/disponibles — búsqueda disponibilidad (público)
router.get('/disponibles', async (req, res) => {
  try {
    const { fecha_checkin, fecha_checkout } = req.query;
    if (!fecha_checkin || !fecha_checkout) return badRequest(res, 'Fechas requeridas');

    const { rows } = await query(`
      SELECT h.*, json_build_object('id', th.id, 'nombre', th.nombre, 'descripcion', th.descripcion,
             'capacidad', th.capacidad, 'precio_base', th.precio_base, 'amenidades', th.amenidades
             ) as tipos_habitacion
      FROM habitaciones h
      JOIN tipos_habitacion th ON th.id = h.tipo_id
      WHERE h.estado = 'disponible'
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

// GET /api/v1/habitaciones/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT h.*, json_build_object('id', th.id, 'nombre', th.nombre, 'precio_base', th.precio_base,
             'capacidad', th.capacidad, 'amenidades', th.amenidades) as tipos_habitacion
      FROM habitaciones h JOIN tipos_habitacion th ON th.id=h.tipo_id
      WHERE h.id=$1
    `, [req.params.id]);
    if (!rows.length) return notFound(res, 'Habitación no encontrada');
    return ok(res, rows[0]);
  } catch (err) { return serverError(res); }
});

// POST /api/v1/habitaciones
router.post('/', authMiddleware, requirePermiso('habitaciones','crear'), async (req, res) => {
  try {
    const { numero, piso = 1, tipo_id, descripcion } = req.body;
    if (!numero || !tipo_id) return badRequest(res, 'numero y tipo_id requeridos');
    const { rows } = await query(`
      INSERT INTO habitaciones (numero, piso, tipo_id, descripcion)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [numero, piso, tipo_id, descripcion || null]);
    return created(res, rows[0]);
  } catch (err) {
    if (err.code === '23505') return badRequest(res, 'Número de habitación ya existe');
    return serverError(res);
  }
});

// PATCH /api/v1/habitaciones/:id/estado
router.patch('/:id/estado', authMiddleware, requirePermiso('habitaciones','modificar'), async (req, res) => {
  try {
    const { estado, notas } = req.body;
    const valid = ['disponible','ocupada','limpieza','mantenimiento','fuera_de_servicio'];
    if (!valid.includes(estado)) return badRequest(res, `Estado inválido. Opciones: ${valid.join(', ')}`);
    const { rows } = await query(`
      UPDATE habitaciones SET estado=$1, notas=COALESCE($2,notas), updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [estado, notas||null, req.params.id]);
    if (!rows.length) return notFound(res, 'Habitación no encontrada');
    return ok(res, rows[0]);
  } catch (err) { return serverError(res); }
});

// POST /api/v1/habitaciones/tipos
router.post('/tipos', authMiddleware, requirePermiso('habitaciones','crear'), async (req, res) => {
  try {
    const { nombre, descripcion, capacidad = 2, precio_base, amenidades = [] } = req.body;
    if (!nombre || !precio_base) return badRequest(res, 'nombre y precio_base requeridos');
    const { rows } = await query(`
      INSERT INTO tipos_habitacion (nombre, descripcion, capacidad, precio_base, amenidades)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [nombre, descripcion||null, capacidad, precio_base, amenidades]);
    return created(res, rows[0]);
  } catch (err) {
    if (err.code === '23505') return badRequest(res, 'El tipo de habitación ya existe');
    return serverError(res);
  }
});

// PUT /api/v1/habitaciones/:id — Editar Habitación (Solo Admin)
router.put('/:id', authMiddleware, requireRol('admin'), async (req, res) => {
  try {
    const { numero, piso, tipo_id, descripcion, estado } = req.body;
    const { rows } = await query(`
      UPDATE habitaciones SET
        numero = COALESCE($1, numero),
        piso = COALESCE($2, piso),
        tipo_id = COALESCE($3, tipo_id),
        descripcion = COALESCE($4, descripcion),
        estado = COALESCE($5, estado),
        updated_at = NOW()
      WHERE id = $6 RETURNING *
    `, [
      numero !== undefined ? numero : null,
      piso !== undefined ? piso : null,
      tipo_id !== undefined ? tipo_id : null,
      descripcion !== undefined ? descripcion : null,
      estado !== undefined ? estado : null,
      req.params.id
    ]);
    if (!rows.length) return notFound(res, 'Habitación no encontrada');
    return ok(res, rows[0]);
  } catch (err) {
    if (err.code === '23505') return badRequest(res, 'Número de habitación ya existe');
    return serverError(res, err.message);
  }
});

// DELETE /api/v1/habitaciones/:id — Eliminar Habitación (Solo Admin)
router.delete('/:id', authMiddleware, requireRol('admin'), async (req, res) => {
  try {
    const { rows } = await query('DELETE FROM habitaciones WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return notFound(res, 'Habitación no encontrada');
    return ok(res, null, 'Habitación eliminada exitosamente');
  } catch (err) {
    return serverError(res, err.message);
  }
});

// PUT /api/v1/habitaciones/tipos/:id — Editar Tipo de Habitación (Solo Admin)
router.put('/tipos/:id', authMiddleware, requireRol('admin'), async (req, res) => {
  try {
    const { nombre, descripcion, capacidad, precio_base, amenidades, imagen_url } = req.body;
    const { rows } = await query(`
      UPDATE tipos_habitacion SET
        nombre = COALESCE($1, nombre),
        descripcion = COALESCE($2, descripcion),
        capacidad = COALESCE($3, capacidad),
        precio_base = COALESCE($4, precio_base),
        amenidades = COALESCE($5, amenidades),
        imagen_url = COALESCE($6, imagen_url)
      WHERE id = $7 RETURNING *
    `, [
      nombre !== undefined ? nombre : null,
      descripcion !== undefined ? descripcion : null,
      capacidad !== undefined ? capacidad : null,
      precio_base !== undefined ? precio_base : null,
      amenidades !== undefined ? amenidades : null,
      imagen_url !== undefined ? imagen_url : null,
      req.params.id
    ]);
    if (!rows.length) return notFound(res, 'Tipo de habitación no encontrado');
    return ok(res, rows[0]);
  } catch (err) {
    if (err.code === '23505') return badRequest(res, 'El tipo de habitación ya existe');
    return serverError(res, err.message);
  }
});

// DELETE /api/v1/habitaciones/tipos/:id — Eliminar Tipo de Habitación (Solo Admin)
router.delete('/tipos/:id', authMiddleware, requireRol('admin'), async (req, res) => {
  try {
    const { rows } = await query('DELETE FROM tipos_habitacion WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return notFound(res, 'Tipo de habitación no encontrado');
    return ok(res, null, 'Tipo de habitación eliminado exitosamente');
  } catch (err) {
    return serverError(res, 'No se puede eliminar porque existen habitaciones vinculadas a este tipo');
  }
});

// POST /api/v1/habitaciones/tipos/:id/imagen — Subir foto a Supabase Storage (Solo Admin)
router.post('/tipos/:id/imagen', authMiddleware, requireRol('admin'), upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) return badRequest(res, 'No se ha subido ningún archivo');

    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `room-types/${req.params.id}-${Date.now()}.${fileExtension}`;
    const fileMimeType = req.file.mimetype;

    // Subir a Storage
    const publicUrl = await uploadToStorage(req.file.buffer, fileName, fileMimeType);

    // Actualizar imagen_url en la base de datos
    const { rows } = await query(`
      UPDATE tipos_habitacion SET imagen_url = $1 WHERE id = $2 RETURNING *
    `, [publicUrl, req.params.id]);

    if (!rows.length) return notFound(res, 'Tipo de habitación no encontrado');
    return ok(res, rows[0], 'Imagen subida exitosamente');
  } catch (err) {
    console.error('Error al subir imagen:', err.message);
    return serverError(res, err.message);
  }
});

module.exports = router;
