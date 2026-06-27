const express = require('express');
const { query } = require('../../config/db');
const { ok, serverError } = require('../../utils/response');
const { authMiddleware, requirePermiso } = require('../../middleware/auth');

const router = express.Router();
router.use(authMiddleware, requirePermiso('reportes','leer'));

// GET /api/v1/reportes/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [habStats, llegadas, estadias, mesStats] = await Promise.all([
      query(`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN estado='disponible' THEN 1 ELSE 0 END) as disponible,
               SUM(CASE WHEN estado='ocupada' THEN 1 ELSE 0 END) as ocupada,
               SUM(CASE WHEN estado='limpieza' THEN 1 ELSE 0 END) as limpieza,
               SUM(CASE WHEN estado='mantenimiento' THEN 1 ELSE 0 END) as mantenimiento,
               SUM(CASE WHEN estado='fuera_de_servicio' THEN 1 ELSE 0 END) as fuera_de_servicio
        FROM habitaciones
      `),
      query(`SELECT COUNT(*) as cnt FROM reservas WHERE fecha_checkin=CURRENT_DATE AND estado='confirmada'`),
      query(`SELECT COUNT(*) as cnt FROM estadias WHERE estado='activa'`),
      query(`
        SELECT COUNT(*) as reservas, COALESCE(SUM(f.total),0) as ingresos
        FROM reservas r
        LEFT JOIN estadias e ON e.reserva_id=r.id
        LEFT JOIN folios f ON f.estadia_id=e.id
        WHERE DATE_TRUNC('month', r.created_at) = DATE_TRUNC('month', NOW())
      `)
    ]);

    const h = habStats.rows[0];
    const total = parseInt(h.total);
    const ocupadas = parseInt(h.ocupada);

    return ok(res, {
      habitaciones: {
        total,
        por_estado: {
          disponible: parseInt(h.disponible), ocupada: ocupadas,
          limpieza: parseInt(h.limpieza), mantenimiento: parseInt(h.mantenimiento),
          fuera_de_servicio: parseInt(h.fuera_de_servicio)
        },
        ocupacion_porcentaje: total > 0 ? Math.round((ocupadas / total) * 100) : 0
      },
      hoy: {
        llegadas: parseInt(llegadas.rows[0].cnt),
        estancias_activas: parseInt(estadias.rows[0].cnt)
      },
      mes: {
        reservas: parseInt(mesStats.rows[0].reservas),
        ingresos: parseFloat(mesStats.rows[0].ingresos)
      }
    });
  } catch (err) { return serverError(res, err.message); }
});

// GET /api/v1/reportes/ingresos
router.get('/ingresos', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const fechaDesde = desde || new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
    const fechaHasta = hasta || new Date().toISOString().split('T')[0];

    const { rows: facturas } = await query(`
      SELECT f.*, hu.nombres, hu.apellidos, hu.email,
             json_build_object('id', hu.id, 'nombres', hu.nombres, 'apellidos', hu.apellidos) as huespedes
      FROM facturas f
      JOIN huespedes hu ON hu.id=f.huesped_id
      WHERE f.fecha_emision::date BETWEEN $1 AND $2
      ORDER BY f.fecha_emision DESC
    `, [fechaDesde, fechaHasta]);

    const { rows: resumen } = await query(`
      SELECT COUNT(*) as cantidad,
             COALESCE(SUM(total),0) as total_facturado,
             COALESCE(SUM(CASE WHEN estado='pagada' THEN total ELSE 0 END),0) as total_pagado
      FROM facturas
      WHERE fecha_emision::date BETWEEN $1 AND $2
    `, [fechaDesde, fechaHasta]);

    return ok(res, { facturas, resumen: resumen.rows[0] });
  } catch (err) { return serverError(res, err.message); }
});

// GET /api/v1/reportes/ocupacion
router.get('/ocupacion', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const fd = desde || new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
    const fh = hasta || new Date().toISOString().split('T')[0];

    const { rows } = await query(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN estado='cerrada' THEN 1 ELSE 0 END) as completadas,
             SUM(CASE WHEN estado='activa' THEN 1 ELSE 0 END) as activas,
             COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(checkout_real, NOW()) - checkin_real))/86400), 0) as promedio_dias
      FROM estadias
      WHERE checkin_real::date BETWEEN $1 AND $2
    `, [fd, fh]);

    return ok(res, rows[0]);
  } catch (err) { return serverError(res, err.message); }
});

// GET /api/v1/reportes/top-huespedes
router.get('/top-huespedes', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT hu.id, hu.nombres, hu.apellidos, hu.email, COUNT(r.id) as total_reservas
      FROM huespedes hu
      JOIN reservas r ON r.huesped_id=hu.id
      WHERE r.estado IN ('confirmada','completada')
      GROUP BY hu.id
      ORDER BY total_reservas DESC
      LIMIT 10
    `);
    return ok(res, rows);
  } catch (err) { return serverError(res, err.message); }
});

module.exports = router;
