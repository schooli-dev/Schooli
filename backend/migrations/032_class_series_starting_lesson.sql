-- Optional "start from this curriculum class" for a scheduling series. Lets an admin schedule an
-- additional series to finish the remaining classes of a module: occurrences map to the module's
-- ordered curriculum_lessons starting at this lesson (by sort_order) instead of from the beginning.
-- NULL keeps the original behaviour (start at the module's first lesson). Stored on the series so
-- every later remap (cancel, absent, partial, ...) keeps respecting the same starting point.

ALTER TABLE class_series
  ADD COLUMN IF NOT EXISTS starting_lesson_id UUID REFERENCES curriculum_lessons(id) ON DELETE SET NULL;
