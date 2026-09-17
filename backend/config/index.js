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
  // Emailed links (password reset above all) have to point at the real
  // deployment, and the public URL is not known until the host has assigned
  // one. Render exports it as RENDER_EXTERNAL_URL, so the common case needs no
  // configuration; FRONTEND_URL still wins where it is set, and is required on
  // a host that exports nothing.
  frontendUrl: process.env.FRONTEND_URL
    || process.env.RENDER_EXTERNAL_URL
    || 'http://localhost:3000',

  // Managed hosts (Replit, Render, Railway, Fly, Heroku) hand over one
  // DATABASE_URL; local development uses the discrete variables. Tests always
  // use their own database, so a stray DATABASE_URL in the environment cannot
  // point the suite at something real.
  db: env === 'test' || !process.env.DATABASE_URL
    ? {
      host: process.env.DB_HOST || 'localhost',
      port: int(process.env.DB_PORT, 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: env === 'test'
        ? process.env.TEST_DB_NAME || 'tsv_test'
        : process.env.DB_NAME || 'tsv_db',
      max: int(process.env.DB_POOL_MAX, 10),
    }
    : {
      connectionString: process.env.DATABASE_URL,
      // Managed Postgres terminates TLS with its own CA, which is not in the
      // Node trust store. Set DB_SSL=disable for a provider that does not use
      // TLS at all (a private network link, say).
      ssl: process.env.DB_SSL === 'disable' ? false : { rejectUnauthorized: false },
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

  // When true the API also serves frontend/build, so the whole app runs on one
  // origin and needs no CORS configuration. Used by the devcontainer and by
  // single-service deployments.
  serveFrontend: process.env.SERVE_FRONTEND === 'true',
};

// Production must not inherit any of the conveniences that make local
// development easy. Each of these would be a real vulnerability if it shipped.
if (config.isProduction) {
  const problems = [];

  if (!config.jwt.secret) {
    problems.push('JWT_SECRET must be set');
  } else if (config.jwt.secret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters');
  } else if (/^(dev|test|change|secret|password)/i.test(config.jwt.secret)) {
    problems.push('JWT_SECRET looks like a placeholder; generate a random one');
  }

  if (!process.env.DATABASE_URL && !process.env.DB_PASSWORD) {
    problems.push('Set DATABASE_URL, or DB_PASSWORD for a discrete connection');
  }

  // A guessable invite code lets anyone grant themselves management access.
  if (config.staffInviteCode && /^(demo|test|change_me|invite)/i.test(config.staffInviteCode)) {
    problems.push('STAFF_INVITE_CODE is a placeholder; set a strong value or leave it blank');
  }

  if (problems.length) {
    throw new Error(`Refusing to start in production:\n  - ${problems.join('\n  - ')}`);
  }
}

module.exports = config;
