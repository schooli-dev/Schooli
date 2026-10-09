-- Homework lifecycle: assigned (Pending) -> submitted (Pending Review) -> completed, or needs_revision ->
-- resubmitted as a NEW attempt. Builds on 005 (tables) and 033 (custom homework + library).
-- Overdue is derived at read time (due_date passed while assigned / needs_revision), never stored.

ALTER TYPE homework_status ADD VALUE IF NOT EXISTS 'needs_revision';
ALTER TYPE homework_status ADD VALUE IF NOT EXISTS 'completed';

-- Homework picked from the curriculum is linked to the curriculum material (the homework document)
-- and to the curriculum class it belongs to; custom homework leaves both NULL.
ALTER TABLE homework
  ADD COLUMN IF NOT EXISTS curriculum_material_id UUID REFERENCES curriculum_materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curriculum_lesson_id UUID REFERENCES curriculum_lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_homework_class_student ON homework (class_id, student_id);
CREATE INDEX IF NOT EXISTS idx_homework_curriculum_material ON homework (curriculum_material_id);

-- 005 allowed only ONE submission per (homework, student). A resubmission must be a new attempt
-- that never overwrites an earlier one, so that constraint is replaced by (homework, attempt).
DO $$
DECLARE constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'homework_submissions'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) = 'UNIQUE (homework_id, student_id)';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE homework_submissions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE homework_submissions
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  ADD COLUMN IF NOT EXISTS points_awarded NUMERIC(7, 2) CHECK (points_awarded IS NULL OR points_awarded >= 0),
  ADD COLUMN IF NOT EXISTS student_comment TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_homework_submissions_attempt
  ON homework_submissions (homework_id, attempt_number);

-- Student uploads live in the private R2 bucket like every other file, so a public URL is optional.
ALTER TABLE homework_submission_files
  ALTER COLUMN file_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS storage_key TEXT;
