-- ResolveX schema (idempotent)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'agent', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('open', 'assigned', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'user',
  is_available  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id               SERIAL PRIMARY KEY,
  title            VARCHAR(200) NOT NULL,
  description      TEXT NOT NULL,
  category         VARCHAR(50) NOT NULL DEFAULT 'general',
  status           ticket_status NOT NULL DEFAULT 'open',
  priority         ticket_priority NOT NULL DEFAULT 'medium',
  created_by       INT NOT NULL REFERENCES users(id),
  assigned_to      INT REFERENCES users(id),
  sla_due_at       TIMESTAMPTZ NOT NULL,
  escalation_level INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id         SERIAL PRIMARY KEY,
  ticket_id  INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_history (
  id         SERIAL PRIMARY KEY,
  ticket_id  INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id   INT REFERENCES users(id),          -- NULL = system (SLA engine)
  action     VARCHAR(40) NOT NULL,              -- created | assigned | status_changed | escalated
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for the common access paths
CREATE INDEX IF NOT EXISTS idx_tickets_status        ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority      ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to   ON tickets(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by    ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at    ON tickets(created_at DESC);
-- Partial index: the SLA sweeper only ever scans live tickets
CREATE INDEX IF NOT EXISTS idx_tickets_sla_active    ON tickets(sla_due_at)
  WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX IF NOT EXISTS idx_comments_ticket       ON ticket_comments(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_history_ticket        ON ticket_history(ticket_id, created_at);
