import type { PoolClient } from "pg";

/** Either a transaction-bound PoolClient or the shared pool itself - both expose .query(). */
export type Queryable = Pick<PoolClient, "query">;

/**
 * Curriculum linkage for a class_series: each occurrence maps 1:1 to a Module's ordered
 * curriculum_lessons ("Curriculum Classes" - not to be confused with live `classes`).
 * `classes.series_sequence` (019) is the occurrence's fixed-forever identity;
 * `classes.curriculum_lesson_id` is the part that shifts here.
 *
 * `recalcRemainingCurriculumMappings` is the single reusable entry point for every trigger
 * that can change which lesson an occurrence should teach: series creation (nothing is
 * consumed yet, so it performs the initial assignment), a Present+Completed attendance mark
 * (locks a lesson in as consumed), Present+Partially Completed, Present+Continue Next Class,
 * Absent, and any cancellation or reschedule of a future occurrence. It is intentionally
 * idempotent and safe to call after any of these - callers never special-case the mapping
 * logic themselves.
 *
 * Rule: a class's mapped lesson is "consumed" (locked, kept) only when its attendance is
 * `present` with academic_outcome `completed` (and it was not cancelled). Every other
 * class in the series - not yet happened, cancelled, absent, or present-but-partial/continue -
 * is "open" and eligible to receive the next unconsumed lesson, walked in series_sequence
 * order. Only future-facing statuses (`scheduled`, `rescheduled`) actually receive a new
 * lesson assignment; classes that already happened keep whatever they had as their record,
 * even if that lesson goes on to be reassigned to a later occurrence.
 */

type LessonRow = { id: string; title: string; description: string | null; sort_order: number };
type SeriesClassRow = {
  id: string;
  series_sequence: number;
  status: string;
  curriculum_lesson_id: string | null;
  title_is_custom: boolean;
  student_id: string | null;
  attendance_status: string | null;
  academic_outcome: string | null;
};

/**
 * The module's active curriculum classes in teaching order. With `startingLessonId`, only that
 * lesson and the ones after it (by sort_order) are returned - lessons before it are treated as
 * already covered by an earlier series.
 */
export async function getModuleLessonsOrdered(
  client: Queryable,
  moduleId: string,
  startingLessonId: string | null = null
): Promise<LessonRow[]> {
  const result = await client.query<LessonRow>(
    `SELECT id, title, description, sort_order
     FROM curriculum_lessons
     WHERE module_id = $1 AND status = 'active'
       AND ($2::UUID IS NULL OR sort_order >= (SELECT sort_order FROM curriculum_lessons WHERE id = $2::UUID))
     ORDER BY sort_order ASC`,
    [moduleId, startingLessonId]
  );
  return result.rows;
}

export function genericOccurrenceTitle(sequence: number): string {
  return `Class ${sequence} Scheduled`;
}

/** Title for an occurrence mapped to a curriculum lesson, e.g. "Class 1 - Introduction to RESTful APIs". */
export function mappedOccurrenceTitle(sequence: number, lessonTitle: string): string {
  return `Class ${sequence} - ${lessonTitle}`;
}

export async function recalcRemainingCurriculumMappings(client: Queryable, classSeriesId: string): Promise<void> {
  const seriesResult = await client.query<{ curriculum_module_id: string | null; starting_lesson_id: string | null }>(
    `SELECT curriculum_module_id, starting_lesson_id FROM class_series WHERE id = $1`,
    [classSeriesId]
  );
  const moduleId = seriesResult.rows[0]?.curriculum_module_id ?? null;
  if (!moduleId) return; // Not a curriculum-linked series; nothing to map.

  const lessons = await getModuleLessonsOrdered(client, moduleId, seriesResult.rows[0]?.starting_lesson_id ?? null);

  const classesResult = await client.query<SeriesClassRow>(
    `SELECT c.id, c.series_sequence, c.status, c.curriculum_lesson_id, c.title_is_custom,
            ca.student_id, ca.status AS attendance_status, ca.academic_outcome
     FROM classes c
     LEFT JOIN class_attendance ca ON ca.class_id = c.id
     WHERE c.class_series_id = $1
     ORDER BY c.series_sequence ASC NULLS LAST`,
    [classSeriesId]
  );
  const seriesClasses = classesResult.rows;

  // The teacher records what happened while the meeting is still running, so attendance decides
  // this - not the class status, which only flips to completed when the room is ended.
  const consumedLessonIds = new Set(
    seriesClasses
      .filter((row) => row.status !== "cancelled" && row.attendance_status === "present" && row.academic_outcome === "completed")
      .map((row) => row.curriculum_lesson_id)
      .filter((id): id is string => Boolean(id))
  );

  const pool = lessons.filter((lesson) => !consumedLessonIds.has(lesson.id));
  let poolIndex = 0;

  for (const row of seriesClasses) {
    if (row.status !== "scheduled" && row.status !== "rescheduled") continue; // Only future-facing occurrences get (re)assigned.
    // Attendance already recorded (Present/Absent/...): the session happened. It keeps its lesson as
    // history even if its status has not flipped yet, so it must not absorb a lesson from the pool.
    if (row.attendance_status && row.attendance_status !== "pending") continue;

    const lesson = pool[poolIndex] ?? null;
    if (lesson) poolIndex += 1;

    const nextLessonId = lesson?.id ?? null;
    if (nextLessonId === row.curriculum_lesson_id) continue; // Already correct; avoid a no-op write.

    if (row.title_is_custom) {
      await client.query(`UPDATE classes SET curriculum_lesson_id = $1, updated_at = NOW() WHERE id = $2`, [nextLessonId, row.id]);
    } else {
      const title = lesson ? mappedOccurrenceTitle(row.series_sequence, lesson.title) : genericOccurrenceTitle(row.series_sequence);
      const notes = lesson ? lesson.description : null;
      await client.query(
        `UPDATE classes SET curriculum_lesson_id = $1, title = $2, notes = $3, updated_at = NOW() WHERE id = $4`,
        [nextLessonId, title, notes, row.id]
      );
    }
  }
}

/**
 * Reads back a student's rollup progress for a specific lesson, used by the "Continue From
 * Previous Class" banner on the next session's Mark Attendance dialog. Scoped strictly per
 * student: the same lesson taught to a different student has its own independent row.
 */
export async function getCurriculumProgressForLesson(
  client: Queryable,
  studentId: string,
  curriculumLessonId: string
): Promise<{
  status: string;
  lessonTitle: string;
  taughtSummary: string | null;
  continueSummary: string | null;
  teacherNotes: string | null;
} | null> {
  const result = await client.query<{
    status: string;
    lesson_title: string;
    taught_summary: string | null;
    continue_summary: string | null;
    teacher_notes: string | null;
  }>(
    `SELECT cp.status, cl.title AS lesson_title, ca.taught_summary, ca.continue_summary, ca.teacher_notes
     FROM curriculum_progress cp
     JOIN curriculum_lessons cl ON cl.id = cp.curriculum_lesson_id
     LEFT JOIN class_attendance ca ON ca.id = cp.last_class_attendance_id
     WHERE cp.student_id = $1 AND cp.curriculum_lesson_id = $2`,
    [studentId, curriculumLessonId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    status: row.status,
    lessonTitle: row.lesson_title,
    taughtSummary: row.taught_summary,
    continueSummary: row.continue_summary,
    teacherNotes: row.teacher_notes
  };
}

/**
 * Upserts the (student, lesson) progress rollup from a just-marked Present attendance
 * outcome. Only called for Present + an outcome (Completed/Partially Completed/Continue Next
 * Class); Absent does not change progress status, it only frees the lesson for remapping.
 */
export async function upsertCurriculumProgressFromOutcome(
  client: Queryable,
  input: { studentId: string; curriculumLessonId: string; academicOutcome: string; classAttendanceId: string }
): Promise<void> {
  const status =
    input.academicOutcome === "completed"
      ? "completed"
      : input.academicOutcome === "partially_completed"
        ? "partially_completed"
        : "continue_from_previous";

  await client.query(
    `INSERT INTO curriculum_progress (student_id, curriculum_lesson_id, status, last_class_attendance_id, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (student_id, curriculum_lesson_id)
     DO UPDATE SET status = EXCLUDED.status, last_class_attendance_id = EXCLUDED.last_class_attendance_id, updated_at = NOW()`,
    [input.studentId, input.curriculumLessonId, status, input.classAttendanceId]
  );
}
