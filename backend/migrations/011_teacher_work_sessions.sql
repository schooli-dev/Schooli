CREATE TABLE IF NOT EXISTS teacher_work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  class_id UUID UNIQUE REFERENCES classes(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'class_schedule',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled', 'rescheduled')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_teacher_work_sessions_teacher_time
  ON teacher_work_sessions (teacher_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_teacher_work_sessions_student_time
  ON teacher_work_sessions (student_id, start_time, end_time)
  WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_work_sessions_status
  ON teacher_work_sessions (status);
