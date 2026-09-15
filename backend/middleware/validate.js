const AppError = require('../utils/AppError');

// Validates and replaces req[source] with the coerced value, so handlers always
// see defaults applied and unknown keys stripped.
const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message.replace(/"/g, ''),
    }));
    return next(AppError.badRequest('Validation failed', details));
  }

  // req.query is a getter on Express 5 but a plain property on 4; assigning to
  // the individual keys works on both.
  if (source === 'query') {
    Object.keys(req.query).forEach((key) => delete req.query[key]);
    Object.assign(req.query, value);
  } else {
    req[source] = value;
  }
  return next();
};

module.exports = validate;
