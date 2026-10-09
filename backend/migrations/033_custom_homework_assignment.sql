-- Custom homework a teacher creates from the Mark Attendance dialog and assigns to ONE student
-- (homework.student_id), plus a per-teacher "Homework Library" of reusable templates.
-- Builds on the homework tables from 005, which had no API yet.

-- Reusable templates. Attachments are copied (by storage key) into each homework assigned from one.
CREATE TABLE IF NOT EXISTS homework_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT,
  max_points INTEGER NOT NULL DEFAULT 10 CHECK (max_points > 0),
  submission_type TEXT NOT NULL DEFAULT 'file' CHECK (submission_type IN ('file', 'text', 'link', 'file_text')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homework_library_teacher ON homework_library (teacher_id, created_at DESC);

CREATE TABLE IF NOT EXISTS homework_library_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID NOT NULL REFERENCES homework_library(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- description (005) holds the instructions; homework_type = 'custom' marks teacher-created homework.
ALTER TABLE homework
  ADD COLUMN IF NOT EXISTS max_points INTEGER CHECK (max_points IS NULL OR max_points > 0),
  ADD COLUMN IF NOT EXISTS submission_type TEXT NOT NULL DEFAULT 'file'
    CHECK (submission_type IN ('file', 'text', 'link', 'file_text')),
  ADD COLUMN IF NOT EXISTS library_id UUID REFERENCES homework_library(id) ON DELETE SET NULL;

-- Attachments now live in the private R2 bucket (same pattern as learning materials), so a
-- public file_url is no longer always present.
ALTER TABLE homework_resources
  ALTER COLUMN file_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS storage_key TEXT;

-- The homework assigned through the attendance dialog, so reopening it can show what was assigned.
ALTER TABLE class_attendance
  ADD COLUMN IF NOT EXISTS homework_id UUID REFERENCES homework(id) ON DELETE SET NULL;
