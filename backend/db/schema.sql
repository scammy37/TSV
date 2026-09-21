-- =============================================================================
-- TSV - Ticket System for Property Management
-- PostgreSQL schema. Safe to run repeatedly; every object is created IF NOT
-- EXISTS so `npm run migrate` is idempotent.
-- =============================================================================

-- Keeps updated_at honest without every query having to remember it.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'homeowner'
                  CHECK (role IN ('homeowner', 'staff', 'management')),
  unit_number   VARCHAR(50),
  phone         VARCHAR(30),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role) WHERE is_active;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- categories -- service categories a homeowner can file under
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  slug        VARCHAR(50) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 100
);

-- The inactive rows are categories the association no longer takes requests
-- under: those are the homeowner's own repairs, not common property. They are
-- seeded rather than left out so a ticket filed under one before the change
-- keeps a category to point at, and so bringing one back is a flag rather than
-- a migration. Only is_active rows reach the dropdowns; see GET /api/meta.
INSERT INTO categories (slug, name, description, sort_order, is_active) VALUES
  ('plumbing',      'Plumbing',         'Leaks, clogs, water pressure, fixtures',       10, false),
  ('electrical',    'Electrical',       'Outlets, lighting, breakers, wiring',          20, false),
  ('hvac',          'Heating & Cooling','Furnace, A/C, thermostat, ventilation',        30, false),
  ('appliance',     'Appliance',        'Refrigerator, oven, dishwasher, laundry',      40, false),
  ('structural',    'Structural',       'Doors, windows, walls, flooring, roofing',     50, false),
  ('pest_control',  'Pest Control',     'Insects, rodents, other pests',                60, false),
  ('landscaping',   'Landscaping',      'Lawn, trees, irrigation, snow removal',        70, true),
  ('common_area',   'Common Area',      'Hallways, gym, pool, parking, elevators',      80, true),
  ('security',      'Security',         'Locks, gates, cameras, access control',        90, true),
  ('noise',         'Noise Complaint',  'Disturbances and noise issues',               100, false),
  ('violation',     'Rules Violation',  'Parking, pets, trash, unapproved changes',    110, true),
  ('other',         'Other',            'Anything that does not fit another category', 999, true)
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- tickets
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1000;

CREATE TABLE IF NOT EXISTS tickets (
  id               SERIAL PRIMARY KEY,
  ticket_number    VARCHAR(50) UNIQUE NOT NULL,
  homeowner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_by       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category         VARCHAR(50) NOT NULL REFERENCES categories(slug),
  priority         VARCHAR(20) NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('low', 'medium', 'high')),
  status           VARCHAR(20) NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'in_progress', 'on_hold',
                                       'closed', 'cancelled')),
  title            VARCHAR(255) NOT NULL,
  description      TEXT NOT NULL,
  location_details TEXT,
  unit_number      VARCHAR(50),
  first_response_at TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_homeowner  ON tickets (homeowner_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned   ON tickets (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status     ON tickets (status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority   ON tickets (priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category   ON tickets (category);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets (created_at DESC);
-- Open tickets oldest-first is the hot query on the management dashboard.
CREATE INDEX IF NOT EXISTS idx_tickets_open_age ON tickets (created_at)
  WHERE status NOT IN ('closed', 'cancelled');

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON tickets;
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- ticket_comments -- the homeowner/management conversation. is_internal keeps
-- staff-only notes off the homeowner's view.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_comments (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  comment     TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_ticket ON ticket_comments (ticket_id, created_at);

DROP TRIGGER IF EXISTS trg_comments_updated_at ON ticket_comments;
CREATE TRIGGER trg_comments_updated_at BEFORE UPDATE ON ticket_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- ticket_activity -- append-only audit trail
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_activity (
  id         SERIAL PRIMARY KEY,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(50) NOT NULL,
  field      VARCHAR(50),
  old_value  TEXT,
  new_value  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_ticket ON ticket_activity (ticket_id, created_at);

-- -----------------------------------------------------------------------------
-- email_logs -- every notification attempt, delivered or not
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_logs (
  id              SERIAL PRIMARY KEY,
  ticket_id       INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject         VARCHAR(255),
  template        VARCHAR(50),
  status          VARCHAR(20) NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent', 'failed', 'skipped')),
  error           TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_ticket ON email_logs (ticket_id);

-- -----------------------------------------------------------------------------
-- password_reset_tokens
-- Only the SHA-256 of each token is stored, so a database leak does not hand
-- over working reset links. Rows are single use and short lived.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expiry ON password_reset_tokens (expires_at);

-- -----------------------------------------------------------------------------
-- In-place changes for databases created before SLA deadlines were removed and
-- the priority list was cut to three. CREATE ... IF NOT EXISTS cannot alter an
-- existing table, so these run every time and are written to be no-ops once
-- they have been applied.
-- -----------------------------------------------------------------------------

-- Remap tickets filed under the old fourth priority before the constraint that
-- forbids it is installed, or the constraint would be rejected.
UPDATE tickets SET priority = 'high' WHERE priority = 'urgent';

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_priority_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_priority_check
  CHECK (priority IN ('low', 'medium', 'high'));

DROP INDEX IF EXISTS idx_tickets_sla_open;
ALTER TABLE tickets DROP COLUMN IF EXISTS sla_deadline;

-- Residents give a street address rather than a unit number, which needs more
-- room than the original column allowed. Widening a varchar does not rewrite
-- the table, and re-running these is a no-op.
ALTER TABLE users ALTER COLUMN unit_number TYPE VARCHAR(120);
ALTER TABLE tickets ALTER COLUMN unit_number TYPE VARCHAR(120);

-- Management can hand a resident a temporary password when they are locked out
-- (the emailed reset link is useless until SMTP works). Two columns support it:
--
--   must_change_password  forces that temporary password to be replaced before
--                         the account can be used for anything else, so a
--                         manager never keeps working knowledge of it;
--   token_version         is carried in every JWT and bumped on each password
--                         change, so authenticate() can reject sessions opened
--                         before it and a reset actually ends any session an
--                         intruder already had;
--   password_changed_at   is kept for the audit trail only -- it is deliberately
--                         NOT what decides whether a token is still good. JWT
--                         `iat` has whole-second resolution, so a token minted
--                         in the same second as the change is indistinguishable
--                         from one minted just before it, and any comparison
--                         against a timestamp has to let one of the two through.
--                         A counter has no such ambiguity.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------------
-- Resolved was dropped from the workflow: a ticket now goes straight from the
-- active queue to closed, so there is one fewer step for a queue worked by one
-- person, and no pile of resolved-but-not-closed tickets nobody revisits.
--
-- resolved_at stays and is now stamped when a ticket closes. It means "when the
-- work was finished" rather than "when it entered the resolved status", which is
-- what every report was already using it for, so the reporting history survives
-- this intact.
-- -----------------------------------------------------------------------------

-- Land the existing resolved tickets on closed before the constraint that
-- forbids the old value is installed, or the constraint would be rejected.
-- resolved_at already holds the completion time for these, so closed_at takes
-- it rather than now(), which would date every one of them to this migration.
UPDATE tickets
   SET status = 'closed',
       closed_at = COALESCE(closed_at, resolved_at, now())
 WHERE status = 'resolved';

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'on_hold', 'closed', 'cancelled'));

-- The predicate changed, and CREATE INDEX IF NOT EXISTS will not alter an index
-- that already exists, so this one is replaced rather than skipped.
DROP INDEX IF EXISTS idx_tickets_open_age;
CREATE INDEX IF NOT EXISTS idx_tickets_open_age ON tickets (created_at)
  WHERE status NOT IN ('closed', 'cancelled');

-- The association takes requests on common property and the rules, not on a
-- homeowner's own plumbing, wiring or appliances. Deactivating rather than
-- deleting keeps the category on tickets already filed under it.
UPDATE categories SET is_active = false
 WHERE slug IN ('plumbing', 'electrical', 'hvac', 'appliance',
                'structural', 'pest_control', 'noise');
