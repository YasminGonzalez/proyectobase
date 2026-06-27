const express = require('express');
const { query } = require('../../config/db');
const { ok, created, notFound, serverError, badRequest } = require('../../utils/response');
const { authMiddleware, requirePermiso } = require('../../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/folios/:id
router.get('/:id', requirePermiso('folios','leer'), async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT f.*,
        json_build_object('id', hu.id, 'nombres', hu.nombres, 'apellidos', hu.apellidos, 'nro_doc', hu.nro_doc, 'email', hu.email) as huespedes,
        json_build_object('id', e.id, 'checkin_real', e.checkin_real, 'checkout_real', e.checkout_real,
          'habitaciones', json_build_object('numero', h.numero, 'tipos_habitacion',
            json_build_object('nombre', th.nombre))) as estadias
      FROM folios f
      JOIN huespedes hu ON hu.id=f.huesped_id
      JOIN estadias e ON e.id=f.estadia_id
      JOIN habitaciones h ON h.id=e.habitacion_id
      JOIN tipos_habitacion th ON th.id=h.tipo_id
      WHERE f.id=$1
    `, [req.params.id]);
    if (!rows.length) return notFound(res, 'Folio no encontrado');

    // Cargar cargos
    const { rows: cargos } = await query(`
      SELECT c.*, p.nombre as producto_nombre
      FROM cargos c LEFT JOIN productos p ON p.id=c.producto_id
      WHERE c.folio_id=$1 ORDER BY c.created_at
    `, [req.params.id]);

    // Cargar facturas
    const { rows: facturas } = await query('SELECT * FROM facturas WHERE folio_id=$1', [req.params.id]);

    return ok(res, { ...rows[0], cargos, facturas });
  } catch (err) { return serverError(res, err.message); }
});

// POST /api/v1/folios/:id/cargos — agregar cargo
router.post('/:id/cargos', requirePermiso('cargos','crear'), async (req, res) => {
  try {
    const { descripcion, cantidad=1, precio_unitario, tipo='consumo', producto_id, notas } = req.body;
    if (!descripcion || !precio_unitario) return badRequest(res, 'descripcion y precio_unitario requeridos');

    // Si es producto, validar stock
    if (producto_id) {
      const { rows: prod } = await query('SELECT stock_actual, nombre FROM productos WHERE id=$1', [producto_id]);
      if (!prod.length) return badRequest(res, 'Producto no encontrado');
      if (parseFloat(prod[0].stock_actual) < parseFloat(cantidad)) {
        return badRequest(res, `Stock insuficiente para ${prod[0].nombre}. Stock disponible: ${prod[0].stock_actual}`);
      }
      // Decrementar stock
      await query('UPDATE productos SET stock_actual = stock_actual - $1, updated_at=NOW() WHERE id=$2', [cantidad, producto_id]);
    }

    const { rows } = await query(`
      INSERT INTO cargos (folio_id, descripcion, cantidad, precio_unitario, tipo, producto_id, notas, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [req.params.id, descripcion, cantidad, precio_unitario, tipo, producto_id||null, notas||null, req.user.id]);

    // Actualizar total folio
    await query(`
      UPDATE folios SET total=(SELECT COALESCE(SUM(subtotal),0) FROM cargos WHERE folio_id=$1), updated_at=NOW()
      WHERE id=$1
    `, [req.params.id]);

    return created(res, rows[0]);
  } catch (err) { return serverError(res, err.message); }
});

// DELETE /api/v1/folios/:id/cargos/:cargoId
router.delete('/:id/cargos/:cargoId', requirePermiso('cargos','eliminar'), async (req, res) => {
  try {
    await query('DELETE FROM cargos WHERE id=$1 AND folio_id=$2', [req.params.cargoId, req.params.id]);
    await query(`
      UPDATE folios SET total=(SELECT COALESCE(SUM(subtotal),0) FROM cargos WHERE folio_id=$1), updated_at=NOW()
      WHERE id=$1
    `, [req.params.id]);
    return ok(res, null, 'Cargo eliminado');
  } catch (err) { return serverError(res); }
});

// POST /api/v1/folios/:id/facturar
router.post('/:id/facturar', requirePermiso('facturacion','crear'), async (req, res) => {
  try {
    const { tipo='boleta' } = req.body;
    const { rows: folio } = await query(`
      SELECT f.*, h.nombres, h.apellidos FROM folios f
      JOIN huespedes h ON h.id=f.huesped_id WHERE f.id=$1
    `, [req.params.id]);
    if (!folio.length) return notFound(res, 'Folio no encontrado');
    if (folio[0].estado === 'pagado') return badRequest(res, 'Folio ya fue facturado');

    const total = parseFloat(folio[0].total);
    const igv = parseFloat((total * 0.18 / 1.18).toFixed(2));
    const subtotal = parseFloat((total - igv).toFixed(2));

    // Número de comprobante
    const prefix = tipo === 'boleta' ? 'B001' : 'F001';
    const { rows: last } = await query(`
      SELECT COUNT(*) as cnt FROM facturas WHERE tipo=$1
    `, [tipo]);
    const num = String(parseInt(last[0].cnt) + 1).padStart(6, '0');
    const nro = `${prefix}-${num}`;

    const { rows: fact } = await query(`
      INSERT INTO facturas (folio_id, huesped_id, tipo, nro_comprobante, subtotal, igv, total, estado, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'emitida',$8) RETURNING *
    `, [req.params.id, folio[0].huesped_id, tipo, nro, subtotal, igv, total, req.user.id]);

    await query(`UPDATE folios SET estado='cerrado', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    return created(res, fact[0]);
  } catch (err) { return serverError(res, err.message); }
});

// POST /api/v1/folios/:id/pagar
router.post('/:id/pagar', requirePermiso('facturacion','modificar'), async (req, res) => {
  try {
    const { factura_id, metodo_nombre='efectivo', monto, referencia } = req.body;

    // Obtener método de pago
    let { rows: metodos } = await query('SELECT id FROM metodos_pago WHERE nombre=$1', [metodo_nombre]);
    if (!metodos.length) {
      const { rows: all } = await query('SELECT id FROM metodos_pago LIMIT 1');
      metodos = all;
    }
    const metodo_id = metodos[0]?.id;
    if (!metodo_id) return badRequest(res, 'Método de pago no encontrado');

    const { rows: fact } = await query('SELECT * FROM facturas WHERE id=$1', [factura_id]);
    if (!fact.length) return notFound(res, 'Factura no encontrada');

    await query(`
      INSERT INTO pagos (factura_id, metodo_id, monto, referencia, created_by)
      VALUES ($1,$2,$3,$4,$5)
    `, [factura_id, metodo_id, monto || fact[0].total, referencia||null, req.user.id]);

    await query(`UPDATE facturas SET estado='pagada' WHERE id=$1`, [factura_id]);
    await query(`UPDATE folios SET estado='pagado', updated_at=NOW() WHERE id=$1`, [req.params.id]);

    return ok(res, null, 'Pago registrado exitosamente');
  } catch (err) { return serverError(res, err.message); }
});

module.exports = router;
