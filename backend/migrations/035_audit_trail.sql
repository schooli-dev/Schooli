-- Audit trail: a read-only chronological history of important actions, shown to admins.
-- Reuses the audit_logs table from migration 008 and adds what the admin page filters on.
-- Names are copied onto each row on purpose, so the history stays readable if a user or record is later removed.

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS actor_name TEXT,
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS subject_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS idx_audit_logs_module_created ON audit_logs (module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_subject ON audit_logs (subject_user_id);

-- Backfill the history of homework that already exists, using the real stored timestamps.
-- Homework assigned.
INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, module, entity_type, entity_id, subject_user_id, summary, metadata, created_at)
SELECT h.teacher_id,
       CONCAT(tu.first_name, ' ', tu.last_name),
       'teacher',
       'homework.assigned',
       'homework',
       'homework',
       h.id,
       h.student_id,
       'Homework assigned by ' || CONCAT(tu.first_name, ' ', tu.last_name),
       JSONB_BUILD_OBJECT(
         'homeworkTitle', h.title,
         'studentName', CONCAT(su.first_name, ' ', su.last_name),
         'teacherName', CONCAT(tu.first_name, ' ', tu.last_name),
         'courseName', co.name,
         'moduleName', m.name,
         'lessonNumber', cl.lesson_number,
         'lessonTitle', cl.title,
         'backfilled', TRUE),
       h.created_at
FROM homework h
JOIN users tu ON tu.id = h.teacher_id
JOIN users su ON su.id = h.student_id
LEFT JOIN curriculum_lessons cl ON cl.id = h.curriculum_lesson_id
LEFT JOIN curriculum_modules m ON m.id = cl.module_id
LEFT JOIN curriculum_courses co ON co.id = m.course_id;

-- Each submitted attempt.
INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, module, entity_type, entity_id, subject_user_id, summary, metadata, created_at)
SELECT s.student_id,
       CONCAT(su.first_name, ' ', su.last_name),
       'student',
       CASE WHEN s.attempt_number > 1 THEN 'homework.resubmitted' ELSE 'homework.submitted' END,
       'homework',
       'homework',
       h.id,
       h.student_id,
       CONCAT(su.first_name, ' ', su.last_name) || ' submitted Attempt #' || s.attempt_number,
       JSONB_BUILD_OBJECT(
         'homeworkTitle', h.title,
         'studentName', CONCAT(su.first_name, ' ', su.last_name),
         'teacherName', CONCAT(tu.first_name, ' ', tu.last_name),
         'courseName', co.name,
         'moduleName', m.name,
         'lessonNumber', cl.lesson_number,
         'lessonTitle', cl.title,
         'attempt', s.attempt_number,
         'backfilled', TRUE),
       s.submitted_at
FROM homework_submissions s
JOIN homework h ON h.id = s.homework_id
JOIN users su ON su.id = s.student_id
JOIN users tu ON tu.id = h.teacher_id
LEFT JOIN curriculum_lessons cl ON cl.id = h.curriculum_lesson_id
LEFT JOIN curriculum_modules m ON m.id = cl.module_id
LEFT JOIN curriculum_courses co ON co.id = m.course_id;

-- Each review (one "reviewed" entry, then its outcome 1 ms later so the order is stable).
INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, module, entity_type, entity_id, subject_user_id, summary, metadata, created_at)
SELECT s.reviewed_by_teacher_id,
       CONCAT(ru.first_name, ' ', ru.last_name),
       'teacher',
       'homework.reviewed',
       'homework',
       'homework',
       h.id,
       h.student_id,
       CONCAT(ru.first_name, ' ', ru.last_name) || ' reviewed Attempt #' || s.attempt_number,
       JSONB_BUILD_OBJECT(
         'homeworkTitle', h.title,
         'studentName', CONCAT(su.first_name, ' ', su.last_name),
         'teacherName', CONCAT(tu.first_name, ' ', tu.last_name),
         'courseName', co.name,
         'moduleName', m.name,
         'lessonNumber', cl.lesson_number,
         'lessonTitle', cl.title,
         'attempt', s.attempt_number,
         'points', s.points_awarded,
         'maxPoints', h.max_points,
         'backfilled', TRUE),
       s.reviewed_at
FROM homework_submissions s
JOIN homework h ON h.id = s.homework_id
JOIN users su ON su.id = h.student_id
JOIN users tu ON tu.id = h.teacher_id
JOIN users ru ON ru.id = s.reviewed_by_teacher_id
LEFT JOIN curriculum_lessons cl ON cl.id = h.curriculum_lesson_id
LEFT JOIN curriculum_modules m ON m.id = cl.module_id
LEFT JOIN curriculum_courses co ON co.id = m.course_id
WHERE s.reviewed_at IS NOT NULL;

INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, module, entity_type, entity_id, subject_user_id, summary, metadata, created_at)
SELECT s.reviewed_by_teacher_id,
       CONCAT(ru.first_name, ' ', ru.last_name),
       'teacher',
       CASE WHEN s.status = 'accepted' THEN 'homework.completed' ELSE 'homework.revision_required' END,
       'homework',
       'homework',
       h.id,
       h.student_id,
       CASE WHEN s.status = 'accepted' THEN 'Marked Complete' ELSE 'Marked Revision Required' END,
       JSONB_BUILD_OBJECT(
         'homeworkTitle', h.title,
         'studentName', CONCAT(su.first_name, ' ', su.last_name),
         'teacherName', CONCAT(tu.first_name, ' ', tu.last_name),
         'courseName', co.name,
         'moduleName', m.name,
         'lessonNumber', cl.lesson_number,
         'lessonTitle', cl.title,
         'attempt', s.attempt_number,
         'points', s.points_awarded,
         'maxPoints', h.max_points,
         'backfilled', TRUE),
       s.reviewed_at + INTERVAL '1 millisecond'
FROM homework_submissions s
JOIN homework h ON h.id = s.homework_id
JOIN users su ON su.id = h.student_id
JOIN users tu ON tu.id = h.teacher_id
JOIN users ru ON ru.id = s.reviewed_by_teacher_id
LEFT JOIN curriculum_lessons cl ON cl.id = h.curriculum_lesson_id
LEFT JOIN curriculum_modules m ON m.id = cl.module_id
LEFT JOIN curriculum_courses co ON co.id = m.course_id
WHERE s.reviewed_at IS NOT NULL AND s.status IN ('accepted', 'resubmission_requested');
