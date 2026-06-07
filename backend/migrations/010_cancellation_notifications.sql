DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_cancellation_request_status') THEN
    CREATE TYPE class_cancellation_request_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'withdrawn'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE notification_channel AS ENUM (
      'email',
      'in_app',
      'sms_future',
      'whatsapp_future'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_recipient_role') THEN
    CREATE TYPE notification_recipient_role AS ENUM (
      'admin',
      'teacher',
      'student',
      'support'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_delivery_status') THEN
    CREATE TYPE notification_delivery_status AS ENUM (
      'pending',
      'sent',
      'failed',
      'skipped'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS class_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requested_by_role TEXT NOT NULL,
  reason TEXT NOT NULL,
  status class_cancellation_request_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  available_variables JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  channel notification_channel NOT NULL DEFAULT 'email',
  recipient_role notification_recipient_role NOT NULL,
  email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  conditions JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_key, channel, recipient_role)
);

CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_rule_id UUID REFERENCES notification_rules(id) ON DELETE SET NULL,
  event_key TEXT NOT NULL,
  channel notification_channel NOT NULL,
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_email TEXT,
  email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  subject TEXT,
  status notification_delivery_status NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_cancellation_requests_class
  ON class_cancellation_requests (class_id, status);

CREATE INDEX IF NOT EXISTS idx_class_cancellation_requests_requested_by
  ON class_cancellation_requests (requested_by_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_templates_active
  ON email_templates (is_active);

CREATE INDEX IF NOT EXISTS idx_notification_rules_event
  ON notification_rules (event_key, is_enabled);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_recipient
  ON notification_delivery_logs (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_event
  ON notification_delivery_logs (event_key, status, created_at DESC);

WITH permission_seed(key, description) AS (
  VALUES
    ('class.request_cancel', 'Request class cancellation.'),
    ('notification.view', 'View notification rules and delivery logs.'),
    ('notification.update', 'Create and update notification rules.'),
    ('email_template.view', 'View email templates.'),
    ('email_template.create', 'Create email templates.'),
    ('email_template.update', 'Update email templates.')
)
INSERT INTO permissions (key, description)
SELECT key, description
FROM permission_seed
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description,
    updated_at = NOW();

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.key IN (
    'class.request_cancel',
    'notification.view',
    'notification.update',
    'email_template.view',
    'email_template.create',
    'email_template.update'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN ('class.request_cancel')
WHERE r.name IN ('student', 'teacher')
ON CONFLICT DO NOTHING;
