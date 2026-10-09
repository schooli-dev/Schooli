import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import type { AuthenticatedUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { createInAppNotifications } from "../notifications/notifications.service.js";
import type { CustomHomeworkInput, ListHomeworkInput, ReviewHomeworkInput, SubmitHomeworkInput } from "./homework.validation.js";

// ---------------------------------------------------------------------------------------------
// Status model. Stored in homework.status; "overdue" is derived (never stored).
//   assigned       -> Pending          (student)
//   submitted      -> Pending Review   (teacher)  / Submitted (student)
//   needs_revision -> Revision Required (teacher) / Needs Revision (student)
//   completed      -> Completed
// Every submission is its own attempt (homework_submissions.attempt_number); nothing is overwritten.
// ---------------------------------------------------------------------------------------------

const DEFAULT_CURRICULUM_DUE_DAYS = 7;
const DEFAULT_MAX_POINTS = 10;

export type HomeworkStatus = "assigned" | "submitted" | "needs_revision" | "completed";

export type HomeworkListItem = {
  id: string;
  title: string;
  homeworkType: string;
  status: HomeworkStatus;
  isOverdue: boolean;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  courseName: string | null;
  moduleName: string | null;
  moduleSortOrder: number | null;
  lessonNumber: number | null;
  lessonTitle: string | null;
  assignedAt: Date;
  dueDate: Date | null;
  maxPoints: number | null;
  submissionType: string;
  attempts: number;
  latestPoints: number | null;
  completedAt: Date | null;
};

export type HomeworkLibraryItem = {
  id: string;
  title: string;
  instructions: string | null;
  maxPoints: number;
  submissionType: string;
  attachments: Array<{ storageKey: string; fileName: string; mimeType: string | null; sizeBytes: number | null }>;
  createdAt: Date;
};

type ListRow = {
  id: string;
  title: string;
  description: string | null;
  homework_type: string;
  status: HomeworkStatus;
  due_date: Date | null;
  max_points: number | null;
  submission_type: string;
  created_at: Date;
  completed_at: Date | null;
  student_id: string;
  student_name: string;
  teacher_id: string;
  teacher_name: string;
  class_id: string | null;
  curriculum_lesson_id: string | null;
  curriculum_material_id: string | null;
  lesson_number: number | null;
  lesson_title: string | null;
  module_name: string | null;
  module_sort_order: number | null;
  course_name: string | null;
  attempts: number;
  latest_points: string | null;
};

function formatDay(date: Date | null): string {
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";
}

// ---------------------------------------------------------------------------------------------
// Assigning homework (called from the Mark Attendance transaction)
// ---------------------------------------------------------------------------------------------

type InsertHomework = {
  teacherId: string;
  studentId: string;
  classId: string;
  lessonId: string | null;
  title: string;
  description: string | null;
  type: "custom" | "curriculum";
  dueDate: Date | null;
  maxPoints: number;
  submissionType: string;
  materialId: string | null;
};

async function insertHomework(client: PoolClient, value: InsertHomework): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO homework (teacher_id, student_id, class_id, curriculum_lesson_id, curriculum_material_id, title, description,
                           homework_type, due_date, max_points, submission_type, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'assigned')
     RETURNING id`,
    [value.teacherId, value.studentId, value.classId, value.lessonId, value.materialId, value.title, value.description, value.type, value.dueDate, value.maxPoints, value.submissionType]
  );
  const id = result.rows[0].id;

  await createInAppNotifications(
    {
      eventKey: "homework.assigned",
      recipientUserIds: [value.studentId],
      title: "New homework assigned",
      message: `${value.title}${value.dueDate ? ` is due ${formatDay(value.dueDate)}` : " has been assigned"}.`,
      linkPath: "/student/homework",
      payload: { homeworkId: id, classId: value.classId }
    },
    client
  );
  return id;
}

async function insertResources(client: PoolClient, homeworkId: string, attachments: CustomHomeworkInput["attachments"]): Promise<void> {
  for (const file of attachments) {
    await client.query(
      `INSERT INTO homework_resources (homework_id, storage_key, file_name, mime_type, size_bytes, resource_type)
       VALUES ($1, $2, $3, $4, $5, 'attachment')`,
      [homeworkId, file.storageKey, file.fileName, file.mimeType ?? null, file.sizeBytes ?? null]
    );
  }
}

async function saveToLibrary(client: PoolClient, teacherId: string, data: CustomHomeworkInput): Promise<void> {
  const library = await client.query<{ id: string }>(
    `INSERT INTO homework_library (teacher_id, title, instructions, max_points, submission_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [teacherId, data.title, data.instructions ?? null, data.maxPoints, data.submissionType]
  );
  for (const file of data.attachments) {
    await client.query(
      `INSERT INTO homework_library_resources (library_id, storage_key, file_name, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)`,
      [library.rows[0].id, file.storageKey, file.fileName, file.mimeType ?? null, file.sizeBytes ?? null]
    );
  }
}

async function updateCustomHomework(client: PoolClient, homeworkId: string, teacherId: string, data: CustomHomeworkInput): Promise<void> {
  await client.query(
    `UPDATE homework
     SET title = $2, description = $3, due_date = $4, max_points = $5, submission_type = $6, updated_at = NOW()
     WHERE id = $1`,
    [homeworkId, data.title, data.instructions ?? null, data.dueDate ? new Date(data.dueDate) : null, data.maxPoints, data.submissionType]
  );
  await client.query(`DELETE FROM homework_resources WHERE homework_id = $1`, [homeworkId]);
  await insertResources(client, homeworkId, data.attachments);
  if (data.saveToLibrary) await saveToLibrary(client, teacherId, data);
}

/** Removes homework assigned for this session that the student has not submitted yet. */
export async function deleteUnsubmittedHomeworkForClass(client: PoolClient, classId: string, studentId: string): Promise<void> {
  const removable = await client.query<{ id: string }>(
    `SELECT h.id FROM homework h
     WHERE h.class_id = $1 AND h.student_id = $2
       AND NOT EXISTS (SELECT 1 FROM homework_submissions s WHERE s.homework_id = h.id)`,
    [classId, studentId]
  );
  const ids = removable.rows.map((row) => row.id);
  if (ids.length) await client.query(`DELETE FROM homework WHERE id = ANY($1::UUID[])`, [ids]);
}

export type AttendanceHomeworkInput = {
  classId: string;
  studentId: string;
  isPresent: boolean;
  homeworkType: "none" | "curriculum" | "custom";
  materialIds: string[];
  curriculumDueDate: string | null;
  custom: CustomHomeworkInput | undefined;
  canAssign: boolean;
};

/**
 * Makes the homework for this (session, student) match what the teacher chose in Mark Attendance,
 * inside the attendance transaction - Save Attendance is the final assignment point.
 *  - none / Absent: withdraw homework that has no submission yet.
 *  - curriculum: one assignment per selected homework item of the currently mapped curriculum class.
 *  - custom: one assignment from the form (edited in place when saved again, until submitted).
 * Homework a student already submitted is never removed or changed.
 */
export async function reconcileAttendanceHomework(
  client: PoolClient,
  input: AttendanceHomeworkInput
): Promise<{ firstHomeworkId: string | null; firstMaterialId: string | null }> {
  const wantsHomework = input.isPresent && input.homeworkType !== "none";
  if (wantsHomework && !input.canAssign) {
    throw new ApiError(403, "Permission denied", "FORBIDDEN", { required: "homework.create" });
  }

  const classRow = (await client.query<{ teacher_id: string; curriculum_lesson_id: string | null }>(
    `SELECT teacher_id, curriculum_lesson_id FROM classes WHERE id = $1`,
    [input.classId]
  )).rows[0];
  if (!classRow) throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");

  const existing = (await client.query<{ id: string; homework_type: string; curriculum_material_id: string | null; has_submission: boolean }>(
    `SELECT h.id, h.homework_type, h.curriculum_material_id,
            EXISTS (SELECT 1 FROM homework_submissions s WHERE s.homework_id = h.id) AS has_submission
     FROM homework h WHERE h.class_id = $1 AND h.student_id = $2 ORDER BY h.created_at`,
    [input.classId, input.studentId]
  )).rows;

  const removeUnsubmitted = async (ids: string[]) => {
    if (ids.length) {
      await client.query(`DELETE FROM homework WHERE id = ANY($1::UUID[])`, [ids]);
    }
  };

  if (!wantsHomework) {
    await removeUnsubmitted(existing.filter((row) => !row.has_submission).map((row) => row.id));
    return { firstHomeworkId: null, firstMaterialId: null };
  }

  const lessonId = classRow.curriculum_lesson_id;

  if (input.homeworkType === "curriculum") {
    const ids = [...new Set(input.materialIds)];
    if (!ids.length) throw new ApiError(422, "Select at least one curriculum homework", "CURRICULUM_HOMEWORK_REQUIRED");

    const materials = (await client.query<{ id: string; title: string; lesson_id: string }>(
      `SELECT id, title, lesson_id FROM curriculum_materials WHERE id = ANY($1::UUID[]) AND status = 'active' AND section = 'homework'`,
      [ids]
    )).rows;
    // Only homework of the curriculum class this session is mapped to can be assigned.
    if (materials.length !== ids.length || !lessonId || materials.some((material) => material.lesson_id !== lessonId)) {
      throw new ApiError(422, "Choose homework that belongs to this session's curriculum class", "INVALID_CURRICULUM_HOMEWORK");
    }

    const due = input.curriculumDueDate ? new Date(input.curriculumDueDate) : new Date(Date.now() + DEFAULT_CURRICULUM_DUE_DAYS * 24 * 60 * 60 * 1000);
    await removeUnsubmitted(
      existing
        .filter((row) => !row.has_submission && (row.homework_type !== "curriculum" || !row.curriculum_material_id || !ids.includes(row.curriculum_material_id)))
        .map((row) => row.id)
    );

    const kept = existing.filter((row) => row.homework_type === "curriculum" && row.curriculum_material_id && ids.includes(row.curriculum_material_id));
    for (const row of kept.filter((item) => !item.has_submission)) {
      await client.query(`UPDATE homework SET due_date = $2, updated_at = NOW() WHERE id = $1`, [row.id, due]);
    }

    let firstId = kept[0]?.id ?? null;
    for (const material of materials) {
      if (kept.some((row) => row.curriculum_material_id === material.id)) continue;
      const id = await insertHomework(client, {
        teacherId: classRow.teacher_id,
        studentId: input.studentId,
        classId: input.classId,
        lessonId,
        title: material.title,
        description: null,
        type: "curriculum",
        dueDate: due,
        maxPoints: DEFAULT_MAX_POINTS,
        submissionType: "file_text",
        materialId: material.id
      });
      firstId ??= id;
    }
    return { firstHomeworkId: firstId, firstMaterialId: ids[0] };
  }

  // custom
  await removeUnsubmitted(existing.filter((row) => !row.has_submission && row.homework_type !== "custom").map((row) => row.id));
  const current = existing.find((row) => row.homework_type === "custom");

  if (input.custom) {
    if (current) {
      if (current.has_submission) {
        throw new ApiError(409, "This homework already has a submission and can no longer be changed", "HOMEWORK_ALREADY_SUBMITTED");
      }
      await updateCustomHomework(client, current.id, classRow.teacher_id, input.custom);
      return { firstHomeworkId: current.id, firstMaterialId: null };
    }

    const id = await insertHomework(client, {
      teacherId: classRow.teacher_id,
      studentId: input.studentId,
      classId: input.classId,
      lessonId,
      title: input.custom.title,
      description: input.custom.instructions ?? null,
      type: "custom",
      dueDate: input.custom.dueDate ? new Date(input.custom.dueDate) : null,
      maxPoints: input.custom.maxPoints,
      submissionType: input.custom.submissionType,
      materialId: null
    });
    await insertResources(client, id, input.custom.attachments);
    if (input.custom.saveToLibrary) await saveToLibrary(client, classRow.teacher_id, input.custom);
    return { firstHomeworkId: id, firstMaterialId: null };
  }

  if (current) return { firstHomeworkId: current.id, firstMaterialId: null };
  throw new ApiError(422, "Fill in the custom homework form, or choose another homework option", "CUSTOM_HOMEWORK_REQUIRED");
}

// ---------------------------------------------------------------------------------------------
// Listing, dashboard counts, detail
// ---------------------------------------------------------------------------------------------

function scopeCondition(user: AuthenticatedUser, values: unknown[]): string {
  if (user.roles.includes("admin") || user.roles.includes("support")) return "TRUE";
  values.push(user.id);
  return user.roles.includes("teacher") ? `h.teacher_id = $${values.length}` : `h.student_id = $${values.length}`;
}

const baseSelect = `
  SELECT h.id, h.title, h.description, h.homework_type, h.status, h.due_date, h.max_points, h.submission_type,
         h.created_at, h.completed_at, h.student_id, CONCAT(su.first_name, ' ', su.last_name) AS student_name,
         h.teacher_id, CONCAT(tu.first_name, ' ', tu.last_name) AS teacher_name,
         h.class_id, h.curriculum_lesson_id, h.curriculum_material_id,
         cl.lesson_number, cl.title AS lesson_title, m.name AS module_name, m.sort_order AS module_sort_order, co.name AS course_name,
         (SELECT COUNT(*) FROM homework_submissions s WHERE s.homework_id = h.id)::INT AS attempts,
         (SELECT s.points_awarded FROM homework_submissions s
           WHERE s.homework_id = h.id AND s.points_awarded IS NOT NULL ORDER BY s.attempt_number DESC LIMIT 1) AS latest_points
  FROM homework h
  JOIN users su ON su.id = h.student_id
  JOIN users tu ON tu.id = h.teacher_id
  LEFT JOIN curriculum_lessons cl ON cl.id = h.curriculum_lesson_id
  LEFT JOIN curriculum_modules m ON m.id = cl.module_id
  LEFT JOIN curriculum_courses co ON co.id = m.course_id
`;

function mapListRow(row: ListRow): HomeworkListItem {
  return {
    id: row.id,
    title: row.title,
    homeworkType: row.homework_type,
    status: row.status,
    isOverdue: Boolean(row.due_date && row.due_date.getTime() < Date.now() && (row.status === "assigned" || row.status === "needs_revision")),
    studentId: row.student_id,
    studentName: row.student_name,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    courseName: row.course_name,
    moduleName: row.module_name,
    moduleSortOrder: row.module_sort_order,
    lessonNumber: row.lesson_number,
    lessonTitle: row.lesson_title,
    assignedAt: row.created_at,
    dueDate: row.due_date,
    maxPoints: row.max_points,
    submissionType: row.submission_type,
    attempts: row.attempts,
    latestPoints: row.latest_points === null ? null : Number(row.latest_points),
    completedAt: row.completed_at
  };
}

const statusFilters: Record<string, string> = {
  pending: "h.status = 'assigned'",
  submitted: "h.status = 'submitted'",
  needs_revision: "h.status = 'needs_revision'",
  completed: "h.status = 'completed'",
  completed_this_week: "h.status = 'completed' AND h.completed_at >= NOW() - INTERVAL '7 days'",
  overdue: "h.status IN ('assigned', 'needs_revision') AND h.due_date < NOW()"
};

export async function listHomework(input: ListHomeworkInput, user: AuthenticatedUser): Promise<HomeworkListItem[]> {
  const values: unknown[] = [];
  const filters = [scopeCondition(user, values)];

  if (input.status !== "all") filters.push(statusFilters[input.status]);
  if (input.search) {
    values.push(`%${input.search}%`);
    filters.push(`(h.title ILIKE $${values.length} OR CONCAT(su.first_name, ' ', su.last_name) ILIKE $${values.length})`);
  }

  values.push(input.limit);
  const result = await pool.query<ListRow>(
    `${baseSelect} WHERE ${filters.join(" AND ")} ORDER BY h.created_at DESC LIMIT $${values.length}`,
    values
  );
  return result.rows.map(mapListRow);
}

/** Dashboard numbers for the signed-in user's scope (teacher cards and student tab counts). */
export async function getHomeworkSummary(user: AuthenticatedUser) {
  const values: unknown[] = [];
  const scope = scopeCondition(user, values);
  const result = await pool.query<Record<string, string>>(
    `SELECT COUNT(*) FILTER (WHERE h.status = 'assigned') AS pending,
            COUNT(*) FILTER (WHERE h.status = 'submitted') AS submitted,
            COUNT(*) FILTER (WHERE h.status = 'needs_revision') AS needs_revision,
            COUNT(*) FILTER (WHERE h.status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE ${statusFilters.completed_this_week}) AS completed_this_week,
            COUNT(*) FILTER (WHERE ${statusFilters.overdue}) AS overdue
     FROM homework h WHERE ${scope}`,
    values
  );
  const row = result.rows[0];
  return {
    pending: Number(row.pending),
    submitted: Number(row.submitted),
    needsRevision: Number(row.needs_revision),
    completed: Number(row.completed),
    completedThisWeek: Number(row.completed_this_week),
    overdue: Number(row.overdue),
    // Teacher dashboard names for the same numbers.
    pendingReview: Number(row.submitted),
    revisionRequired: Number(row.needs_revision)
  };
}

type AttemptRow = {
  id: string;
  attempt_number: number;
  status: string;
  submission_text: string | null;
  submission_link: string | null;
  student_comment: string | null;
  submitted_at: Date;
  points_awarded: string | null;
  teacher_feedback: string | null;
  reviewed_at: Date | null;
};

export async function getHomeworkDetail(user: AuthenticatedUser, id: string) {
  const values: unknown[] = [id];
  const scope = scopeCondition(user, values);
  const found = await pool.query<ListRow>(`${baseSelect} WHERE h.id = $1 AND ${scope}`, values);
  const row = found.rows[0];
  if (!row) throw new ApiError(404, "Homework not found", "HOMEWORK_NOT_FOUND");

  const [resources, material, attempts, files] = await Promise.all([
    pool.query<{ id: string; file_name: string | null; mime_type: string | null; size_bytes: string | null }>(
      `SELECT id, file_name, mime_type, size_bytes FROM homework_resources WHERE homework_id = $1 AND storage_key IS NOT NULL ORDER BY created_at`,
      [id]
    ),
    row.curriculum_material_id
      ? pool.query<{ id: string; title: string; source_type: string; file_name: string | null; mime_type: string | null; external_url: string | null }>(
          `SELECT id, title, source_type, file_name, mime_type, external_url FROM curriculum_materials WHERE id = $1`,
          [row.curriculum_material_id]
        )
      : Promise.resolve({ rows: [] as Array<{ id: string; title: string; source_type: string; file_name: string | null; mime_type: string | null; external_url: string | null }> }),
    pool.query<AttemptRow>(
      `SELECT id, attempt_number, status, submission_text, submission_link, student_comment, submitted_at, points_awarded, teacher_feedback, reviewed_at
       FROM homework_submissions WHERE homework_id = $1 ORDER BY attempt_number`,
      [id]
    ),
    pool.query<{ id: string; submission_id: string; file_name: string | null; mime_type: string | null; size_bytes: string | null }>(
      `SELECT f.id, f.submission_id, f.file_name, f.mime_type, f.size_bytes
       FROM homework_submission_files f JOIN homework_submissions s ON s.id = f.submission_id
       WHERE s.homework_id = $1 AND f.storage_key IS NOT NULL ORDER BY f.created_at`,
      [id]
    )
  ]);

  const description = (await pool.query<{ description: string | null; class_id: string | null }>(`SELECT description, class_id FROM homework WHERE id = $1`, [id])).rows[0];
  const item = mapListRow(row);
  const lastAttempt = attempts.rows[attempts.rows.length - 1];

  return {
    ...item,
    instructions: description?.description ?? null,
    classId: description?.class_id ?? null,
    document: material.rows[0]
      ? {
          title: material.rows[0].title,
          sourceType: material.rows[0].source_type,
          fileName: material.rows[0].file_name,
          mimeType: material.rows[0].mime_type,
          externalUrl: material.rows[0].external_url
        }
      : null,
    attachments: resources.rows.map((file) => ({ id: file.id, fileName: file.file_name ?? "file", mimeType: file.mime_type, sizeBytes: file.size_bytes === null ? null : Number(file.size_bytes) })),
    canSubmit: user.roles.includes("student") && (row.status === "assigned" || row.status === "needs_revision"),
    canReview: Boolean(lastAttempt && lastAttempt.status === "submitted" && row.status === "submitted"),
    attemptsDetail: attempts.rows.map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attempt_number,
      status: attempt.status,
      text: attempt.submission_text,
      link: attempt.submission_link,
      comment: attempt.student_comment,
      submittedAt: attempt.submitted_at,
      pointsAwarded: attempt.points_awarded === null ? null : Number(attempt.points_awarded),
      feedback: attempt.teacher_feedback,
      reviewedAt: attempt.reviewed_at,
      files: files.rows
        .filter((file) => file.submission_id === attempt.id)
        .map((file) => ({ id: file.id, fileName: file.file_name ?? "file", mimeType: file.mime_type, sizeBytes: file.size_bytes === null ? null : Number(file.size_bytes) }))
    }))
  };
}

// ---------------------------------------------------------------------------------------------
// Student submits (every submission is a NEW attempt)
// ---------------------------------------------------------------------------------------------

export async function submitHomework(user: AuthenticatedUser, homeworkId: string, input: SubmitHomeworkInput) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const homework = (await client.query<{
      id: string; title: string; status: HomeworkStatus; student_id: string; teacher_id: string; submission_type: string;
      module_name: string | null; lesson_number: number | null; student_name: string;
    }>(
      `SELECT h.id, h.title, h.status, h.student_id, h.teacher_id, h.submission_type, m.name AS module_name, cl.lesson_number,
              CONCAT(su.first_name, ' ', su.last_name) AS student_name
       FROM homework h
       JOIN users su ON su.id = h.student_id
       LEFT JOIN curriculum_lessons cl ON cl.id = h.curriculum_lesson_id
       LEFT JOIN curriculum_modules m ON m.id = cl.module_id
       WHERE h.id = $1 FOR UPDATE OF h`,
      [homeworkId]
    )).rows[0];

    if (!homework || homework.student_id !== user.id) throw new ApiError(404, "Homework not found", "HOMEWORK_NOT_FOUND");
    if (homework.status !== "assigned" && homework.status !== "needs_revision") {
      throw new ApiError(409, "This homework cannot be submitted right now", "HOMEWORK_NOT_SUBMITTABLE");
    }

    // Only what this homework asks for is accepted. "File + Text" shows both and needs at least one.
    const type = homework.submission_type;
    const hasFiles = input.files.length > 0;
    const hasText = Boolean(input.text);
    const hasLink = Boolean(input.link);
    const ok = type === "file" ? hasFiles : type === "text" ? hasText : type === "link" ? hasLink : hasFiles || hasText;
    if (!ok) {
      const need = { file: "upload a file", text: "write your answer", link: "add a link", file_text: "upload a file or write your answer" }[type] ?? "add your work";
      throw new ApiError(422, `Please ${need} before submitting`, "SUBMISSION_EMPTY");
    }

    const attempt = (await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next FROM homework_submissions WHERE homework_id = $1`,
      [homeworkId]
    )).rows[0].next;

    const submission = (await client.query<{ id: string }>(
      `INSERT INTO homework_submissions (homework_id, student_id, attempt_number, submission_text, submission_link, student_comment, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'submitted') RETURNING id`,
      [homeworkId, user.id, attempt, type === "file" || type === "link" ? null : input.text ?? null, type === "link" ? input.link ?? null : null, input.comment ?? null]
    )).rows[0].id;

    for (const file of type === "text" || type === "link" ? [] : input.files) {
      await client.query(
        `INSERT INTO homework_submission_files (submission_id, storage_key, file_name, mime_type, size_bytes, resource_type)
         VALUES ($1, $2, $3, $4, $5, 'submission')`,
        [submission, file.storageKey, file.fileName, file.mimeType ?? null, file.sizeBytes ?? null]
      );
    }

    await client.query(`UPDATE homework SET status = 'submitted', updated_at = NOW() WHERE id = $1`, [homeworkId]);

    await createInAppNotifications(
      {
        eventKey: "homework.submitted",
        recipientUserIds: [homework.teacher_id],
        title: "Homework submitted",
        message: `${homework.student_name} submitted "${homework.title}" (Attempt ${attempt})${homework.module_name ? ` - ${homework.module_name}${homework.lesson_number ? `, Class ${homework.lesson_number}` : ""}` : ""}.`,
        linkPath: "/teacher/homework",
        payload: { homeworkId, submissionId: submission, attempt }
      },
      client
    );

    await client.query("COMMIT");
    return await getHomeworkDetail(user, homeworkId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------------------------
// Teacher reviews the latest attempt
// ---------------------------------------------------------------------------------------------

export async function reviewHomework(user: AuthenticatedUser, homeworkId: string, input: ReviewHomeworkInput) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const homework = (await client.query<{ id: string; title: string; status: HomeworkStatus; teacher_id: string; student_id: string; max_points: number | null }>(
      `SELECT id, title, status, teacher_id, student_id, max_points FROM homework WHERE id = $1 FOR UPDATE`,
      [homeworkId]
    )).rows[0];

    const isAdmin = user.roles.includes("admin");
    if (!homework || (!isAdmin && homework.teacher_id !== user.id)) throw new ApiError(404, "Homework not found", "HOMEWORK_NOT_FOUND");
    if (homework.status !== "submitted") throw new ApiError(409, "There is no submission waiting for review", "NOTHING_TO_REVIEW");
    if (homework.max_points !== null && input.points > homework.max_points) {
      throw new ApiError(422, `Points cannot be more than ${homework.max_points}`, "POINTS_ABOVE_MAXIMUM");
    }

    const complete = input.result === "complete";
    const latest = (await client.query<{ id: string; attempt_number: number }>(
      `SELECT id, attempt_number FROM homework_submissions WHERE homework_id = $1 AND status = 'submitted' ORDER BY attempt_number DESC LIMIT 1`,
      [homeworkId]
    )).rows[0];
    if (!latest) throw new ApiError(409, "There is no submission waiting for review", "NOTHING_TO_REVIEW");

    await client.query(
      `UPDATE homework_submissions
       SET status = $2::submission_status, points_awarded = $3, teacher_feedback = $4, reviewed_at = NOW(), reviewed_by_teacher_id = $5, updated_at = NOW()
       WHERE id = $1`,
      [latest.id, complete ? "accepted" : "resubmission_requested", input.points, input.feedback ?? null, user.id]
    );
    await client.query(
      `UPDATE homework SET status = $2::homework_status, completed_at = $3, updated_at = NOW() WHERE id = $1`,
      [homeworkId, complete ? "completed" : "needs_revision", complete ? new Date() : null]
    );

    const scoreText = homework.max_points ? `${input.points}/${homework.max_points}` : String(input.points);
    await createInAppNotifications(
      {
        eventKey: complete ? "homework.completed" : "homework.revision_requested",
        recipientUserIds: [homework.student_id],
        title: complete ? "Homework completed" : "Revision required",
        message: complete
          ? `"${homework.title}" was marked complete. Score: ${scoreText}.`
          : `"${homework.title}" needs changes (score ${scoreText}). Open it to see your teacher's feedback and resubmit.`,
        linkPath: "/student/homework",
        payload: { homeworkId, attempt: latest.attempt_number }
      },
      client
    );

    await client.query("COMMIT");
    return await getHomeworkDetail(user, homeworkId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------------------------
// File access (private R2). Always checked against who may see this homework.
// ---------------------------------------------------------------------------------------------

async function assertHomeworkAccess(user: AuthenticatedUser, homeworkId: string) {
  const values: unknown[] = [homeworkId];
  const scope = scopeCondition(user, values);
  const row = (await pool.query<{ id: string; curriculum_material_id: string | null }>(
    `SELECT h.id, h.curriculum_material_id FROM homework h WHERE h.id = $1 AND ${scope}`,
    values
  )).rows[0];
  if (!row) throw new ApiError(404, "Homework not found", "HOMEWORK_NOT_FOUND");
  return row;
}

export type StoredFile = { storageKey: string; fileName: string; mimeType: string };

export async function getHomeworkResourceFile(user: AuthenticatedUser, homeworkId: string, resourceId: string): Promise<StoredFile> {
  await assertHomeworkAccess(user, homeworkId);
  const row = (await pool.query<{ storage_key: string | null; file_name: string | null; mime_type: string | null }>(
    `SELECT storage_key, file_name, mime_type FROM homework_resources WHERE id = $1 AND homework_id = $2`,
    [resourceId, homeworkId]
  )).rows[0];
  if (!row?.storage_key) throw new ApiError(404, "File not found", "HOMEWORK_FILE_NOT_FOUND");
  return { storageKey: row.storage_key, fileName: row.file_name ?? "file", mimeType: row.mime_type ?? "application/octet-stream" };
}

export async function getHomeworkDocumentFile(user: AuthenticatedUser, homeworkId: string): Promise<StoredFile> {
  const homework = await assertHomeworkAccess(user, homeworkId);
  if (!homework.curriculum_material_id) throw new ApiError(404, "File not found", "HOMEWORK_FILE_NOT_FOUND");
  const row = (await pool.query<{ storage_key: string | null; file_name: string | null; mime_type: string | null }>(
    `SELECT storage_key, file_name, mime_type FROM curriculum_materials WHERE id = $1 AND source_type = 'file'`,
    [homework.curriculum_material_id]
  )).rows[0];
  if (!row?.storage_key) throw new ApiError(404, "File not found", "HOMEWORK_FILE_NOT_FOUND");
  return { storageKey: row.storage_key, fileName: row.file_name ?? "homework", mimeType: row.mime_type ?? "application/octet-stream" };
}

export async function getSubmissionFile(user: AuthenticatedUser, homeworkId: string, submissionId: string, fileId: string): Promise<StoredFile> {
  await assertHomeworkAccess(user, homeworkId);
  const row = (await pool.query<{ storage_key: string | null; file_name: string | null; mime_type: string | null }>(
    `SELECT f.storage_key, f.file_name, f.mime_type
     FROM homework_submission_files f JOIN homework_submissions s ON s.id = f.submission_id
     WHERE f.id = $1 AND s.id = $2 AND s.homework_id = $3`,
    [fileId, submissionId, homeworkId]
  )).rows[0];
  if (!row?.storage_key) throw new ApiError(404, "File not found", "HOMEWORK_FILE_NOT_FOUND");
  return { storageKey: row.storage_key, fileName: row.file_name ?? "file", mimeType: row.mime_type ?? "application/octet-stream" };
}

// ---------------------------------------------------------------------------------------------
// Teacher's saved library
// ---------------------------------------------------------------------------------------------

export async function listHomeworkLibrary(teacherId: string): Promise<HomeworkLibraryItem[]> {
  const items = await pool.query<{
    id: string; title: string; instructions: string | null; max_points: number; submission_type: string; created_at: Date;
  }>(
    `SELECT id, title, instructions, max_points, submission_type, created_at
     FROM homework_library WHERE teacher_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [teacherId]
  );
  if (!items.rows.length) return [];

  const resources = await pool.query<{ library_id: string; storage_key: string; file_name: string; mime_type: string | null; size_bytes: string | null }>(
    `SELECT library_id, storage_key, file_name, mime_type, size_bytes
     FROM homework_library_resources WHERE library_id = ANY($1::UUID[]) ORDER BY created_at`,
    [items.rows.map((item) => item.id)]
  );

  return items.rows.map((item) => ({
    id: item.id,
    title: item.title,
    instructions: item.instructions,
    maxPoints: item.max_points,
    submissionType: item.submission_type,
    createdAt: item.created_at,
    attachments: resources.rows
      .filter((resource) => resource.library_id === item.id)
      .map((resource) => ({
        storageKey: resource.storage_key,
        fileName: resource.file_name,
        mimeType: resource.mime_type,
        sizeBytes: resource.size_bytes === null ? null : Number(resource.size_bytes)
      }))
  }));
}
