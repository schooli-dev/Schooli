-- Teachers use the scoped module/class read permissions introduced in 024.
-- Remove the former admin learning-material permissions so they cannot unlock
-- Courses, Teacher Access, or the admin management APIs.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'teacher'
  AND p.key IN (
    'learning_materials.view',
    'learning_materials.create',
    'learning_materials.update',
    'learning_materials.manage_access'
  );
