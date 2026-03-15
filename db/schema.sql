-- WhatsApp Clinic Bot — Database Schema
-- Source of truth: docs/resumo-executivo.md
-- Run this in Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Table: contacts
-- One record per patient, identified by WhatsApp phone number
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164  VARCHAR(20) NOT NULL,
  name        VARCHAR(255),
  email       VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_contacts_phone_e164 UNIQUE (phone_e164)
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_e164 ON contacts (phone_e164);
CREATE INDEX IF NOT EXISTS idx_contacts_email      ON contacts (email);

-- ============================================================
-- Table: conversations
-- One active conversation per contact (state != 'closed')
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID        NOT NULL REFERENCES contacts (id),
  state                 VARCHAR(30) NOT NULL DEFAULT 'menu_root',
  handoff_human         BOOLEAN     NOT NULL DEFAULT FALSE,
  last_bot_message_at   TIMESTAMPTZ,
  booking_link_sent_at  TIMESTAMPTZ,
  booked_at             TIMESTAMPTZ,
  handoff_at            TIMESTAMPTZ,
  closed_at             TIMESTAMPTZ,
  closed_reason         VARCHAR(30),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_conversations_state CHECK (
    state IN ('menu_root', 'choosing_modality', 'waiting_booking', 'waiting_human', 'booked', 'closed')
  ),
  CONSTRAINT chk_conversations_closed_reason CHECK (
    closed_reason IS NULL OR
    closed_reason IN ('completed', 'abandoned', 'human_resolved', 'restarted')
  )
);

CREATE INDEX IF NOT EXISTS idx_conversations_contact_id    ON conversations (contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_state         ON conversations (state);
CREATE INDEX IF NOT EXISTS idx_conversations_handoff_human ON conversations (handoff_human);

-- One active conversation per contact
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_one_active_per_contact
  ON conversations (contact_id)
  WHERE state != 'closed';

-- ============================================================
-- Table: message_log
-- All inbound/outbound messages for audit and idempotency
-- ============================================================
CREATE TABLE IF NOT EXISTS message_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_message_id VARCHAR(255) NOT NULL,
  contact_id          UUID        NOT NULL REFERENCES contacts (id),
  conversation_id     UUID        REFERENCES conversations (id),
  direction           VARCHAR(10) NOT NULL,
  message_type        VARCHAR(20) NOT NULL DEFAULT 'unknown',
  payload             JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_message_log_external_id UNIQUE (external_message_id),
  CONSTRAINT chk_message_log_direction CHECK (direction IN ('inbound', 'outbound')),
  CONSTRAINT chk_message_log_type CHECK (
    message_type IN ('text', 'button', 'media', 'interactive', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS idx_message_log_contact_id          ON message_log (contact_id);
CREATE INDEX IF NOT EXISTS idx_message_log_external_message_id ON message_log (external_message_id);
CREATE INDEX IF NOT EXISTS idx_message_log_direction           ON message_log (direction);
CREATE INDEX IF NOT EXISTS idx_message_log_created_at          ON message_log (created_at);

-- ============================================================
-- Table: appointments
-- Bookings received from Calendly webhooks (Etapa 4+)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  calendly_invitee_uri  VARCHAR(500) NOT NULL,
  calendly_event_uri    VARCHAR(500),
  contact_id            UUID        REFERENCES contacts (id),
  conversation_id       UUID        REFERENCES conversations (id),
  scheduled_at          TIMESTAMPTZ,
  match_confidence      VARCHAR(10) NOT NULL DEFAULT 'none',
  match_rule            VARCHAR(50),
  calendly_payload      JSONB       NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_appointments_invitee_uri UNIQUE (calendly_invitee_uri),
  CONSTRAINT chk_appointments_match_confidence CHECK (
    match_confidence IN ('gold', 'silver', 'bronze', 'none')
  )
);

CREATE INDEX IF NOT EXISTS idx_appointments_contact_id           ON appointments (contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_calendly_invitee_uri ON appointments (calendly_invitee_uri);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at         ON appointments (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_match_confidence     ON appointments (match_confidence);
