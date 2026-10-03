-- Student self-service cancellation becomes fully automatic (>=4h before start) instead
-- of the manual class_cancellation_requests review queue; that table and its endpoints
-- are left untouched for admin-side history/review use. cancellation_source records how
-- a class actually got cancelled, for the admin list/detail and notifications.
--
-- Student self-service reschedule is new: same teacher only, within the current
-- calendar month, reusing the existing rescheduleClass same-row-update logic.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_cancellation_source') THEN
    CREATE TYPE class_cancellation_source AS ENUM ('admin', 'student_auto');
  END IF;
END $$;

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS cancellation_source class_cancellation_source;

INSERT INTO permissions (key, description)
VALUES ('class.request_reschedule', 'Request a self-service reschedule of an own class to another slot with the same teacher.')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description, updated_at = NOW();

-- Matches how class.request_cancel is granted to the student role by default (012).
INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.key = 'class.request_reschedule'
WHERE role.name = 'student'
ON CONFLICT DO NOTHING;
