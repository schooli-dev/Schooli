INSERT INTO permissions (key, description)
VALUES ('reports_analytics.view', 'View the Reports & Analytics navigation section.')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description,
    updated_at = NOW();

-- Administrators receive the new permission by default. Other roles remain hidden
-- until an administrator grants this permission through Roles & Permissions.
INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles AS role
JOIN permissions AS permission ON permission.key = 'reports_analytics.view'
WHERE role.name = 'admin'
ON CONFLICT DO NOTHING;
