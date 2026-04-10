-- ============================================================
-- GLOBAL KICKOFF™ — Ticketing System Schema
-- Compatible with: Neon, Supabase, Railway (Postgres)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Venues ──────────────────────────────────────────────────
CREATE TABLE venues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  capacity    INTEGER,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Events ──────────────────────────────────────────────────
CREATE TABLE events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         UUID NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT,
  match_label      TEXT,                        -- e.g. "USA vs Mexico - Group Stage"
  event_date       TIMESTAMPTZ NOT NULL,
  doors_open       TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('draft','active','sold_out','cancelled','completed')),
  banner_url       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Ticket Types ─────────────────────────────────────────────
CREATE TABLE ticket_types (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  name             TEXT NOT NULL,              -- e.g. "General Admission", "VIP"
  description      TEXT,
  price_cents      INTEGER NOT NULL,           -- in cents (USD)
  quantity_total   INTEGER NOT NULL,
  quantity_sold    INTEGER NOT NULL DEFAULT 0,
  stripe_price_id  TEXT,                       -- Stripe Price ID (optional)
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Orders ───────────────────────────────────────────────────
CREATE TABLE orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  ticket_type_id        UUID NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
  stripe_session_id     TEXT UNIQUE,           -- Stripe Checkout Session ID
  stripe_payment_intent TEXT,
  quantity              INTEGER NOT NULL DEFAULT 1,
  total_cents           INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'usd',
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','refunded','cancelled')),
  customer_email        TEXT,
  customer_name         TEXT,
  metadata              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at               TIMESTAMPTZ
);

-- ── Attendees ────────────────────────────────────────────────
CREATE TABLE attendees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  email       TEXT NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tickets ──────────────────────────────────────────────────
-- Created ONLY after webhook confirms payment
CREATE TABLE tickets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  ticket_type_id   UUID NOT NULL REFERENCES ticket_types(id) ON DELETE RESTRICT,
  attendee_id      UUID REFERENCES attendees(id) ON DELETE SET NULL,
  qr_token         TEXT NOT NULL UNIQUE,       -- secure random token for QR
  ticket_number    TEXT NOT NULL UNIQUE,       -- human-readable e.g. GK-0001
  status           TEXT NOT NULL DEFAULT 'valid'
                   CHECK (status IN ('valid','used','refunded','void','cancelled')),
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at          TIMESTAMPTZ,
  metadata         JSONB
);

-- ── Staff Users ───────────────────────────────────────────────
CREATE TABLE staff_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  pin_hash      TEXT NOT NULL,                 -- bcrypt hashed PIN
  role          TEXT NOT NULL DEFAULT 'scanner'
                CHECK (role IN ('scanner','supervisor','admin')),
  venue_id      UUID REFERENCES venues(id) ON DELETE SET NULL,  -- home venue
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login    TIMESTAMPTZ
);

-- ── Scan Logs ─────────────────────────────────────────────────
CREATE TABLE scan_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID REFERENCES tickets(id) ON DELETE SET NULL,
  qr_token      TEXT NOT NULL,                 -- store even if ticket not found
  event_id      UUID REFERENCES events(id) ON DELETE SET NULL,
  venue_id      UUID REFERENCES venues(id) ON DELETE SET NULL,
  staff_user_id UUID REFERENCES staff_users(id) ON DELETE SET NULL,
  result        TEXT NOT NULL
                CHECK (result IN ('valid','already_used','invalid','refunded','void','cancelled')),
  scanned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    TEXT,
  user_agent    TEXT
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_tickets_qr_token    ON tickets(qr_token);
CREATE INDEX idx_tickets_order_id    ON tickets(order_id);
CREATE INDEX idx_tickets_event_id    ON tickets(event_id);
CREATE INDEX idx_tickets_status      ON tickets(status);
CREATE INDEX idx_orders_session_id   ON orders(stripe_session_id);
CREATE INDEX idx_orders_event_id     ON orders(event_id);
CREATE INDEX idx_scan_logs_ticket_id ON scan_logs(ticket_id);
CREATE INDEX idx_scan_logs_event_id  ON scan_logs(event_id);
CREATE INDEX idx_scan_logs_scanned   ON scan_logs(scanned_at);

-- ── Seed: Example Venue ───────────────────────────────────────
-- Edit these to match your real venues
INSERT INTO venues (id, name, address, city, state, capacity)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'The Betz House',
  '1 EverBank Stadium Dr',
  'Jacksonville',
  'FL',
  3000
);

-- ── Seed: Example Event ───────────────────────────────────────
-- Edit slug, name, date, match_label to match your real events
INSERT INTO events (id, venue_id, name, slug, description, match_label, event_date, doors_open, status)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'GLOBAL KICKOFF™ — USA vs Mexico',
  'usa-vs-mexico-2026',
  'The official GLOBAL KICKOFF™ watch party for the USA vs Mexico group stage match.',
  'USA vs Mexico — Group Stage',
  '2026-06-15 19:00:00+00',
  '2026-06-15 17:00:00+00',
  'active'
);

-- ── Seed: Ticket Types ────────────────────────────────────────
INSERT INTO ticket_types (id, event_id, name, description, price_cents, quantity_total)
VALUES
  (
    'c0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'General Admission',
    'Full event access. Standing room. All-night DJ.',
    2500,
    200
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001',
    'VIP',
    'Reserved seating, bottle service, early entry, VIP bar.',
    7500,
    50
  );
