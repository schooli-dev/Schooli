INSERT INTO roles (name, description)
VALUES
  ('admin', 'Platform administrator with full system access.'),
  ('teacher', 'Teacher user who manages assigned students, classes, attendance, and homework.'),
  ('student', 'Student user who attends classes, submits homework, and views progress.'),
  ('support', 'Support user who handles tickets and operational support.')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    updated_at = NOW();

WITH permission_seed(key, description) AS (
  VALUES
    ('user.view', 'View users.'),
    ('user.create', 'Create users.'),
    ('user.update', 'Update users.'),
    ('user.deactivate', 'Deactivate users.'),
    ('role.view', 'View roles.'),
    ('permission.view', 'View permissions.'),
    ('teacher.view', 'View teachers.'),
    ('teacher.create', 'Create teachers.'),
    ('teacher.update', 'Update teachers.'),
    ('student.view', 'View students.'),
    ('student.create', 'Create students.'),
    ('student.update', 'Update students.'),
    ('class.view', 'View classes.'),
    ('class.create', 'Create classes.'),
    ('class.update', 'Update classes.'),
    ('class.cancel', 'Cancel classes.'),
    ('class.reschedule', 'Reschedule classes.'),
    ('class.join', 'Join classes.'),
    ('class.override_conflict', 'Override scheduling conflicts.'),
    ('attendance.view', 'View attendance.'),
    ('attendance.mark', 'Mark attendance.'),
    ('attendance.override', 'Override attendance.'),
    ('homework.view', 'View homework.'),
    ('homework.create', 'Create homework.'),
    ('homework.submit', 'Submit homework.'),
    ('homework.review', 'Review homework.'),
    ('credits.view', 'View credits.'),
    ('credits.adjust', 'Adjust credits.'),
    ('credits.refund', 'Refund credits.'),
    ('ticket.view', 'View tickets.'),
    ('ticket.create', 'Create tickets.'),
    ('ticket.reply', 'Reply to tickets.'),
    ('ticket.resolve', 'Resolve tickets.'),
    ('ticket.escalate', 'Escalate tickets.'),
    ('certificate.view', 'View certificates.'),
    ('certificate.generate', 'Generate certificates.'),
    ('certificate.revoke', 'Revoke certificates.'),
    ('report.view', 'View reports.'),
    ('report.export', 'Export reports.'),
    ('settings.view', 'View settings.'),
    ('settings.update', 'Update settings.'),
    ('audit.view', 'View audit logs.')
)
INSERT INTO permissions (key, description)
SELECT key, description
FROM permission_seed
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description,
    updated_at = NOW();

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'teacher.view',
  'student.view',
  'class.view',
  'class.join',
  'attendance.view',
  'attendance.mark',
  'homework.view',
  'homework.create',
  'homework.review',
  'report.view',
  'ticket.view',
  'ticket.create',
  'ticket.reply'
)
WHERE r.name = 'teacher'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'class.view',
  'class.join',
  'attendance.view',
  'homework.view',
  'homework.submit',
  'credits.view',
  'ticket.view',
  'ticket.create',
  'ticket.reply',
  'certificate.view',
  'report.view'
)
WHERE r.name = 'student'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'user.view',
  'teacher.view',
  'student.view',
  'class.view',
  'class.reschedule',
  'attendance.view',
  'credits.view',
  'ticket.view',
  'ticket.reply',
  'ticket.resolve',
  'ticket.escalate',
  'report.view'
)
WHERE r.name = 'support'
ON CONFLICT DO NOTHING;
