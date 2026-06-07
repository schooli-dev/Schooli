DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'homework_status') THEN
    CREATE TYPE homework_status AS ENUM (
      'assigned',
      'submitted',
      'reviewed',
      'overdue'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
    CREATE TYPE submission_status AS ENUM (
      'submitted',
      'resubmission_requested',
      'accepted'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS homework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  homework_type TEXT NOT NULL DEFAULT 'general',
  due_date TIMESTAMPTZ,
  status homework_status NOT NULL DEFAULT 'assigned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS homework_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  public_id TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  resource_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  submission_text TEXT,
  submission_link TEXT,
  status submission_status NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  teacher_feedback TEXT,
  grade TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (homework_id, student_id)
);

CREATE TABLE IF NOT EXISTS homework_submission_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES homework_submissions(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  public_id TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  resource_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homework_teacher
  ON homework (teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_homework_student
  ON homework (student_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_homework_class
  ON homework (class_id);

CREATE INDEX IF NOT EXISTS idx_homework_submissions_homework
  ON homework_submissions (homework_id, status);
