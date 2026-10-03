-- Extends the existing "Mark Attendance" action (class_attendance, 004) with an
-- Academic Outcome that only ever exists when status = 'present', plus homework
-- assignment for that session. class_attendance.status keeps its five existing values
-- (pending/present/absent/late/excused) unchanged; the new in-classroom dialog only
-- ever writes present/absent, late/excused remain available to other flows (e.g. the
-- existing teacher-attendance "Verify" page) unchanged.
--
-- curriculum_progress is a separate rollup: one row per (student, curriculum lesson),
-- not per session, so the next class for that student+lesson can show a
-- "Continue From Previous Class" banner. Scoped strictly per student.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'academic_outcome') THEN
    CREATE TYPE academic_outcome AS ENUM ('completed', 'partially_completed', 'continue_next_class');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_homework_type') THEN
    CREATE TYPE attendance_homework_type AS ENUM ('none', 'curriculum', 'custom');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'curriculum_progress_status') THEN
    CREATE TYPE curriculum_progress_status AS ENUM
      ('not_started', 'in_progress', 'partially_completed', 'completed', 'continue_from_previous');
  END IF;
END $$;

ALTER TABLE class_attendance
  ADD COLUMN IF NOT EXISTS academic_outcome academic_outcome,
  ADD COLUMN IF NOT EXISTS taught_summary TEXT,
  ADD COLUMN IF NOT EXISTS continue_summary TEXT,
  ADD COLUMN IF NOT EXISTS homework_type attendance_homework_type NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS homework_material_id UUID REFERENCES curriculum_materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS homework_custom_text TEXT;

ALTER TABLE class_attendance
  DROP CONSTRAINT IF EXISTS chk_class_attendance_outcome_requires_present;

ALTER TABLE class_attendance
  ADD CONSTRAINT chk_class_attendance_outcome_requires_present
    CHECK (academic_outcome IS NULL OR status = 'present');

CREATE TABLE IF NOT EXISTS curriculum_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  curriculum_lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE RESTRICT,
  status curriculum_progress_status NOT NULL DEFAULT 'not_started',
  -- The class_attendance row that last updated this rollup, so the continuation banner
  -- can pull "what was taught" / "what should continue" without duplicating that text here.
  last_class_attendance_id UUID REFERENCES class_attendance(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, curriculum_lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_progress_student ON curriculum_progress (student_id);
