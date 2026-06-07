DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_status') THEN
    CREATE TYPE class_status AS ENUM (
      'scheduled',
      'live',
      'completed',
      'cancelled',
      'rescheduled',
      'failed',
      'no_show'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM (
      'pending',
      'present',
      'absent',
      'late',
      'excused'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_source') THEN
    CREATE TYPE attendance_source AS ENUM (
      'teacher_manual',
      'zoom_event',
      'admin_override'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zoom_creation_status') THEN
    CREATE TYPE zoom_creation_status AS ENUM (
      'pending',
      'created',
      'failed',
      'skipped'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zoom_meeting_status') THEN
    CREATE TYPE zoom_meeting_status AS ENUM (
      'pending',
      'scheduled',
      'started',
      'ended',
      'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zoom_event_type') THEN
    CREATE TYPE zoom_event_type AS ENUM ('join', 'leave');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  status class_status NOT NULL DEFAULT 'scheduled',
  created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  calendar_uid TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  rescheduled_from_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT classes_valid_time_window CHECK (start_time < end_time),
  CONSTRAINT classes_valid_duration CHECK (duration_minutes > 0)
);

CREATE TABLE IF NOT EXISTS class_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  attendance_status attendance_status NOT NULL DEFAULT 'pending',
  credits_consumed NUMERIC(10, 2) NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS zoom_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL UNIQUE REFERENCES classes(id) ON DELETE CASCADE,
  zoom_meeting_id TEXT,
  zoom_uuid TEXT,
  zoom_password TEXT,
  zoom_join_url TEXT,
  zoom_start_url TEXT,
  status zoom_meeting_status NOT NULL DEFAULT 'pending',
  creation_status zoom_creation_status NOT NULL DEFAULT 'pending',
  raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zoom_attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  zoom_participant_name TEXT,
  zoom_participant_email TEXT,
  event_type zoom_event_type NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS class_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status attendance_status NOT NULL DEFAULT 'pending',
  marked_by_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ,
  source attendance_source NOT NULL DEFAULT 'teacher_manual',
  teacher_notes TEXT,
  zoom_join_time TIMESTAMPTZ,
  zoom_leave_time TIMESTAMPTZ,
  total_zoom_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher_time
  ON classes (teacher_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_classes_status_start_time
  ON classes (status, start_time);

CREATE INDEX IF NOT EXISTS idx_class_participants_student_class
  ON class_participants (student_id, class_id);

CREATE INDEX IF NOT EXISTS idx_zoom_attendance_events_class_time
  ON zoom_attendance_events (class_id, event_time);

CREATE INDEX IF NOT EXISTS idx_class_attendance_student
  ON class_attendance (student_id, status);
