DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_provider') THEN
    CREATE TYPE video_provider AS ENUM ('daily');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_creation_status') THEN
    CREATE TYPE video_creation_status AS ENUM (
      'pending',
      'created',
      'failed',
      'skipped',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_meeting_status') THEN
    CREATE TYPE video_meeting_status AS ENUM (
      'pending',
      'scheduled',
      'started',
      'ended',
      'failed',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'video_event_type') THEN
    CREATE TYPE video_event_type AS ENUM ('join', 'leave');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS video_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL UNIQUE REFERENCES classes(id) ON DELETE CASCADE,
  provider video_provider NOT NULL DEFAULT 'daily',
  provider_meeting_id TEXT,
  provider_room_name TEXT,
  provider_room_url TEXT,
  provider_password TEXT,
  status video_meeting_status NOT NULL DEFAULT 'pending',
  creation_status video_creation_status NOT NULL DEFAULT 'pending',
  raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider video_provider NOT NULL DEFAULT 'daily',
  provider_participant_id TEXT,
  participant_name TEXT,
  participant_email TEXT,
  event_type video_event_type NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO video_meetings (
  id,
  class_id,
  provider,
  provider_meeting_id,
  provider_room_name,
  provider_room_url,
  provider_password,
  status,
  creation_status,
  raw_payload,
  created_at,
  updated_at
)
SELECT
  id,
  class_id,
  'daily'::video_provider,
  zoom_meeting_id,
  zoom_uuid,
  zoom_join_url,
  zoom_password,
  status::TEXT::video_meeting_status,
  creation_status::TEXT::video_creation_status,
  jsonb_build_object('migratedFrom', 'zoom', 'zoom', raw_payload),
  created_at,
  updated_at
FROM zoom_meetings
WHERE to_regclass('public.zoom_meetings') IS NOT NULL
ON CONFLICT (class_id) DO NOTHING;

INSERT INTO video_attendance_events (
  id,
  class_id,
  student_id,
  provider,
  participant_name,
  participant_email,
  event_type,
  event_time,
  raw_payload,
  created_at
)
SELECT
  id,
  class_id,
  student_id,
  'daily'::video_provider,
  zoom_participant_name,
  zoom_participant_email,
  event_type::TEXT::video_event_type,
  event_time,
  jsonb_build_object('migratedFrom', 'zoom', 'zoom', raw_payload),
  created_at
FROM zoom_attendance_events
WHERE to_regclass('public.zoom_attendance_events') IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_video_meetings_class_provider
  ON video_meetings (class_id, provider);

CREATE INDEX IF NOT EXISTS idx_video_attendance_events_class_time
  ON video_attendance_events (class_id, event_time);

DROP TABLE IF EXISTS zoom_attendance_events;
DROP TABLE IF EXISTS zoom_meetings;
DROP TYPE IF EXISTS zoom_event_type;
DROP TYPE IF EXISTS zoom_meeting_status;
DROP TYPE IF EXISTS zoom_creation_status;
