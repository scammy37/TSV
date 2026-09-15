const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const int = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isProduction: env === 'production',
  isTest: env === 'test',
  port: int(process.env.PORT, 5000),
  appName: process.env.APP_NAME || 'TSV - Ticket Management System',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: int(process.env.DB_PORT, 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    // Tests run against their own database so a bad test never truncates dev data.
    database: env === 'test'
      ? process.env.TEST_DB_NAME || 'tsv_test'
      : process.env.DB_NAME || 'tsv_db',
    max: int(process.env.DB_POOL_MAX, 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || (env === 'production' ? '' : 'dev-only-insecure-secret'),
    expiresIn: process.env.JWT_EXPIRE || '7d',
  },

  // Anyone can self-register as a homeowner. Registering as staff or management
  // requires this shared code, so the portal can bootstrap without a seed script.
  staffInviteCode: process.env.STAFF_INVITE_CODE || '',

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@complexmanagement.com',
  },

  bcryptRounds: int(process.env.BCRYPT_ROUNDS, env === 'test' ? 4 : 10),
};

if (config.isProduction && !config.jwt.secret) {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

module.exports = config;
