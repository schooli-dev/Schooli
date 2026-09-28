INSERT INTO permissions (key, description)
VALUES
  ('learning_materials.modules.view', 'View modules assigned to the teacher.'),
  ('learning_materials.classes.view', 'View curriculum classes in modules assigned to the teacher.')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description, updated_at = NOW();

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN ('learning_materials.modules.view', 'learning_materials.classes.view')
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
