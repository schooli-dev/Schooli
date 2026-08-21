CREATE TABLE IF NOT EXISTS class_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  notes TEXT,
  schedule_timezone TEXT NOT NULL,
  start_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  weekdays TEXT[] NOT NULL,
  scheduled_class_count INTEGER NOT NULL,
  created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT class_series_valid_duration CHECK (duration_minutes > 0),
  CONSTRAINT class_series_valid_class_count CHECK (scheduled_class_count > 0),
  CONSTRAINT class_series_valid_weekdays CHECK (
    cardinality(weekdays) > 0
    AND weekdays <@ ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']::TEXT[]
  )
);

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS class_series_id UUID REFERENCES class_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_sequence INTEGER;

CREATE INDEX IF NOT EXISTS idx_classes_series_sequence
  ON classes (class_series_id, series_sequence)
  WHERE class_series_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_classes_series_sequence
  ON classes (class_series_id, series_sequence)
  WHERE class_series_id IS NOT NULL;
