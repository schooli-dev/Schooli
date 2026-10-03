-- Curriculum-driven scheduling: a series is now created against a Module, and each
-- occurrence maps 1:1 to the Module's ordered Curriculum Classes (curriculum_lessons).
-- classes.series_sequence (019) is the occurrence's fixed-forever identity; the new
-- curriculum_lesson_id is the part that shifts when RecalculateRemainingCurriculumMappings
-- re-walks the module's lesson list after a session doesn't fully consume its mapped lesson.

ALTER TABLE class_series
  ADD COLUMN IF NOT EXISTS curriculum_module_id UUID REFERENCES curriculum_modules(id) ON DELETE SET NULL;

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS curriculum_lesson_id UUID REFERENCES curriculum_lessons(id) ON DELETE SET NULL,
  -- True once an admin/teacher has manually edited title/notes via PATCH /classes/:id, so
  -- the curriculum remap job stops overwriting them with the auto-generated lesson title.
  ADD COLUMN IF NOT EXISTS title_is_custom BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_classes_curriculum_lesson_id ON classes (curriculum_lesson_id);
CREATE INDEX IF NOT EXISTS idx_class_series_curriculum_module_id ON class_series (curriculum_module_id);
