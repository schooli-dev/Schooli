DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'curriculum_status') THEN
    CREATE TYPE curriculum_status AS ENUM ('active', 'inactive');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'curriculum_material_section') THEN
    CREATE TYPE curriculum_material_section AS ENUM ('presentation', 'lesson_plan', 'homework', 'file');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'curriculum_material_source') THEN
    CREATE TYPE curriculum_material_source AS ENUM ('file', 'link');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'curriculum_material_audience') THEN
    CREATE TYPE curriculum_material_audience AS ENUM ('teachers_only', 'students_and_teachers');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS curriculum_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_key TEXT NOT NULL DEFAULT 'bi-code-slash',
  icon_url TEXT,
  status curriculum_status NOT NULL DEFAULT 'active',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_courses_name_ci
  ON curriculum_courses (LOWER(name));

CREATE TABLE IF NOT EXISTS curriculum_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES curriculum_courses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  status curriculum_status NOT NULL DEFAULT 'active',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT curriculum_modules_sort_order_positive CHECK (sort_order > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_modules_course_name_ci
  ON curriculum_modules (course_id, LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_modules_course_order
  ON curriculum_modules (course_id, sort_order);

CREATE TABLE IF NOT EXISTS curriculum_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE RESTRICT,
  lesson_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  status curriculum_status NOT NULL DEFAULT 'active',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT curriculum_lessons_number_positive CHECK (lesson_number > 0),
  CONSTRAINT curriculum_lessons_sort_order_positive CHECK (sort_order > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_lessons_module_number
  ON curriculum_lessons (module_id, lesson_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_lessons_module_order
  ON curriculum_lessons (module_id, sort_order);

CREATE TABLE IF NOT EXISTS teacher_module_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, module_id)
);

CREATE TABLE IF NOT EXISTS curriculum_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id UUID NOT NULL DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE RESTRICT,
  section curriculum_material_section NOT NULL,
  source_type curriculum_material_source NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  external_url TEXT,
  audience curriculum_material_audience NOT NULL DEFAULT 'teachers_only',
  allow_late_submission BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  status curriculum_status NOT NULL DEFAULT 'active',
  replaces_material_id UUID REFERENCES curriculum_materials(id) ON DELETE RESTRICT,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT curriculum_materials_version_positive CHECK (version > 0),
  CONSTRAINT curriculum_materials_source_value CHECK (
    (source_type = 'file' AND file_url IS NOT NULL AND external_url IS NULL)
    OR (source_type = 'link' AND external_url IS NOT NULL AND file_url IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_materials_logical_version
  ON curriculum_materials (logical_id, version);

CREATE INDEX IF NOT EXISTS idx_curriculum_modules_course_status
  ON curriculum_modules (course_id, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_curriculum_lessons_module_status
  ON curriculum_lessons (module_id, status, sort_order);

CREATE INDEX IF NOT EXISTS idx_teacher_module_access_teacher_active
  ON teacher_module_access (teacher_id, is_active);

CREATE INDEX IF NOT EXISTS idx_curriculum_materials_lesson_section
  ON curriculum_materials (lesson_id, section, status);

INSERT INTO permissions (key, description)
VALUES
  ('learning_materials.view', 'View learning materials.'),
  ('learning_materials.create', 'Create learning materials.'),
  ('learning_materials.update', 'Update learning materials.'),
  ('learning_materials.manage_access', 'Manage teacher access to learning materials.')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description,
    updated_at = NOW();

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'learning_materials.view',
  'learning_materials.create',
  'learning_materials.update',
  'learning_materials.manage_access'
)
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
