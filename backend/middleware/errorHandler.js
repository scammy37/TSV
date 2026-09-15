const config = require('../config');
const AppError = require('../utils/AppError');

const notFound = (req, res) => {
  res.status(404).json({ error: `No route matches ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars -- Express identifies this by arity.
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError || err.expected) {
    return res.status(err.statusCode || 400).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Unique violation -- surfaces as a conflict rather than a 500.
  if (err.code === '23505') {
    return res.status(409).json({ error: 'That record already exists' });
  }
  // Foreign key violation -- the client referenced something that is not there.
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }

  console.error(err);
  return res.status(500).json({
    error: 'Internal server error',
    ...(config.isProduction ? {} : { message: err.message }),
  });
};

module.exports = { notFound, errorHandler };
