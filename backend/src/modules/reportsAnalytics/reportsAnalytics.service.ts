import { pool } from "../../db/pool.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, getPaginationMeta } from "../../utils/pagination.js";

type CurriculumStatus = "active" | "inactive";

// ---------------------------------------------------------------------------------------------
// Curriculum analytics: structural counts only (courses/modules/classes/teacher access).
// Student/teacher progress metrics belong to the other Reports & Analytics sections, not here.
// ---------------------------------------------------------------------------------------------

type CurriculumSummaryRow = {
  total_courses: string;
  total_modules: string;
  active_modules: string;
  inactive_modules: string;
  total_classes: string;
};

export async function getCurriculumSummary() {
  const result = await pool.query<CurriculumSummaryRow>(`
    SELECT
      (SELECT COUNT(*) FROM curriculum_courses)::TEXT AS total_courses,
      (SELECT COUNT(*) FROM curriculum_modules)::TEXT AS total_modules,
      (SELECT COUNT(*) FROM curriculum_modules WHERE status = 'active')::TEXT AS active_modules,
      (SELECT COUNT(*) FROM curriculum_modules WHERE status = 'inactive')::TEXT AS inactive_modules,
      (SELECT COUNT(*) FROM classes WHERE curriculum_lesson_id IS NOT NULL)::TEXT AS total_classes
  `);
  const row = result.rows[0];
  return {
    totalCourses: Number(row.total_courses),
    totalModules: Number(row.total_modules),
    activeModules: Number(row.active_modules),
    inactiveModules: Number(row.inactive_modules),
    totalClasses: Number(row.total_classes)
  };
}

type FilterCourseRow = { id: string; name: string };
type FilterModuleRow = { id: string; name: string; course_id: string; status: CurriculumStatus };

export async function getCurriculumFilters() {
  const [courses, modules] = await Promise.all([
    pool.query<FilterCourseRow>(`SELECT id, name FROM curriculum_courses ORDER BY LOWER(name)`),
    pool.query<FilterModuleRow>(`SELECT id, name, course_id, status FROM curriculum_modules ORDER BY LOWER(name)`)
  ]);
  return {
    courses: courses.rows.map((course) => ({ id: course.id, name: course.name })),
    modules: modules.rows.map((module) => ({ id: module.id, name: module.name, courseId: module.course_id, status: module.status }))
  };
}

type ModuleAnalyticsRow = {
  module_id: string;
  module_name: string;
  module_status: CurriculumStatus;
  course_id: string;
  course_name: string;
  classes_count: string;
  teachers_assigned_count: string;
};

const moduleSortColumns: Record<string, string> = {
  courseName: "LOWER(c.name), m.sort_order",
  moduleName: "LOWER(m.name)",
  classesDesc: "classes_count DESC, LOWER(c.name)",
  teachersDesc: "teachers_assigned_count DESC, LOWER(c.name)"
};

export async function listCurriculumModuleAnalytics(query: {
  courseId?: string;
  moduleId?: string;
  status?: "all" | CurriculumStatus;
  sort?: string;
}) {
  const orderBy = moduleSortColumns[query.sort ?? "courseName"] ?? moduleSortColumns.courseName;
  const result = await pool.query<ModuleAnalyticsRow>(
    `
      SELECT
        m.id AS module_id, m.name AS module_name, m.status AS module_status,
        c.id AS course_id, c.name AS course_name,
        COUNT(DISTINCT cl.id)::TEXT AS classes_count,
        COUNT(DISTINCT tma.teacher_id) FILTER (WHERE tma.is_active)::TEXT AS teachers_assigned_count
      FROM curriculum_modules m
      JOIN curriculum_courses c ON c.id = m.course_id
      LEFT JOIN curriculum_lessons l ON l.module_id = m.id
      LEFT JOIN classes cl ON cl.curriculum_lesson_id = l.id
      LEFT JOIN teacher_module_access tma ON tma.module_id = m.id
      WHERE ($1::UUID IS NULL OR c.id = $1::UUID)
        AND ($2::UUID IS NULL OR m.id = $2::UUID)
        AND ($3 = 'all' OR m.status = $3::curriculum_status)
      GROUP BY m.id, c.id
      ORDER BY ${orderBy}
    `,
    [query.courseId ?? null, query.moduleId ?? null, query.status ?? "all"]
  );
  return result.rows.map((row) => ({
    moduleId: row.module_id,
    moduleName: row.module_name,
    status: row.module_status,
    courseId: row.course_id,
    courseName: row.course_name,
    classesCount: Number(row.classes_count),
    teachersAssignedCount: Number(row.teachers_assigned_count)
  }));
}

type ModuleTeacherClassRow = {
  teacher_id: string;
  teacher_name: string;
  assigned_at: Date;
  class_id: string | null;
  class_status: string | null;
  start_time: Date | null;
  lesson_number: number | null;
  lesson_title: string | null;
  student_id: string | null;
  student_name: string | null;
};

export async function getModuleTeacherProgress(moduleId: string) {
  const result = await pool.query<ModuleTeacherClassRow>(
    `
      SELECT
        tma.teacher_id, BTRIM(CONCAT(u.first_name, ' ', u.last_name)) AS teacher_name, tma.granted_at AS assigned_at,
        c.id AS class_id, c.status AS class_status, c.start_time,
        cl.lesson_number, cl.title AS lesson_title,
        cp.student_id, BTRIM(CONCAT(su.first_name, ' ', su.last_name)) AS student_name
      FROM teacher_module_access tma
      JOIN users u ON u.id = tma.teacher_id
      LEFT JOIN classes c ON c.teacher_id = tma.teacher_id
        AND c.curriculum_lesson_id IN (SELECT id FROM curriculum_lessons WHERE module_id = $1)
      LEFT JOIN curriculum_lessons cl ON cl.id = c.curriculum_lesson_id
      LEFT JOIN class_participants cp ON cp.class_id = c.id
      LEFT JOIN users su ON su.id = cp.student_id
      WHERE tma.module_id = $1 AND tma.is_active = TRUE
      ORDER BY LOWER(u.first_name), LOWER(u.last_name), c.start_time
    `,
    [moduleId]
  );

  type TeacherGroup = {
    teacherId: string;
    teacherName: string;
    assignedAt: Date;
    classIds: Set<string>;
    completedClassIds: Set<string>;
    scheduledClasses: {
      classId: string;
      lessonNumber: number | null;
      lessonTitle: string | null;
      studentName: string | null;
      status: string;
      startTime: Date;
    }[];
  };

  const groups = new Map<string, TeacherGroup>();
  for (const row of result.rows) {
    let group = groups.get(row.teacher_id);
    if (!group) {
      group = { teacherId: row.teacher_id, teacherName: row.teacher_name, assignedAt: row.assigned_at, classIds: new Set(), completedClassIds: new Set(), scheduledClasses: [] };
      groups.set(row.teacher_id, group);
    }
    if (row.class_id) {
      group.classIds.add(row.class_id);
      if (row.class_status === "completed") group.completedClassIds.add(row.class_id);
      group.scheduledClasses.push({
        classId: row.class_id,
        lessonNumber: row.lesson_number,
        lessonTitle: row.lesson_title,
        studentName: row.student_name,
        status: row.class_status as string,
        startTime: row.start_time as Date
      });
    }
  }

  return {
    teachers: Array.from(groups.values()).map((group) => ({
      teacherId: group.teacherId,
      teacherName: group.teacherName,
      assignedAt: group.assignedAt,
      classesScheduled: group.classIds.size,
      classesCompleted: group.completedClassIds.size,
      scheduledClasses: group.scheduledClasses
    }))
  };
}

// ---------------------------------------------------------------------------------------------
// Homework analytics: admin-wide view of every student's homework lifecycle. Mirrors the status
// derivation in modules/homework/homework.service.ts (overdue is never stored, always derived).
// ---------------------------------------------------------------------------------------------

type HomeworkStatusEnum = "assigned" | "submitted" | "needs_revision" | "completed";
type HomeworkDisplayStatus = "pending" | "pending_review" | "revision_required" | "completed" | "overdue";
type HomeworkStatusFilter = "all" | HomeworkDisplayStatus;
type HomeworkTypeFilter = "all" | "curriculum" | "custom";

type HomeworkAnalyticsSummaryRow = {
  total_assigned: string;
  pending: string;
  pending_review: string;
  revision_required: string;
  completed: string;
  overdue: string;
};

export async function getHomeworkAnalyticsSummary() {
  const result = await pool.query<HomeworkAnalyticsSummaryRow>(`
    SELECT
      COUNT(*)::TEXT AS total_assigned,
      COUNT(*) FILTER (WHERE status = 'assigned')::TEXT AS pending,
      COUNT(*) FILTER (WHERE status = 'submitted')::TEXT AS pending_review,
      COUNT(*) FILTER (WHERE status = 'needs_revision')::TEXT AS revision_required,
      COUNT(*) FILTER (WHERE status = 'completed')::TEXT AS completed,
      COUNT(*) FILTER (WHERE status IN ('assigned', 'needs_revision') AND due_date < NOW())::TEXT AS overdue
    FROM homework
  `);
  const row = result.rows[0];
  return {
    totalAssigned: Number(row.total_assigned),
    pending: Number(row.pending),
    pendingReview: Number(row.pending_review),
    revisionRequired: Number(row.revision_required),
    completed: Number(row.completed),
    overdue: Number(row.overdue)
  };
}

type HomeworkFilterPersonRow = { id: string; name: string };
type HomeworkFilterCourseRow = { id: string; name: string };
type HomeworkFilterModuleRow = { id: string; name: string; course_id: string };
type HomeworkFilterLessonRow = { id: string; module_id: string; lesson_number: number; title: string };

export async function getHomeworkAnalyticsFilters() {
  const [students, teachers, courses, modules, lessons] = await Promise.all([
    pool.query<HomeworkFilterPersonRow>(
      `SELECT DISTINCT u.id, BTRIM(CONCAT(u.first_name, ' ', u.last_name)) AS name
       FROM homework h JOIN users u ON u.id = h.student_id ORDER BY name`
    ),
    pool.query<HomeworkFilterPersonRow>(
      `SELECT DISTINCT u.id, BTRIM(CONCAT(u.first_name, ' ', u.last_name)) AS name
       FROM homework h JOIN users u ON u.id = h.teacher_id ORDER BY name`
    ),
    pool.query<HomeworkFilterCourseRow>(
      `SELECT DISTINCT co.id, co.name
       FROM homework h
       JOIN curriculum_lessons cl ON cl.id = h.curriculum_lesson_id
       JOIN curriculum_modules m ON m.id = cl.module_id
       JOIN curriculum_courses co ON co.id = m.course_id
       ORDER BY co.name`
    ),
    pool.query<HomeworkFilterModuleRow>(
      `SELECT DISTINCT m.id, m.name, m.course_id
       FROM homework h
       JOIN curriculum_lessons cl ON cl.id = h.curriculum_lesson_id
       JOIN curriculum_modules m ON m.id = cl.module_id
       ORDER BY m.name`
    ),
    pool.query<HomeworkFilterLessonRow>(
      `SELECT DISTINCT cl.id, cl.module_id, cl.lesson_number, cl.title
       FROM homework h
       JOIN curriculum_lessons cl ON cl.id = h.curriculum_lesson_id
       ORDER BY cl.lesson_number`
    )
  ]);
  return {
    students: students.rows.map((row) => ({ id: row.id, name: row.name })),
    teachers: teachers.rows.map((row) => ({ id: row.id, name: row.name })),
    courses: courses.rows.map((row) => ({ id: row.id, name: row.name })),
    modules: modules.rows.map((row) => ({ id: row.id, name: row.name, courseId: row.course_id })),
    lessons: lessons.rows.map((row) => ({ id: row.id, moduleId: row.module_id, lessonNumber: row.lesson_number, title: row.title }))
  };
}

const homeworkSortColumns: Record<string, string> = {
  assignedDesc: "h.created_at DESC",
  assignedAsc: "h.created_at ASC",
  dueDateAsc: "h.due_date ASC NULLS LAST",
  dueDateDesc: "h.due_date DESC NULLS LAST",
  studentName: "LOWER(su.first_name), LOWER(su.last_name)"
};

type HomeworkAssignmentRow = {
  id: string;
  title: string;
  homework_type: string;
  status: HomeworkStatusEnum;
  due_date: Date | null;
  max_points: number | null;
  created_at: Date;
  completed_at: Date | null;
  student_id: string;
  student_name: string;
  teacher_id: string;
  teacher_name: string;
  course_name: string | null;
  module_name: string | null;
  lesson_number: number | null;
  lesson_title: string | null;
  attempts: string;
  latest_points: string | null;
};

function mapHomeworkAssignmentRow(row: HomeworkAssignmentRow) {
  const isOverdue = Boolean(row.due_date && row.due_date.getTime() < Date.now() && (row.status === "assigned" || row.status === "needs_revision"));
  const displayStatus: HomeworkDisplayStatus = isOverdue
    ? "overdue"
    : row.status === "assigned"
      ? "pending"
      : row.status === "submitted"
        ? "pending_review"
        : row.status === "needs_revision"
          ? "revision_required"
          : "completed";

  return {
    id: row.id,
    title: row.title,
    homeworkType: row.homework_type,
    status: row.status,
    displayStatus,
    isOverdue,
    studentId: row.student_id,
    studentName: row.student_name,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    courseName: row.course_name,
    moduleName: row.module_name,
    lessonNumber: row.lesson_number,
    lessonTitle: row.lesson_title,
    assignedAt: row.created_at,
    dueDate: row.due_date,
    maxPoints: row.max_points,
    latestPoints: row.latest_points === null ? null : Number(row.latest_points),
    attempts: Number(row.attempts),
    completedAt: row.completed_at
  };
}

const homeworkAssignmentsFromClause = `
  FROM homework h
  JOIN users su ON su.id = h.student_id
  JOIN users tu ON tu.id = h.teacher_id
  LEFT JOIN curriculum_lessons cl ON cl.id = h.curriculum_lesson_id
  LEFT JOIN curriculum_modules m ON m.id = cl.module_id
  LEFT JOIN curriculum_courses co ON co.id = m.course_id
`;

const homeworkAssignmentsWhereClause = `
  WHERE ($1 = '' OR h.title ILIKE '%' || $1 || '%' OR su.first_name ILIKE '%' || $1 || '%' OR su.last_name ILIKE '%' || $1 || '%')
    AND ($2::UUID IS NULL OR h.student_id = $2::UUID)
    AND ($3::UUID IS NULL OR h.teacher_id = $3::UUID)
    AND ($4::UUID IS NULL OR co.id = $4::UUID)
    AND ($5::UUID IS NULL OR m.id = $5::UUID)
    AND ($6::UUID IS NULL OR cl.id = $6::UUID)
    AND ($7::TEXT IS NULL OR h.homework_type = $7)
    AND ($8::TIMESTAMPTZ IS NULL OR h.created_at >= $8::TIMESTAMPTZ)
    AND ($9::TIMESTAMPTZ IS NULL OR h.created_at <= $9::TIMESTAMPTZ)
    AND ($10 = 'all' OR (CASE $10 WHEN 'pending' THEN h.status = 'assigned'
                                  WHEN 'pending_review' THEN h.status = 'submitted'
                                  WHEN 'revision_required' THEN h.status = 'needs_revision'
                                  WHEN 'completed' THEN h.status = 'completed'
                                  WHEN 'overdue' THEN h.status IN ('assigned', 'needs_revision') AND h.due_date < NOW()
                                  ELSE TRUE END))
`;

export async function listHomeworkAssignments(query: {
  search?: string;
  status?: HomeworkStatusFilter;
  studentId?: string;
  teacherId?: string;
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  homeworkType?: HomeworkTypeFilter;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  page?: number;
  limit?: number;
}) {
  const { page, limit, offset } = getPagination({ page: query.page, limit: query.limit });
  const orderBy = homeworkSortColumns[query.sort ?? "assignedDesc"] ?? homeworkSortColumns.assignedDesc;

  const values: unknown[] = [
    query.search?.trim() || "",
    query.studentId ?? null,
    query.teacherId ?? null,
    query.courseId ?? null,
    query.moduleId ?? null,
    query.lessonId ?? null,
    query.homeworkType && query.homeworkType !== "all" ? query.homeworkType : null,
    query.dateFrom ?? null,
    query.dateTo ?? null,
    query.status ?? "all"
  ];

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count ${homeworkAssignmentsFromClause} ${homeworkAssignmentsWhereClause}`,
    values
  );
  const total = Number(countResult.rows[0].count);

  const result = await pool.query<HomeworkAssignmentRow>(
    `
      SELECT h.id, h.title, h.homework_type, h.status, h.due_date, h.max_points, h.created_at, h.completed_at,
             h.student_id, BTRIM(CONCAT(su.first_name, ' ', su.last_name)) AS student_name,
             h.teacher_id, BTRIM(CONCAT(tu.first_name, ' ', tu.last_name)) AS teacher_name,
             co.name AS course_name, m.name AS module_name, cl.lesson_number, cl.title AS lesson_title,
             (SELECT COUNT(*) FROM homework_submissions s WHERE s.homework_id = h.id)::TEXT AS attempts,
             (SELECT s.points_awarded FROM homework_submissions s
               WHERE s.homework_id = h.id AND s.points_awarded IS NOT NULL ORDER BY s.attempt_number DESC LIMIT 1)::TEXT AS latest_points
      ${homeworkAssignmentsFromClause}
      ${homeworkAssignmentsWhereClause}
      ORDER BY ${orderBy}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  return { items: result.rows.map(mapHomeworkAssignmentRow), pagination: getPaginationMeta(page, limit, total) };
}

type HomeworkAssignmentDetailRow = HomeworkAssignmentRow & {
  description: string | null;
  submission_type: string;
};

type HomeworkSubmissionRow = {
  id: string;
  attempt_number: number;
  submission_text: string | null;
  submission_link: string | null;
  student_comment: string | null;
  status: string;
  submitted_at: Date;
  teacher_feedback: string | null;
  points_awarded: string | null;
  reviewed_at: Date | null;
  reviewer_name: string | null;
};

type HomeworkSubmissionFileRow = {
  id: string;
  submission_id: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: string | null;
};

export async function getHomeworkAssignmentDetail(id: string) {
  const assignmentResult = await pool.query<HomeworkAssignmentDetailRow>(
    `
      SELECT h.id, h.title, h.description, h.homework_type, h.status, h.due_date, h.max_points, h.submission_type,
             h.created_at, h.completed_at,
             h.student_id, BTRIM(CONCAT(su.first_name, ' ', su.last_name)) AS student_name,
             h.teacher_id, BTRIM(CONCAT(tu.first_name, ' ', tu.last_name)) AS teacher_name,
             co.name AS course_name, m.name AS module_name, cl.lesson_number, cl.title AS lesson_title,
             (SELECT COUNT(*) FROM homework_submissions s WHERE s.homework_id = h.id)::TEXT AS attempts,
             (SELECT s.points_awarded FROM homework_submissions s
               WHERE s.homework_id = h.id AND s.points_awarded IS NOT NULL ORDER BY s.attempt_number DESC LIMIT 1)::TEXT AS latest_points
      ${homeworkAssignmentsFromClause}
      WHERE h.id = $1
    `,
    [id]
  );
  const row = assignmentResult.rows[0];
  if (!row) return null;

  const submissionsResult = await pool.query<HomeworkSubmissionRow>(
    `
      SELECT s.id, s.attempt_number, s.submission_text, s.submission_link, s.student_comment, s.status, s.submitted_at,
             s.teacher_feedback, s.points_awarded::TEXT AS points_awarded, s.reviewed_at,
             BTRIM(CONCAT(ru.first_name, ' ', ru.last_name)) AS reviewer_name
      FROM homework_submissions s
      LEFT JOIN users ru ON ru.id = s.reviewed_by_teacher_id
      WHERE s.homework_id = $1
      ORDER BY s.attempt_number ASC
    `,
    [id]
  );

  const fileRows = submissionsResult.rows.length
    ? (
        await pool.query<HomeworkSubmissionFileRow>(
          `SELECT id, submission_id, file_name, mime_type, size_bytes::TEXT AS size_bytes
           FROM homework_submission_files WHERE submission_id = ANY($1::UUID[])`,
          [submissionsResult.rows.map((submission) => submission.id)]
        )
      ).rows
    : [];

  const attempts = submissionsResult.rows.map((submission) => ({
    id: submission.id,
    attemptNumber: submission.attempt_number,
    submittedAt: submission.submitted_at,
    submissionText: submission.submission_text,
    submissionLink: submission.submission_link,
    studentComment: submission.student_comment,
    status: submission.status,
    pointsAwarded: submission.points_awarded === null ? null : Number(submission.points_awarded),
    teacherFeedback: submission.teacher_feedback,
    reviewedAt: submission.reviewed_at,
    reviewerName: submission.reviewed_at ? submission.reviewer_name : null,
    files: fileRows
      .filter((file) => file.submission_id === submission.id)
      .map((file) => ({
        id: file.id,
        fileName: file.file_name ?? "file",
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes === null ? null : Number(file.size_bytes)
      }))
  }));

  return {
    assignment: {
      ...mapHomeworkAssignmentRow(row),
      description: row.description,
      submissionType: row.submission_type
    },
    attempts
  };
}

export type StoredHomeworkFile = { storageKey: string; fileName: string; mimeType: string };

export async function getHomeworkSubmissionFile(homeworkId: string, submissionId: string, fileId: string): Promise<StoredHomeworkFile> {
  const row = (
    await pool.query<{ storage_key: string | null; file_name: string | null; mime_type: string | null }>(
      `SELECT f.storage_key, f.file_name, f.mime_type
       FROM homework_submission_files f JOIN homework_submissions s ON s.id = f.submission_id
       WHERE f.id = $1 AND s.id = $2 AND s.homework_id = $3`,
      [fileId, submissionId, homeworkId]
    )
  ).rows[0];
  if (!row?.storage_key) throw new ApiError(404, "File not found", "HOMEWORK_FILE_NOT_FOUND");
  return { storageKey: row.storage_key, fileName: row.file_name ?? "file", mimeType: row.mime_type ?? "application/octet-stream" };
}
