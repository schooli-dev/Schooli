import { pool } from "../../db/pool.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, getPaginationMeta, type PaginationMeta } from "../../utils/pagination.js";
import type { ListStudentsInput } from "./students.validation.js";

export type StudentItem = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  timezone: string;
  avatarUrl: string | null;
  status: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type StudentRow = {
  id: string;
  username: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  timezone: string;
  avatar_url: string | null;
  status: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export async function listStudents(input: ListStudentsInput): Promise<{
  students: StudentItem[];
  pagination: PaginationMeta;
}> {
  const { page, limit, offset } = getPagination(input);
  const values: unknown[] = [];
  const filters: string[] = ["r.name = 'student'"];

  if (input.search) {
    values.push(`%${input.search}%`);
    filters.push(`
      (
        u.first_name ILIKE $${values.length}
        OR u.last_name ILIKE $${values.length}
        OR u.email::TEXT ILIKE $${values.length}
        OR u.username ILIKE $${values.length}
        OR u.phone ILIKE $${values.length}
      )
    `);
  }

  if (input.status) {
    values.push(input.status);
    filters.push(`u.status = $${values.length}`);
  }

  const whereClause = `WHERE ${filters.join(" AND ")}`;
  const countResult = await pool.query<{ total: string }>(
    `
      SELECT COUNT(DISTINCT u.id) AS total
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      ${whereClause}
    `,
    values
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(limit, offset);
  const result = await pool.query<StudentRow>(
    `
      ${baseStudentSelect()}
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    students: result.rows.map(mapStudent),
    pagination: getPaginationMeta(page, limit, total)
  };
}

export type CurriculumLessonState = "done" | "current" | "upcoming";

export type MyStudentCurriculum = {
  student: { id: string; name: string };
  course: { name: string };
  module: { id: string; name: string; sortOrder: number };
  currentLessonId: string | null;
  lessons: Array<{ id: string; lessonNumber: number; title: string; description: string | null; state: CurriculumLessonState }>;
  nextClass: { id: string; startTime: Date; timezone: string } | null;
};

export type MyStudentItem = {
  studentId: string;
  studentName: string;
  courseName: string | null;
  moduleId: string | null;
  moduleName: string | null;
  moduleSortOrder: number | null;
  currentLesson: { id: string; lessonNumber: number; title: string } | null;
  moduleCompleted: boolean;
};

type PairRow = { student_id: string; first_name: string; last_name: string; module_id: string | null };

/**
 * A student's own position in a module. Position is per student (curriculum_progress), never
 * per teacher: "done" = completed lessons (plus lessons before the series starting class),
 * "current" = the lesson of the student's next upcoming class with this teacher, else the
 * first lesson not yet done.
 */
async function getStudentModuleProgress(teacherId: string, studentId: string, moduleId: string) {
  const moduleResult = await pool.query<{ module_name: string; module_sort_order: number; course_name: string }>(
    `SELECT m.name AS module_name, m.sort_order AS module_sort_order, c.name AS course_name
     FROM curriculum_modules m JOIN curriculum_courses c ON c.id = m.course_id WHERE m.id = $1`,
    [moduleId]
  );
  const moduleRow = moduleResult.rows[0];
  if (!moduleRow) return null;

  const lessons = (await pool.query<{ id: string; lesson_number: number; title: string; description: string | null; sort_order: number }>(
    `SELECT id, lesson_number, title, description, sort_order
     FROM curriculum_lessons WHERE module_id = $1 AND status = 'active' ORDER BY sort_order ASC`,
    [moduleId]
  )).rows;

  const completed = new Set(
    (await pool.query<{ curriculum_lesson_id: string }>(
      `SELECT curriculum_lesson_id FROM curriculum_progress
       WHERE student_id = $1 AND status = 'completed' AND curriculum_lesson_id = ANY($2::UUID[])`,
      [studentId, lessons.map((lesson) => lesson.id)]
    )).rows.map((row) => row.curriculum_lesson_id)
  );

  // Lessons before the latest series starting class were covered by an earlier series.
  const startOrder = (await pool.query<{ sort_order: number }>(
    `SELECT cl.sort_order
     FROM class_series cs JOIN curriculum_lessons cl ON cl.id = cs.starting_lesson_id
     WHERE cs.student_id = $1 AND cs.curriculum_module_id = $2
     ORDER BY cs.created_at DESC LIMIT 1`,
    [studentId, moduleId]
  )).rows[0]?.sort_order ?? 0;

  const next = (await pool.query<{ id: string; start_time: Date; timezone: string; curriculum_lesson_id: string | null }>(
    `SELECT c.id, c.start_time, c.timezone, c.curriculum_lesson_id
     FROM classes c
     JOIN class_participants cp ON cp.class_id = c.id
     JOIN class_series cs ON cs.id = c.class_series_id
     WHERE c.teacher_id = $1 AND cp.student_id = $2 AND cs.curriculum_module_id = $3
       AND c.status IN ('scheduled', 'rescheduled', 'live') AND c.end_time >= NOW()
     ORDER BY c.start_time ASC LIMIT 1`,
    [teacherId, studentId, moduleId]
  )).rows[0] ?? null;

  const isDone = (lesson: { id: string; sort_order: number }) => completed.has(lesson.id) || lesson.sort_order < startOrder;
  const currentLessonId =
    next?.curriculum_lesson_id && lessons.some((lesson) => lesson.id === next.curriculum_lesson_id)
      ? next.curriculum_lesson_id
      : lessons.find((lesson) => !isDone(lesson))?.id ?? null;

  return {
    moduleRow,
    nextClass: next ? { id: next.id, startTime: next.start_time, timezone: next.timezone } : null,
    currentLessonId,
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      lessonNumber: lesson.lesson_number,
      title: lesson.title,
      description: lesson.description,
      state: (lesson.id === currentLessonId ? "current" : isDone(lesson) ? "done" : "upcoming") as CurriculumLessonState
    }))
  };
}

/** Student/module pairs for a teacher: non-cancelled classes (any series) + active assignments. */
async function listTeacherStudentPairs(teacherId: string): Promise<PairRow[]> {
  const result = await pool.query<PairRow>(
    `
      SELECT u.id AS student_id, u.first_name, u.last_name, pair.module_id
      FROM users u
      JOIN (
        SELECT cp.student_id, cs.curriculum_module_id AS module_id
        FROM classes c
        JOIN class_participants cp ON cp.class_id = c.id
        LEFT JOIN class_series cs ON cs.id = c.class_series_id
        WHERE c.teacher_id = $1 AND c.status <> 'cancelled'
        UNION
        SELECT tsa.student_id, NULL::UUID
        FROM teacher_student_assignments tsa
        WHERE tsa.teacher_id = $1 AND tsa.status = 'active'
      ) pair ON pair.student_id = u.id
      WHERE u.is_active = TRUE AND u.status = 'active'
      ORDER BY u.first_name ASC, u.last_name ASC
    `,
    [teacherId]
  );
  return result.rows;
}

/**
 * "My Students" for a teacher: one row per student and module they are being taught, each
 * with that student's own course / module / current curriculum class. Derived live from
 * classes, so a student appears the moment a class is scheduled.
 */
export async function listMyStudents(teacherId: string): Promise<MyStudentItem[]> {
  const pairs = await listTeacherStudentPairs(teacherId);
  const studentsWithModule = new Set(pairs.filter((pair) => pair.module_id).map((pair) => pair.student_id));
  // A student with a curriculum module does not also need a "no curriculum" placeholder row.
  const rows = pairs.filter((pair) => pair.module_id || !studentsWithModule.has(pair.student_id));

  const items: MyStudentItem[] = [];
  for (const row of rows) {
    const studentName = `${row.first_name} ${row.last_name}`.trim();
    const progress = row.module_id ? await getStudentModuleProgress(teacherId, row.student_id, row.module_id) : null;
    const current = progress?.lessons.find((lesson) => lesson.id === progress.currentLessonId) ?? null;
    items.push({
      studentId: row.student_id,
      studentName,
      courseName: progress?.moduleRow.course_name ?? null,
      moduleId: row.module_id,
      moduleName: progress?.moduleRow.module_name ?? null,
      moduleSortOrder: progress?.moduleRow.module_sort_order ?? null,
      currentLesson: current ? { id: current.id, lessonNumber: current.lessonNumber, title: current.title } : null,
      moduleCompleted: Boolean(progress && progress.lessons.length > 0 && !progress.currentLessonId)
    });
  }
  return items;
}

/**
 * One student's own curriculum progress for a module ("Open Curriculum"). The module comes from
 * moduleId, or from the module of lessonId (when opened from a scheduled class), or falls back
 * to the student's first module with this teacher.
 */
export async function getMyStudentCurriculum(
  teacherId: string,
  studentId: string,
  query: { moduleId?: string; lessonId?: string }
): Promise<MyStudentCurriculum> {
  const pairs = (await listTeacherStudentPairs(teacherId)).filter((pair) => pair.student_id === studentId);
  if (!pairs.length) {
    throw new ApiError(404, "Student not found", "STUDENT_NOT_FOUND");
  }

  let moduleId = query.moduleId ?? null;
  if (!moduleId && query.lessonId) {
    const lesson = await pool.query<{ module_id: string }>(`SELECT module_id FROM curriculum_lessons WHERE id = $1`, [query.lessonId]);
    moduleId = lesson.rows[0]?.module_id ?? null;
  }
  moduleId ??= pairs.find((pair) => pair.module_id)?.module_id ?? null;

  if (!moduleId || !pairs.some((pair) => pair.module_id === moduleId)) {
    throw new ApiError(404, "No curriculum found for this student", "STUDENT_CURRICULUM_NOT_FOUND");
  }

  const progress = await getStudentModuleProgress(teacherId, studentId, moduleId);
  if (!progress) {
    throw new ApiError(404, "No curriculum found for this student", "STUDENT_CURRICULUM_NOT_FOUND");
  }

  return {
    student: { id: studentId, name: `${pairs[0].first_name} ${pairs[0].last_name}`.trim() },
    course: { name: progress.moduleRow.course_name },
    module: { id: moduleId, name: progress.moduleRow.module_name, sortOrder: progress.moduleRow.module_sort_order },
    currentLessonId: progress.currentLessonId,
    lessons: progress.lessons,
    nextClass: progress.nextClass
  };
}

export async function getStudentById(id: string): Promise<StudentItem> {
  const result = await pool.query<StudentRow>(
    `
      ${baseStudentSelect()}
      WHERE u.id = $1
        AND r.name = 'student'
    `,
    [id]
  );

  const student = result.rows[0];

  if (!student) {
    throw new ApiError(404, "Student not found", "STUDENT_NOT_FOUND");
  }

  return mapStudent(student);
}

function baseStudentSelect(): string {
  return `
    SELECT DISTINCT
      u.id,
      u.username,
      u.first_name,
      u.last_name,
      u.email,
      u.phone,
      u.timezone,
      u.avatar_url,
      u.status,
      u.is_active,
      u.created_at,
      u.updated_at
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
  `;
}

function mapStudent(row: StudentRow): StudentItem {
  return {
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    timezone: row.timezone,
    avatarUrl: row.avatar_url,
    status: row.status,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
