DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
    CREATE TYPE assignment_status AS ENUM ('active', 'inactive');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_of_week') THEN
    CREATE TYPE day_of_week AS ENUM (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS teacher_student_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status assignment_status NOT NULL DEFAULT 'active',
  assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_student_assignments_not_self CHECK (teacher_id <> student_id)
);

CREATE TABLE IF NOT EXISTS teacher_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_availability_valid_window CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS teacher_unavailable_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unavailable_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT teacher_unavailable_dates_valid_window CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_student_assignments_active_unique
  ON teacher_student_assignments (teacher_id, student_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_teacher_student_assignments_teacher
  ON teacher_student_assignments (teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_teacher_student_assignments_student
  ON teacher_student_assignments (student_id, status);

CREATE INDEX IF NOT EXISTS idx_teacher_availability_teacher_day
  ON teacher_availability (teacher_id, day_of_week, is_active);

CREATE INDEX IF NOT EXISTS idx_teacher_unavailable_dates_teacher_date
  ON teacher_unavailable_dates (teacher_id, unavailable_date);
