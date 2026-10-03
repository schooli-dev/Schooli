import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import type { AuthenticatedUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, getPaginationMeta, type PaginationMeta } from "../../utils/pagination.js";
import type {
  ListAttendanceInput,
  MarkAttendanceInput,
  UpdateAttendanceInput
} from "./attendance.validation.js";
import {
  getCurriculumProgressForLesson,
  recalcRemainingCurriculumMappings,
  upsertCurriculumProgressFromOutcome
} from "../classes/curriculumMapping.service.js";

export type AttendanceItem = {
  id: string;
  classId: string;
  classTitle: string;
  classStartTime: Date;
  classEndTime: Date;
  classStatus: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  status: string;
  markedByTeacherId: string | null;
  markedAt: Date | null;
  source: string;
  teacherNotes: string | null;
  zoomJoinTime: Date | null;
  zoomLeaveTime: Date | null;
  totalZoomMinutes: number | null;
  zoomEvidence: {
    joinCount: number;
    leaveCount: number;
    firstJoinTime: Date | null;
    lastLeaveTime: Date | null;
  };
  academicOutcome: string | null;
  taughtSummary: string | null;
  continueSummary: string | null;
  homeworkType: string;
  homeworkMaterialId: string | null;
  homeworkCustomText: string | null;
  curriculumLessonId: string | null;
  /** Only populated by listClassAttendance/getAttendanceById, when the mapped lesson's
   * rollup for this student is 'partially_completed' or 'continue_from_previous'. Drives the
   * "Continue From Previous Class" banner in the Mark Attendance dialog. */
  continuation: {
    lessonTitle: string;
    taughtSummary: string | null;
    continueSummary: string | null;
    teacherNotes: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

type AttendanceRow = {
  id: string;
  class_id: string;
  class_title: string;
  class_start_time: Date;
  class_end_time: Date;
  class_status: string;
  teacher_id: string;
  teacher_name: string;
  student_id: string;
  student_name: string;
  status: string;
  marked_by_teacher_id: string | null;
  marked_at: Date | null;
  source: string;
  teacher_notes: string | null;
  zoom_join_time: Date | null;
  zoom_leave_time: Date | null;
  total_zoom_minutes: number | null;
  zoom_join_count: string;
  zoom_leave_count: string;
  zoom_first_join_time: Date | null;
  zoom_last_leave_time: Date | null;
  academic_outcome: string | null;
  taught_summary: string | null;
  continue_summary: string | null;
  homework_type: string;
  homework_material_id: string | null;
  homework_custom_text: string | null;
  curriculum_lesson_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function listAttendance(
  input: ListAttendanceInput,
  user: AuthenticatedUser
): Promise<{ attendance: AttendanceItem[]; pagination: PaginationMeta }> {
  const { page, limit, offset } = getPagination(input);
  const values: unknown[] = [];
  const filters: string[] = [];

  addScopedAttendanceFilters(filters, values, user);

  if (input.classId) {
    values.push(input.classId);
    filters.push(`ca.class_id = $${values.length}`);
  }

  if (input.teacherId) {
    values.push(input.teacherId);
    filters.push(`c.teacher_id = $${values.length}`);
  }

  if (input.studentId) {
    values.push(input.studentId);
    filters.push(`ca.student_id = $${values.length}`);
  }

  if (input.status) {
    values.push(input.status);
    filters.push(`ca.status = $${values.length}`);
  }

  if (input.from) {
    values.push(new Date(input.from));
    filters.push(`c.end_time >= $${values.length}`);
  }

  if (input.to) {
    values.push(new Date(input.to));
    filters.push(`c.start_time <= $${values.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const countResult = await pool.query<{ total: string }>(
    `
      SELECT COUNT(DISTINCT ca.id) AS total
      FROM class_attendance ca
      JOIN classes c ON c.id = ca.class_id
      ${whereClause}
    `,
    values
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(limit, offset);
  const result = await pool.query<AttendanceRow>(
    `
      ${baseAttendanceSelect()}
      ${whereClause}
      ${attendanceGroupBy()}
      ORDER BY c.start_time DESC, student.first_name ASC, student.last_name ASC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    attendance: result.rows.map(mapAttendance),
    pagination: getPaginationMeta(page, limit, total)
  };
}

export async function listClassAttendance(classId: string, user: AuthenticatedUser): Promise<AttendanceItem[]> {
  const values: unknown[] = [classId];
  const filters = ["ca.class_id = $1"];
  addScopedAttendanceFilters(filters, values, user);

  const result = await pool.query<AttendanceRow>(
    `
      ${baseAttendanceSelect()}
      WHERE ${filters.join(" AND ")}
      ${attendanceGroupBy()}
      ORDER BY student.first_name ASC, student.last_name ASC
    `,
    values
  );

  return await attachContinuationBanners(result.rows.map(mapAttendance));
}

export async function markAttendance(input: MarkAttendanceInput, user: AuthenticatedUser): Promise<AttendanceItem> {
  await assertCanMarkClassAttendance(input.classId, input.studentId, user);

  const source = user.permissions.includes("attendance.override") ? "admin_override" : "teacher_manual";
  const isPresent = input.status === "present";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<{ id: string }>(
      `
        INSERT INTO class_attendance (
          class_id,
          student_id,
          status,
          marked_by_teacher_id,
          marked_at,
          source,
          teacher_notes,
          zoom_join_time,
          zoom_leave_time,
          total_zoom_minutes,
          academic_outcome,
          taught_summary,
          continue_summary,
          homework_type,
          homework_material_id,
          homework_custom_text
        )
        VALUES (
          $1, $2, $3::attendance_status, $4, NOW(), $5::attendance_source, $6, $7, $8, $9,
          $10::academic_outcome, $11, $12, $13::attendance_homework_type, $14, $15
        )
        ON CONFLICT (class_id, student_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          marked_by_teacher_id = EXCLUDED.marked_by_teacher_id,
          marked_at = NOW(),
          source = EXCLUDED.source,
          teacher_notes = EXCLUDED.teacher_notes,
          zoom_join_time = EXCLUDED.zoom_join_time,
          zoom_leave_time = EXCLUDED.zoom_leave_time,
          total_zoom_minutes = EXCLUDED.total_zoom_minutes,
          academic_outcome = EXCLUDED.academic_outcome,
          taught_summary = EXCLUDED.taught_summary,
          continue_summary = EXCLUDED.continue_summary,
          homework_type = EXCLUDED.homework_type,
          homework_material_id = EXCLUDED.homework_material_id,
          homework_custom_text = EXCLUDED.homework_custom_text,
          updated_at = NOW()
        RETURNING id
      `,
      [
        input.classId,
        input.studentId,
        input.status,
        user.id,
        source,
        input.teacherNotes ?? null,
        input.zoomJoinTime ? new Date(input.zoomJoinTime) : null,
        input.zoomLeaveTime ? new Date(input.zoomLeaveTime) : null,
        input.totalZoomMinutes ?? null,
        isPresent ? (input.academicOutcome ?? null) : null,
        isPresent ? (input.taughtSummary ?? null) : null,
        isPresent ? (input.continueSummary ?? null) : null,
        isPresent ? (input.homeworkType ?? "none") : "none",
        isPresent ? (input.homeworkMaterialId ?? null) : null,
        isPresent ? (input.homeworkCustomText ?? null) : null
      ]
    );
    const attendanceId = result.rows[0].id;

    await syncParticipantAttendance(client, input.classId, input.studentId, input.status);
    await applyCurriculumEffects(client, {
      attendanceId,
      classId: input.classId,
      studentId: input.studentId,
      status: input.status,
      academicOutcome: isPresent ? (input.academicOutcome ?? null) : null
    });

    await client.query("COMMIT");
    return await getAttendanceById(attendanceId, user);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAttendance(
  id: string,
  input: UpdateAttendanceInput,
  user: AuthenticatedUser
): Promise<AttendanceItem> {
  const existing = await getAttendanceById(id, user);
  await assertCanMarkClassAttendance(existing.classId, existing.studentId, user);

  const effectiveStatus = input.status ?? existing.status;
  const isPresent = effectiveStatus === "present";

  // Same rule as the create-time validation, re-asserted here because a PATCH that omits
  // `status` cannot be checked against the *stored* status at the Zod layer.
  if (!isPresent && (input.academicOutcome !== undefined || input.taughtSummary || input.continueSummary || (input.homeworkType && input.homeworkType !== "none"))) {
    throw new ApiError(422, "Academic outcome, homework, and taught/continue notes only apply when status is 'present'", "OUTCOME_REQUIRES_PRESENT");
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.status !== undefined) {
    values.push(input.status);
    updates.push(`status = $${values.length}::attendance_status`);
  }

  addUpdate(updates, values, "teacher_notes", input.teacherNotes);
  addUpdate(updates, values, "zoom_join_time", input.zoomJoinTime ? new Date(input.zoomJoinTime) : input.zoomJoinTime);
  addUpdate(updates, values, "zoom_leave_time", input.zoomLeaveTime ? new Date(input.zoomLeaveTime) : input.zoomLeaveTime);
  addUpdate(updates, values, "total_zoom_minutes", input.totalZoomMinutes);

  if (input.academicOutcome !== undefined) {
    values.push(input.academicOutcome);
    updates.push(`academic_outcome = $${values.length}::academic_outcome`);
  }
  addUpdate(updates, values, "taught_summary", input.taughtSummary);
  addUpdate(updates, values, "continue_summary", input.continueSummary);
  if (input.homeworkType !== undefined) {
    values.push(input.homeworkType);
    updates.push(`homework_type = $${values.length}::attendance_homework_type`);
  }
  addUpdate(updates, values, "homework_material_id", input.homeworkMaterialId);
  addUpdate(updates, values, "homework_custom_text", input.homeworkCustomText);

  // Switching to a non-present status must clear any leftover outcome/homework data so the
  // DB CHECK constraint (academic_outcome requires status = 'present') can never be violated.
  if (input.status !== undefined && input.status !== "present") {
    updates.push("academic_outcome = NULL", "taught_summary = NULL", "continue_summary = NULL", "homework_type = 'none'", "homework_material_id = NULL", "homework_custom_text = NULL");
  }

  values.push(user.id);
  updates.push(`marked_by_teacher_id = $${values.length}`);
  updates.push("marked_at = NOW()");

  values.push(user.permissions.includes("attendance.override") ? "admin_override" : "teacher_manual");
  updates.push(`source = $${values.length}::attendance_source`);

  values.push(id);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query<{ id: string; class_id: string; student_id: string; status: string; academic_outcome: string | null }>(
      `
        UPDATE class_attendance
        SET ${updates.join(", ")},
            updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id, class_id, student_id, status, academic_outcome
      `,
      values
    );

    const updated = result.rows[0];

    if (!updated) {
      throw new ApiError(404, "Attendance record not found", "ATTENDANCE_NOT_FOUND");
    }

    await syncParticipantAttendance(client, updated.class_id, updated.student_id, updated.status);
    await applyCurriculumEffects(client, {
      attendanceId: updated.id,
      classId: updated.class_id,
      studentId: updated.student_id,
      status: updated.status,
      academicOutcome: updated.academic_outcome
    });

    await client.query("COMMIT");
    return await getAttendanceById(id, user);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Wires attendance marking into the curriculum system: upserts the (student, lesson)
 * progress rollup when Present + an outcome is recorded, and re-runs the shared curriculum
 * remap for the class's series on every Present or Absent write (a no-op unless something
 * actually needs to shift - see curriculumMapping.service.ts).
 */
async function applyCurriculumEffects(
  client: PoolClient,
  params: { attendanceId: string; classId: string; studentId: string; status: string; academicOutcome: string | null }
): Promise<void> {
  if (params.status !== "present" && params.status !== "absent") return;

  const classResult = await client.query<{ curriculum_lesson_id: string | null; class_series_id: string | null }>(
    `SELECT curriculum_lesson_id, class_series_id FROM classes WHERE id = $1`,
    [params.classId]
  );
  const classRow = classResult.rows[0];
  if (!classRow) return;

  if (params.status === "present" && params.academicOutcome && classRow.curriculum_lesson_id) {
    await upsertCurriculumProgressFromOutcome(client, {
      studentId: params.studentId,
      curriculumLessonId: classRow.curriculum_lesson_id,
      academicOutcome: params.academicOutcome,
      classAttendanceId: params.attendanceId
    });
  }

  if (classRow.class_series_id) {
    await recalcRemainingCurriculumMappings(client, classRow.class_series_id);
  }
}

async function getAttendanceById(id: string, user: AuthenticatedUser): Promise<AttendanceItem> {
  const values: unknown[] = [id];
  const filters = ["ca.id = $1"];
  addScopedAttendanceFilters(filters, values, user);

  const result = await pool.query<AttendanceRow>(
    `
      ${baseAttendanceSelect()}
      WHERE ${filters.join(" AND ")}
      ${attendanceGroupBy()}
    `,
    values
  );
  const attendance = result.rows[0];

  if (!attendance) {
    throw new ApiError(404, "Attendance record not found", "ATTENDANCE_NOT_FOUND");
  }

  const [mapped] = await attachContinuationBanners([mapAttendance(attendance)]);
  return mapped;
}

async function assertCanMarkClassAttendance(
  classId: string,
  studentId: string,
  user: AuthenticatedUser
): Promise<void> {
  if (!user.permissions.includes("attendance.mark")) {
    throw new ApiError(403, "Permission denied", "FORBIDDEN", { required: "attendance.mark" });
  }

  const values: unknown[] = [classId, studentId];
  const filters = [
    "c.id = $1",
    "cp.student_id = $2",
    "c.status IN ('scheduled', 'live', 'completed', 'no_show')"
  ];

  if (!user.permissions.includes("attendance.override")) {
    values.push(user.id);
    filters.push(`c.teacher_id = $${values.length}`);
  }

  const result = await pool.query<{ id: string }>(
    `
      SELECT c.id
      FROM classes c
      JOIN class_participants cp ON cp.class_id = c.id
      WHERE ${filters.join(" AND ")}
      LIMIT 1
    `,
    values
  );

  if (!result.rows[0]) {
    throw new ApiError(404, "Class participant not found for attendance marking", "CLASS_PARTICIPANT_NOT_FOUND");
  }
}

async function syncParticipantAttendance(client: PoolClient, classId: string, studentId: string, status: string): Promise<void> {
  await client.query(
    `
      UPDATE class_participants
      SET attendance_status = $1::attendance_status,
          updated_at = NOW()
      WHERE class_id = $2
        AND student_id = $3
    `,
    [status, classId, studentId]
  );
}

function baseAttendanceSelect(): string {
  return `
    SELECT
      ca.id,
      ca.class_id,
      c.title AS class_title,
      c.start_time AS class_start_time,
      c.end_time AS class_end_time,
      c.status AS class_status,
      c.teacher_id,
      CONCAT(teacher.first_name, ' ', teacher.last_name) AS teacher_name,
      ca.student_id,
      CONCAT(student.first_name, ' ', student.last_name) AS student_name,
      ca.status,
      ca.marked_by_teacher_id,
      ca.marked_at,
      ca.source,
      ca.teacher_notes,
      ca.zoom_join_time,
      ca.zoom_leave_time,
      ca.total_zoom_minutes,
      ca.academic_outcome,
      ca.taught_summary,
      ca.continue_summary,
      ca.homework_type,
      ca.homework_material_id,
      ca.homework_custom_text,
      c.curriculum_lesson_id,
      COUNT(vae.id) FILTER (WHERE vae.event_type = 'join') AS zoom_join_count,
      COUNT(vae.id) FILTER (WHERE vae.event_type = 'leave') AS zoom_leave_count,
      MIN(vae.event_time) FILTER (WHERE vae.event_type = 'join') AS zoom_first_join_time,
      MAX(vae.event_time) FILTER (WHERE vae.event_type = 'leave') AS zoom_last_leave_time,
      ca.created_at,
      ca.updated_at
    FROM class_attendance ca
    JOIN classes c ON c.id = ca.class_id
    JOIN users teacher ON teacher.id = c.teacher_id
    JOIN users student ON student.id = ca.student_id
    LEFT JOIN video_attendance_events vae
      ON vae.class_id = ca.class_id
      AND (
        vae.student_id = ca.student_id
        OR LOWER(vae.participant_email) = LOWER(student.email)
      )
  `;
}

function attendanceGroupBy(): string {
  return "GROUP BY ca.id, c.id, teacher.id, student.id";
}

function addScopedAttendanceFilters(filters: string[], values: unknown[], user: AuthenticatedUser): void {
  if (user.roles.includes("admin") || user.roles.includes("support")) {
    return;
  }

  if (user.roles.includes("teacher")) {
    values.push(user.id);
    filters.push(`c.teacher_id = $${values.length}`);
    return;
  }

  values.push(user.id);
  filters.push(`ca.student_id = $${values.length}`);
}

function mapAttendance(row: AttendanceRow): AttendanceItem {
  return {
    id: row.id,
    classId: row.class_id,
    classTitle: row.class_title,
    classStartTime: row.class_start_time,
    classEndTime: row.class_end_time,
    classStatus: row.class_status,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    studentId: row.student_id,
    studentName: row.student_name,
    status: row.status,
    markedByTeacherId: row.marked_by_teacher_id,
    markedAt: row.marked_at,
    source: row.source,
    teacherNotes: row.teacher_notes,
    zoomJoinTime: row.zoom_join_time,
    zoomLeaveTime: row.zoom_leave_time,
    totalZoomMinutes: row.total_zoom_minutes,
    zoomEvidence: {
      joinCount: Number(row.zoom_join_count ?? 0),
      leaveCount: Number(row.zoom_leave_count ?? 0),
      firstJoinTime: row.zoom_first_join_time,
      lastLeaveTime: row.zoom_last_leave_time
    },
    academicOutcome: row.academic_outcome,
    taughtSummary: row.taught_summary,
    continueSummary: row.continue_summary,
    homeworkType: row.homework_type,
    homeworkMaterialId: row.homework_material_id,
    homeworkCustomText: row.homework_custom_text,
    curriculumLessonId: row.curriculum_lesson_id,
    continuation: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Enriches already-mapped items with the "Continue From Previous Class" banner in place. */
async function attachContinuationBanners(items: AttendanceItem[]): Promise<AttendanceItem[]> {
  for (const item of items) {
    if (!item.curriculumLessonId) continue;
    const progress = await getCurriculumProgressForLesson(pool, item.studentId, item.curriculumLessonId);
    if (progress && (progress.status === "partially_completed" || progress.status === "continue_from_previous")) {
      item.continuation = {
        lessonTitle: progress.lessonTitle,
        taughtSummary: progress.taughtSummary,
        continueSummary: progress.continueSummary,
        teacherNotes: progress.teacherNotes
      };
    }
  }
  return items;
}

function addUpdate(
  updates: string[],
  values: unknown[],
  column: string,
  value: string | number | Date | null | undefined
): void {
  if (value === undefined) {
    return;
  }

  values.push(value);
  updates.push(`${column} = $${values.length}`);
}
