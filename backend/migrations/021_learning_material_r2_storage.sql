ALTER TABLE curriculum_materials
  ADD COLUMN IF NOT EXISTS storage_key TEXT;

ALTER TABLE curriculum_materials
  DROP CONSTRAINT IF EXISTS curriculum_materials_source_value;

ALTER TABLE curriculum_materials
  ADD CONSTRAINT curriculum_materials_source_value CHECK (
    (source_type = 'file' AND (file_url IS NOT NULL OR storage_key IS NOT NULL) AND external_url IS NULL)
    OR (source_type = 'link' AND external_url IS NOT NULL AND file_url IS NULL AND storage_key IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_curriculum_materials_storage_key
  ON curriculum_materials (storage_key)
  WHERE storage_key IS NOT NULL;
