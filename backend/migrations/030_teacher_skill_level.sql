-- Skill level shown next to a teacher's name in class-scheduling contexts (list, detail,
-- cancellation record) for internal roles only; students always see a plain name.
-- Free-text placeholder (e.g. "A" / "Senior") until an admin-defined taxonomy is decided;
-- editable via the existing teacher update endpoint (PATCH /api/teachers/:id).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS teacher_skill_level TEXT;

INSERT INTO permissions (key, description)
VALUES ('teacher.skill_level.view', 'View a teacher''s internal skill level next to their name in class-scheduling contexts.')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description, updated_at = NOW();

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.key = 'teacher.skill_level.view'
WHERE role.name IN ('admin', 'support')
ON CONFLICT DO NOTHING;
