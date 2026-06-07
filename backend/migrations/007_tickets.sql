DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_category') THEN
    CREATE TYPE ticket_category AS ENUM (
      'technical',
      'scheduling',
      'payment',
      'academic'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
    CREATE TYPE ticket_priority AS ENUM (
      'low',
      'medium',
      'high',
      'urgent'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE ticket_status AS ENUM (
      'open',
      'assigned',
      'in_progress',
      'resolved',
      'closed',
      'escalated'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category ticket_category NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  related_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  related_student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message TEXT NOT NULL,
  is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES ticket_messages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  public_id TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  resource_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  old_status ticket_status,
  new_status ticket_status NOT NULL,
  changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_created_by
  ON tickets (created_by_user_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to
  ON tickets (assigned_to_user_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_status_priority
  ON tickets (status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket
  ON ticket_messages (ticket_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ticket_status_history_ticket
  ON ticket_status_history (ticket_id, created_at);
