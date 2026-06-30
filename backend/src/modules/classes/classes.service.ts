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
import { cancelDailyRoomForClass, createDailyRoomForClass } from "../daily/daily.service.js";
import { createInAppNotifications } from "../notifications/notifications.service.js";

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
  videoMeeting: {
    id: string;
    provider: string;
    providerMeetingId: string | null;
    roomName: string | null;
    roomUrl: string | null;
    status: string;
    creationStatus: string;
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
  video_meeting: ClassItem["videoMeeting"];
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
      GROUP BY c.id, teacher.id, vm.id
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

  assertClassStartsInFuture(start);

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

    await createDailyRoomForClass(
      {
        classId,
        topic: input.title,
        startTime: start,
        endTime: end,
        durationMinutes: input.durationMinutes,
      },
      client
    );

    await createInAppNotifications(
      {
        eventKey: "class.scheduled",
        recipientUserIds: [input.teacherId],
        title: "New class scheduled",
        message: `${input.title} has been scheduled for ${formatNotificationTime(start)}.`,
        linkPath: "/teacher/classes",
        payload: { classId, title: input.title, startTime: start, endTime: end }
      },
      client
    );

    await createInAppNotifications(
      {
        eventKey: "class.scheduled",
        recipientUserIds: [input.studentId],
        title: "New class scheduled",
        message: `${input.title} has been scheduled for ${formatNotificationTime(start)}.`,
        linkPath: "/student/classes",
        payload: { classId, title: input.title, startTime: start, endTime: end }
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
      GROUP BY c.id, teacher.id, vm.id
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

    await cancelDailyRoomForClass(id, client);
    await updateTeacherWorkSessionStatus(client, id, "cancelled");
    await notifyClassCancelled(client, id, input.reason);

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

  assertClassStartsInFuture(start);

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
    provider: "daily",
    daily: {
      roomName: classItem.videoMeeting?.roomName ?? null,
      roomUrl: classItem.videoMeeting?.roomUrl ?? null,
      canStart,
      status: classItem.videoMeeting?.status ?? "pending",
      creationStatus: classItem.videoMeeting?.creationStatus ?? "pending"
    },
    message: "Daily room is created automatically when Daily credentials are configured"
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

function assertClassStartsInFuture(start: Date): void {
  if (start.getTime() <= Date.now()) {
    throw new ApiError(400, "Class start time must be in the future", "CLASS_START_TIME_IN_PAST", {
      startTime: start.toISOString()
    });
  }
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
        WHEN vm.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', vm.id,
          'provider', vm.provider,
          'providerMeetingId', vm.provider_meeting_id,
          'roomName', vm.provider_room_name,
          'roomUrl', vm.provider_room_url,
          'status', vm.status,
          'creationStatus', vm.creation_status
        )
      END AS video_meeting,
      c.created_at,
      c.updated_at
    FROM classes c
    JOIN users teacher ON teacher.id = c.teacher_id
    LEFT JOIN class_participants cp ON cp.class_id = c.id
    LEFT JOIN users student ON student.id = cp.student_id
    LEFT JOIN video_meetings vm ON vm.class_id = c.id
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

async function notifyClassCancelled(client: PoolClient, classId: string, reason: string): Promise<void> {
  const result = await client.query<{
    title: string;
    teacher_id: string;
    student_ids: string[];
  }>(
    `
      SELECT c.title,
             c.teacher_id,
             COALESCE(ARRAY_AGG(cp.student_id) FILTER (WHERE cp.student_id IS NOT NULL), '{}') AS student_ids
      FROM classes c
      LEFT JOIN class_participants cp ON cp.class_id = c.id
      WHERE c.id = $1
      GROUP BY c.id
    `,
    [classId]
  );
  const classItem = result.rows[0];

  if (!classItem) {
    return;
  }

  await createInAppNotifications(
    {
      eventKey: "class.cancelled",
      recipientUserIds: [classItem.teacher_id],
      title: "Class cancelled",
      message: `${classItem.title} was cancelled. Reason: ${reason}`,
      linkPath: "/teacher/classes",
      payload: { classId, reason }
    },
    client
  );

  await createInAppNotifications(
    {
      eventKey: "class.cancelled",
      recipientUserIds: classItem.student_ids,
      title: "Class cancelled",
      message: `${classItem.title} was cancelled. Reason: ${reason}`,
      linkPath: "/student/classes",
      payload: { classId, reason }
    },
    client
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
    videoMeeting: row.video_meeting,
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

function formatNotificationTime(date: Date): string {
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}
