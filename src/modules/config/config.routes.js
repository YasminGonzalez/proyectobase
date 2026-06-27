const express = require('express');
const { query } = require('../../config/db');
const { ok, serverError, forbidden } = require('../../utils/response');
const { authMiddleware } = require('../../middleware/auth');

const router = express.Router();

router.get('/public', async (req, res) => {
  try {
    const { rows } = await query('SELECT clave, valor FROM hotel_config');
    const configMap = {};
    rows.forEach(r => {
      configMap[r.clave] = r.valor;
    });
    return ok(res, configMap);
  } catch (err) {
    return serverError(res, err.message);
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query('SELECT clave, valor FROM hotel_config');
    const configMap = {};
    rows.forEach(r => {
      configMap[r.clave] = r.valor;
    });
    return ok(res, configMap);
  } catch (err) {
    return serverError(res, err.message);
  }
});

router.put('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return forbidden(res, 'Solo el administrador puede configurar los datos del hotel');
    }

    const {
      contacto_direccion,
      contacto_telefono,
      contacto_email,
      horario_checkin,
      horario_checkout,
      horario_recepcion
    } = req.body;

    const updates = {
      contacto_direccion,
      contacto_telefono,
      contacto_email,
      horario_checkin,
      horario_checkout,
      horario_recepcion
    };

    for (const [clave, valor] of Object.entries(updates)) {
      if (valor !== undefined) {
        await query(`
          INSERT INTO hotel_config (clave, valor, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (clave) DO UPDATE SET valor = $2, updated_at = NOW()
        `, [clave, valor]);
      }
    }

    return ok(res, null, 'Configuración actualizada exitosamente');
  } catch (err) {
    return serverError(res, err.message);
  }
});

module.exports = router;
