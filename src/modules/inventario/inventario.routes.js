const express = require('express');
const { query } = require('../../config/db');
const { ok, created, notFound, serverError, badRequest } = require('../../utils/response');
const { authMiddleware, requirePermiso } = require('../../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/inventario/productos
router.get('/productos', requirePermiso('inventario','leer'), async (req, res) => {
  try {
    const { categoria, activo } = req.query;
    let sql = 'SELECT * FROM productos WHERE 1=1';
    const params = [];
    if (categoria) { params.push(categoria); sql += ` AND categoria=$${params.length}`; }
    if (activo !== undefined) { params.push(activo === 'true'); sql += ` AND activo=$${params.length}`; }
    sql += ' ORDER BY categoria, nombre';
    const { rows } = await query(sql, params);
    return ok(res, rows);
  } catch (err) { return serverError(res); }
});

// GET /api/v1/inventario/alertas
router.get('/alertas', requirePermiso('inventario','leer'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT * FROM productos WHERE stock_actual <= stock_minimo AND activo=true
      ORDER BY (stock_actual - stock_minimo)
    `);
    return ok(res, rows);
  } catch (err) { return serverError(res); }
});

// GET /api/v1/inventario/movimientos
router.get('/movimientos', requirePermiso('inventario','leer'), async (req, res) => {
  try {
    const { producto_id, limit=50 } = req.query;
    let sql = `
      SELECT m.*, p.nombre as producto_nombre, u.nombre as usuario_nombre
      FROM movimientos_inventario m
      LEFT JOIN productos p ON p.id=m.producto_id
      LEFT JOIN usuarios u ON u.id=m.created_by
      WHERE 1=1
    `;
    const params = [];
    if (producto_id) { params.push(producto_id); sql += ` AND m.producto_id=$${params.length}`; }
    sql += ` ORDER BY m.created_at DESC LIMIT $${params.length+1}`;
    params.push(limit);
    const { rows } = await query(sql, params);
    return ok(res, rows);
  } catch (err) { return serverError(res); }
});

// POST /api/v1/inventario/productos
router.post('/productos', requirePermiso('inventario','crear'), async (req, res) => {
  try {
    const { nombre, categoria, precio=0, stock_actual=0, stock_minimo=0, unidad='und' } = req.body;
    if (!nombre || !categoria) return badRequest(res, 'nombre y categoria requeridos');
    const { rows } = await query(`
      INSERT INTO productos (nombre, categoria, precio, stock_actual, stock_minimo, unidad)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [nombre, categoria, precio, stock_actual, stock_minimo, unidad]);
    return created(res, rows[0]);
  } catch (err) { return serverError(res); }
});

// PUT /api/v1/inventario/productos/:id
router.put('/productos/:id', requirePermiso('inventario','modificar'), async (req, res) => {
  try {
    const { nombre, categoria, precio, stock_minimo, unidad, activo } = req.body;
    const { rows } = await query(`
      UPDATE productos SET nombre=COALESCE($1,nombre), categoria=COALESCE($2,categoria),
      precio=COALESCE($3,precio), stock_minimo=COALESCE($4,stock_minimo),
      unidad=COALESCE($5,unidad), activo=COALESCE($6,activo), updated_at=NOW()
      WHERE id=$7 RETURNING *
    `, [nombre, categoria, precio, stock_minimo, unidad, activo, req.params.id]);
    if (!rows.length) return notFound(res);
    return ok(res, rows[0]);
  } catch (err) { return serverError(res); }
});

// POST /api/v1/inventario/movimientos
router.post('/movimientos', requirePermiso('inventario','crear'), async (req, res) => {
  try {
    const { producto_id, tipo, cantidad, motivo } = req.body;
    if (!producto_id || !tipo || !cantidad) return badRequest(res, 'producto_id, tipo y cantidad requeridos');
    if (cantidad <= 0) return badRequest(res, 'cantidad debe ser mayor a 0');

    const { rows: prod } = await query('SELECT * FROM productos WHERE id=$1', [producto_id]);
    if (!prod.length) return notFound(res, 'Producto no encontrado');

    const delta = ['entrada','ajuste'].includes(tipo) ? cantidad : -cantidad;
    const nuevo_stock = prod[0].stock_actual + delta;
    if (nuevo_stock < 0) return badRequest(res, 'Stock insuficiente');

    const { rows } = await query(`
      INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, created_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [producto_id, tipo, cantidad, motivo||null, req.user.id]);

    await query('UPDATE productos SET stock_actual=$1, updated_at=NOW() WHERE id=$2', [nuevo_stock, producto_id]);
    return created(res, { ...rows[0], stock_nuevo: nuevo_stock });
  } catch (err) { return serverError(res, err.message); }
});

module.exports = router;
