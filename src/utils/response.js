/**
 * Helpers de respuesta JSend estandarizada
 */

const ok = (res, data, message = 'OK') =>
  res.status(200).json({ status: 'success', message, data: data ?? null });

const created = (res, data, message = 'Creado') =>
  res.status(201).json({ status: 'success', message, data: data ?? null });

const badRequest = (res, message = 'Solicitud inválida') =>
  res.status(400).json({ status: 'error', message });

const unauthorized = (res, message = 'No autorizado') =>
  res.status(401).json({ status: 'error', message });

const forbidden = (res, message = 'Acceso denegado') =>
  res.status(403).json({ status: 'error', message });

const notFound = (res, message = 'Recurso no encontrado') =>
  res.status(404).json({ status: 'error', message });

const conflict = (res, message = 'Conflicto') =>
  res.status(409).json({ status: 'error', message });

const serverError = (res, message = 'Error interno del servidor') =>
  res.status(500).json({ status: 'error', message, code: 'INTERNAL_ERROR' });

module.exports = { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError };
