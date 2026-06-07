import { pool } from "../../db/pool.js";
import type { AuthenticatedUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, getPaginationMeta, type PaginationMeta } from "../../utils/pagination.js";
import type {
  ListAttendanceInput,
  MarkAttendanceInput,
  UpdateAttendanceInput
} from "./attendance.validation.js";

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
      ORDER BY student.first_name ASC, student.last_name ASC
    `,
    values
  );

  return result.rows.map(mapAttendance);
}

export async function markAttendance(input: MarkAttendanceInput, user: AuthenticatedUser): Promise<AttendanceItem> {
  await assertCanMarkClassAttendance(input.classId, input.studentId, user);

  const source = user.permissions.includes("attendance.override") ? "admin_override" : "teacher_manual";
  const result = await pool.query<{ id: string }>(
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
        total_zoom_minutes
      )
      VALUES (
        $1,
        $2,
        $3::attendance_status,
        $4,
        NOW(),
        $5::attendance_source,
        $6,
        $7,
        $8,
        $9
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
      input.totalZoomMinutes ?? null
    ]
  );

  await syncParticipantAttendance(input.classId, input.studentId, input.status);

  return await getAttendanceById(result.rows[0].id, user);
}

export async function updateAttendance(
  id: string,
  input: UpdateAttendanceInput,
  user: AuthenticatedUser
): Promise<AttendanceItem> {
  const existing = await getAttendanceById(id, user);
  await assertCanMarkClassAttendance(existing.classId, existing.studentId, user);

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

  values.push(user.id);
  updates.push(`marked_by_teacher_id = $${values.length}`);
  updates.push("marked_at = NOW()");

  values.push(user.permissions.includes("attendance.override") ? "admin_override" : "teacher_manual");
  updates.push(`source = $${values.length}::attendance_source`);

  values.push(id);
  const result = await pool.query<{ id: string; class_id: string; student_id: string; status: string }>(
    `
      UPDATE class_attendance
      SET ${updates.join(", ")},
          updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING id, class_id, student_id, status
    `,
    values
  );

  const updated = result.rows[0];

  if (!updated) {
    throw new ApiError(404, "Attendance record not found", "ATTENDANCE_NOT_FOUND");
  }

  await syncParticipantAttendance(updated.class_id, updated.student_id, updated.status);

  return await getAttendanceById(id, user);
}

async function getAttendanceById(id: string, user: AuthenticatedUser): Promise<AttendanceItem> {
  const values: unknown[] = [id];
  const filters = ["ca.id = $1"];
  addScopedAttendanceFilters(filters, values, user);

  const result = await pool.query<AttendanceRow>(
    `
      ${baseAttendanceSelect()}
      WHERE ${filters.join(" AND ")}
    `,
    values
  );
  const attendance = result.rows[0];

  if (!attendance) {
    throw new ApiError(404, "Attendance record not found", "ATTENDANCE_NOT_FOUND");
  }

  return mapAttendance(attendance);
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

async function syncParticipantAttendance(classId: string, studentId: string, status: string): Promise<void> {
  await pool.query(
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
      COUNT(zae.id) FILTER (WHERE zae.event_type = 'join') AS zoom_join_count,
      COUNT(zae.id) FILTER (WHERE zae.event_type = 'leave') AS zoom_leave_count,
      MIN(zae.event_time) FILTER (WHERE zae.event_type = 'join') AS zoom_first_join_time,
      MAX(zae.event_time) FILTER (WHERE zae.event_type = 'leave') AS zoom_last_leave_time,
      ca.created_at,
      ca.updated_at
    FROM class_attendance ca
    JOIN classes c ON c.id = ca.class_id
    JOIN users teacher ON teacher.id = c.teacher_id
    JOIN users student ON student.id = ca.student_id
    LEFT JOIN zoom_attendance_events zae
      ON zae.class_id = ca.class_id
      AND (
        zae.student_id = ca.student_id
        OR LOWER(zae.zoom_participant_email) = LOWER(student.email)
      )
    GROUP BY ca.id, c.id, teacher.id, student.id
  `;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
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
