import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import type { AuthenticatedUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, getPaginationMeta, type PaginationMeta } from "../../utils/pagination.js";
import type {
  CancelClassInput,
  CheckConflictsInput,
  CreateClassInput,
  ListClassesInput,
  RescheduleClassInput,
  UpdateClassInput
} from "./classes.validation.js";
import { checkSchedulingConflicts, type SchedulingConflict } from "./scheduling.service.js";
import { cancelZoomMeetingForClass, createZoomMeetingForClass } from "../zoom/zoom.service.js";

export type ClassItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  timezone: string;
  status: string;
  createdByAdminId: string | null;
  calendarUid: string;
  notes: string | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  cancellationRequestStatus: string | null;
  cancellationRequestsCount: number;
  participants: Array<{
    studentId: string;
    studentName: string;
    attendanceStatus: string;
    creditsConsumed: string;
  }>;
  zoomMeeting: {
    id: string;
    zoomMeetingId: string | null;
    zoomPassword?: string | null;
    status: string;
    creationStatus: string;
    joinUrl: string | null;
    startUrl?: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

type ClassRow = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  start_time: Date;
  end_time: Date;
  duration_minutes: number;
  timezone: string;
  status: string;
  created_by_admin_id: string | null;
  calendar_uid: string;
  notes: string | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  cancellation_request_status: string | null;
  cancellation_requests_count: number;
  participants: ClassItem["participants"];
  zoom_meeting: ClassItem["zoomMeeting"];
  created_at: Date;
  updated_at: Date;
};

export async function checkConflicts(input: CheckConflictsInput): Promise<{
  hasConflicts: boolean;
  conflicts: SchedulingConflict[];
}> {
  const conflicts = await checkSchedulingConflicts(input);

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
}

export async function listClasses(
  input: ListClassesInput,
  user: AuthenticatedUser
): Promise<{ classes: ClassItem[]; pagination: PaginationMeta }> {
  const { page, limit, offset } = getPagination(input);
  const values: unknown[] = [];
  const filters: string[] = [];

  addScopedClassFilters(filters, values, user);

  if (input.status) {
    values.push(input.status);
    filters.push(`c.status = $${values.length}`);
  }

  if (input.teacherId) {
    values.push(input.teacherId);
    filters.push(`c.teacher_id = $${values.length}`);
  }

  if (input.studentId) {
    values.push(input.studentId);
    filters.push(`
      EXISTS (
        SELECT 1 FROM class_participants filter_cp
        WHERE filter_cp.class_id = c.id
          AND filter_cp.student_id = $${values.length}
      )
    `);
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
    `SELECT COUNT(DISTINCT c.id) AS total FROM classes c ${whereClause}`,
    values
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(limit, offset);
  const result = await pool.query<ClassRow>(
    `
      ${baseClassSelect()}
      ${whereClause}
      GROUP BY c.id, teacher.id, zm.id
      ORDER BY c.start_time DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    classes: result.rows.map(mapClass),
    pagination: getPaginationMeta(page, limit, total)
  };
}

export async function createClass(input: CreateClassInput, user: AuthenticatedUser): Promise<ClassItem> {
  const start = new Date(input.startTime);
  const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);
  const conflicts = await checkSchedulingConflicts({
    teacherId: input.teacherId,
    studentId: input.studentId,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    timezone: input.timezone
  });

  assertCanProceedWithConflicts(conflicts, input.overrideConflicts, user);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const classResult = await client.query<{ id: string }>(
      `
        INSERT INTO classes (
          teacher_id,
          title,
          start_time,
          end_time,
          duration_minutes,
          timezone,
          status,
          created_by_admin_id,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8)
        RETURNING id
      `,
      [
        input.teacherId,
        input.title,
        start,
        end,
        input.durationMinutes,
        input.timezone,
        user.id,
        input.notes ?? null
      ]
    );

    const classId = classResult.rows[0].id;

    await client.query(
      `
        INSERT INTO class_participants (class_id, student_id, attendance_status)
        VALUES ($1, $2, 'pending')
      `,
      [classId, input.studentId]
    );

    await client.query(
      `
        INSERT INTO class_attendance (class_id, student_id, status, source)
        VALUES ($1, $2, 'pending', 'teacher_manual')
      `,
      [classId, input.studentId]
    );

    await upsertTeacherWorkSession(
      client,
      {
        classId,
        teacherId: input.teacherId,
        studentId: input.studentId,
        start,
        end,
        durationMinutes: input.durationMinutes,
        timezone: input.timezone,
        status: "scheduled",
        createdByUserId: user.id
      }
    );

    await createZoomMeetingForClass(
      {
        classId,
        topic: input.title,
        startTime: start,
        durationMinutes: input.durationMinutes,
        timezone: input.timezone
      },
      client
    );

    await client.query("COMMIT");

    return await getClassById(classId, user);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getClassById(id: string, user: AuthenticatedUser): Promise<ClassItem> {
  const values: unknown[] = [id];
  const filters = ["c.id = $1"];
  addScopedClassFilters(filters, values, user);

  const result = await pool.query<ClassRow>(
    `
      ${baseClassSelect()}
      WHERE ${filters.join(" AND ")}
      GROUP BY c.id, teacher.id, zm.id
    `,
    values
  );

  const classRow = result.rows[0];

  if (!classRow) {
    throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");
  }

  return mapClass(classRow);
}

export async function updateClass(id: string, input: UpdateClassInput, user: AuthenticatedUser): Promise<ClassItem> {
  const updates: string[] = [];
  const values: unknown[] = [];

  addUpdate(updates, values, "title", input.title);
  addUpdate(updates, values, "notes", input.notes);

  if (!updates.length) {
    throw new ApiError(400, "No update fields provided", "NO_UPDATE_FIELDS");
  }

  values.push(id);
  const result = await pool.query<{ id: string }>(
    `
      UPDATE classes
      SET ${updates.join(", ")},
          updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING id
    `,
    values
  );

  if (!result.rows[0]) {
    throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");
  }

  return await getClassById(id, user);
}

export async function cancelClass(id: string, input: CancelClassInput, user: AuthenticatedUser): Promise<ClassItem> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<{ id: string }>(
      `
        UPDATE classes
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancellation_reason = $1,
            updated_at = NOW()
        WHERE id = $2
          AND status IN ('scheduled', 'live')
        RETURNING id
      `,
      [input.reason, id]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "Scheduled class not found", "CLASS_NOT_FOUND");
    }

    await cancelZoomMeetingForClass(id, client);
    await updateTeacherWorkSessionStatus(client, id, "cancelled");

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return await getClassById(id, user);
}

export async function rescheduleClass(
  id: string,
  input: RescheduleClassInput,
  user: AuthenticatedUser
): Promise<ClassItem> {
  const existing = await getClassById(id, user);
  const student = existing.participants[0];

  if (!student) {
    throw new ApiError(422, "Class has no student participant", "CLASS_HAS_NO_STUDENT");
  }

  const conflicts = await checkSchedulingConflicts({
    teacherId: existing.teacherId,
    studentId: student.studentId,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    timezone: input.timezone,
    excludeClassId: id
  });

  assertCanProceedWithConflicts(conflicts, input.overrideConflicts, user);

  const start = new Date(input.startTime);
  const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<{ id: string }>(
      `
        UPDATE classes
        SET start_time = $1,
            end_time = $2,
            duration_minutes = $3,
            timezone = $4,
            status = 'scheduled',
            updated_at = NOW()
        WHERE id = $5
          AND status IN ('scheduled', 'rescheduled')
        RETURNING id
      `,
      [start, end, input.durationMinutes, input.timezone, id]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "Class cannot be rescheduled", "CLASS_NOT_RESCHEDULABLE");
    }

    await upsertTeacherWorkSession(client, {
      classId: id,
      teacherId: existing.teacherId,
      studentId: student.studentId,
      start,
      end,
      durationMinutes: input.durationMinutes,
      timezone: input.timezone,
      status: "rescheduled",
      createdByUserId: user.id
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return await getClassById(id, user);
}

export async function getJoinPayload(id: string, user: AuthenticatedUser): Promise<unknown> {
  const classItem = await getClassById(id, user);
  const canStart = user.id === classItem.teacherId || user.roles.includes("admin");

  return {
    classId: classItem.id,
    title: classItem.title,
    provider: "zoom",
    zoom: {
      meetingId: classItem.zoomMeeting?.zoomMeetingId ?? null,
      joinUrl: classItem.zoomMeeting?.joinUrl ?? null,
      startUrl: canStart ? classItem.zoomMeeting?.startUrl ?? null : undefined,
      status: classItem.zoomMeeting?.status ?? "pending",
      creationStatus: classItem.zoomMeeting?.creationStatus ?? "pending"
    },
    message: "Zoom meeting creation is currently a placeholder until Zoom credentials are configured"
  };
}

export async function getIcs(id: string, user: AuthenticatedUser): Promise<string> {
  const classItem = await getClassById(id, user);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SchooliEdu//Classes//EN",
    "BEGIN:VEVENT",
    `UID:${classItem.calendarUid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(classItem.startTime)}`,
    `DTEND:${formatIcsDate(classItem.endTime)}`,
    `SUMMARY:${escapeIcsText(classItem.title)}`,
    `DESCRIPTION:${escapeIcsText(classItem.notes ?? "SchooliEdu class")}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

export function assertCanProceedWithConflicts(
  conflicts: SchedulingConflict[],
  overrideConflicts: boolean | undefined,
  user: AuthenticatedUser
): void {
  if (!conflicts.length) {
    return;
  }

  if (overrideConflicts && user.permissions.includes("class.override_conflict")) {
    return;
  }

  throw new ApiError(409, "Scheduling conflicts found", "SCHEDULING_CONFLICT", { conflicts });
}

function baseClassSelect(): string {
  return `
    SELECT
      c.id,
      c.teacher_id,
      CONCAT(teacher.first_name, ' ', teacher.last_name) AS teacher_name,
      c.title,
      c.start_time,
      c.end_time,
      c.duration_minutes,
      c.timezone,
      c.status,
      c.created_by_admin_id,
      c.calendar_uid,
      c.notes,
      c.cancelled_at,
      c.cancellation_reason,
      (
        SELECT ccr.status::TEXT
        FROM class_cancellation_requests ccr
        WHERE ccr.class_id = c.id
          AND ccr.status = 'pending'
        ORDER BY ccr.created_at DESC
        LIMIT 1
      ) AS cancellation_request_status,
      (
        SELECT COUNT(*)::INT
        FROM class_cancellation_requests ccr
        WHERE ccr.class_id = c.id
          AND ccr.status = 'pending'
      ) AS cancellation_requests_count,
      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object(
            'studentId', student.id,
            'studentName', CONCAT(student.first_name, ' ', student.last_name),
            'attendanceStatus', cp.attendance_status,
            'creditsConsumed', cp.credits_consumed::TEXT
          )
        ) FILTER (WHERE student.id IS NOT NULL),
        '[]'::JSONB
      ) AS participants,
      CASE
        WHEN zm.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', zm.id,
          'zoomMeetingId', zm.zoom_meeting_id,
          'zoomPassword', zm.zoom_password,
          'status', zm.status,
          'creationStatus', zm.creation_status,
          'joinUrl', zm.zoom_join_url,
          'startUrl', zm.zoom_start_url
        )
      END AS zoom_meeting,
      c.created_at,
      c.updated_at
    FROM classes c
    JOIN users teacher ON teacher.id = c.teacher_id
    LEFT JOIN class_participants cp ON cp.class_id = c.id
    LEFT JOIN users student ON student.id = cp.student_id
    LEFT JOIN zoom_meetings zm ON zm.class_id = c.id
  `;
}

function addScopedClassFilters(filters: string[], values: unknown[], user: AuthenticatedUser): void {
  if (user.roles.includes("admin") || user.roles.includes("support")) {
    return;
  }

  if (user.roles.includes("teacher")) {
    values.push(user.id);
    filters.push(`c.teacher_id = $${values.length}`);
    return;
  }

  values.push(user.id);
  filters.push(`
    EXISTS (
      SELECT 1 FROM class_participants scoped_cp
      WHERE scoped_cp.class_id = c.id
        AND scoped_cp.student_id = $${values.length}
    )
  `);
}

async function upsertTeacherWorkSession(
  client: PoolClient,
  input: {
    classId: string;
    teacherId: string;
    studentId: string;
    start: Date;
    end: Date;
    durationMinutes: number;
    timezone: string;
    status: "scheduled" | "rescheduled";
    createdByUserId: string;
  }
): Promise<void> {
  await client.query(
    `
      INSERT INTO teacher_work_sessions (
        teacher_id,
        student_id,
        class_id,
        status,
        start_time,
        end_time,
        duration_minutes,
        timezone,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (class_id)
      DO UPDATE SET
        teacher_id = EXCLUDED.teacher_id,
        student_id = EXCLUDED.student_id,
        status = EXCLUDED.status,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        duration_minutes = EXCLUDED.duration_minutes,
        timezone = EXCLUDED.timezone,
        updated_at = NOW()
    `,
    [
      input.teacherId,
      input.studentId,
      input.classId,
      input.status,
      input.start,
      input.end,
      input.durationMinutes,
      input.timezone,
      input.createdByUserId
    ]
  );
}

async function updateTeacherWorkSessionStatus(
  client: PoolClient,
  classId: string,
  status: "cancelled" | "completed" | "live"
): Promise<void> {
  await client.query(
    `
      UPDATE teacher_work_sessions
      SET status = $1,
          updated_at = NOW()
      WHERE class_id = $2
    `,
    [status, classId]
  );
}

function mapClass(row: ClassRow): ClassItem {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    status: row.status,
    createdByAdminId: row.created_by_admin_id,
    calendarUid: row.calendar_uid,
    notes: row.notes,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    cancellationRequestStatus: row.cancellation_request_status,
    cancellationRequestsCount: Number(row.cancellation_requests_count ?? 0),
    participants: row.participants ?? [],
    zoomMeeting: row.zoom_meeting,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function addUpdate(
  updates: string[],
  values: unknown[],
  column: string,
  value: string | null | undefined
): void {
  if (value === undefined) {
    return;
  }

  values.push(value);
  updates.push(`${column} = $${values.length}`);
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}
