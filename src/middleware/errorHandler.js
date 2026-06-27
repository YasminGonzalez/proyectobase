/**
 * Middleware central de manejo de errores
 */
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message || err);
  
  if (err.status) {
    return res.status(err.status).json({
      status: 'error',
      message: err.message,
      code: err.code || 'ERROR'
    });
  }

  // Error de validación Zod
  if (err.name === 'ZodError') {
    return res.status(422).json({
      status: 'error',
      message: 'Datos inválidos',
      errors: err.errors,
      code: 'VALIDATION_ERROR'
    });
  }

  return res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    code: 'INTERNAL_ERROR'
  });
};

module.exports = { errorHandler };
