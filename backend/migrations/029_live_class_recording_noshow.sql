-- class_recordings: Daily cloud recordings downloaded and re-hosted in the existing R2
-- bucket (see backend/src/modules/learningMaterials/learningMaterials.storage.ts for the
-- R2 client pattern this reuses). Permission-gated, admin-only until granted to a role,
-- same model as learning_materials.* (020b).
--
-- class_no_show_events: permanent record of the 5-minutes-after-start no-show check.
-- First support user to accept an alert is assigned and gains join access to that class
-- (enforced in the Daily join check, not here).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_recording_status') THEN
    CREATE TYPE class_recording_status AS ENUM ('pending', 'downloading', 'stored', 'failed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_no_show_side') THEN
    CREATE TYPE class_no_show_side AS ENUM ('teacher', 'student', 'both');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS class_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'daily',
  provider_recording_id TEXT,
  status class_recording_status NOT NULL DEFAULT 'pending',
  storage_key TEXT,
  file_name TEXT,
  duration_seconds INTEGER,
  size_bytes BIGINT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  failure_reason TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_recordings_class_id ON class_recordings (class_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_recordings_provider_recording_id
  ON class_recordings (provider_recording_id) WHERE provider_recording_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS class_no_show_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  side class_no_show_side NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One no-show check per class occurrence: the 5-minute job is safe to run more than once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_no_show_events_class_id ON class_no_show_events (class_id);
CREATE INDEX IF NOT EXISTS idx_class_no_show_events_unclaimed
  ON class_no_show_events (class_id) WHERE claimed_by_user_id IS NULL;

INSERT INTO permissions (key, description)
VALUES
  ('class_recording.view', 'View and download stored class recordings.'),
  ('class_no_show.claim', 'Receive and accept no-show alerts, gaining temporary join access to that class.')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description, updated_at = NOW();

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.key IN ('class_recording.view', 'class_no_show.claim')
WHERE role.name = 'admin'
ON CONFLICT DO NOTHING;

-- Support handles no-show claims day to day; recordings stay admin-only until granted.
INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.key = 'class_no_show.claim'
WHERE role.name = 'support'
ON CONFLICT DO NOTHING;
