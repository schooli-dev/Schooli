CREATE TABLE IF NOT EXISTS class_series_weekly_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_series_id UUID NOT NULL REFERENCES class_series(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  start_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT class_series_weekly_schedules_valid_day CHECK (
    day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
  ),
  CONSTRAINT class_series_weekly_schedules_unique_day UNIQUE (class_series_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_class_series_weekly_schedules_series
  ON class_series_weekly_schedules (class_series_id);
