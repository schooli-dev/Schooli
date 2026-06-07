import { pool } from "../../db/pool.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, getPaginationMeta, type PaginationMeta } from "../../utils/pagination.js";
import type {
  CreateAvailabilityInput,
  CreateUnavailableDateInput,
  ListTeachersInput,
  ReplaceAvailabilityInput
} from "./teachers.validation.js";
import type { AuthenticatedUser } from "../../types/express.js";

export type TeacherItem = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  status: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type TeacherRow = {
  id: string;
  username: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type AvailabilityRow = {
  id: string;
  teacher_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type UnavailableDateRow = {
  id: string;
  teacher_id: string;
  unavailable_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function listTeachers(input: ListTeachersInput): Promise<{
  teachers: TeacherItem[];
  pagination: PaginationMeta;
}> {
  const { page, limit, offset } = getPagination(input);
  const values: unknown[] = [];
  const filters: string[] = ["r.name = 'teacher'"];

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
  const result = await pool.query<TeacherRow>(
    `
      ${baseTeacherSelect()}
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    teachers: result.rows.map(mapTeacher),
    pagination: getPaginationMeta(page, limit, total)
  };
}

export async function getTeacherById(id: string): Promise<TeacherItem> {
  const result = await pool.query<TeacherRow>(
    `
      ${baseTeacherSelect()}
      WHERE u.id = $1
        AND r.name = 'teacher'
    `,
    [id]
  );

  const teacher = result.rows[0];

  if (!teacher) {
    throw new ApiError(404, "Teacher not found", "TEACHER_NOT_FOUND");
  }

  return mapTeacher(teacher);
}

export async function listAvailability(teacherId: string): Promise<{
  availability: ReturnType<typeof mapAvailability>[];
  unavailableDates: ReturnType<typeof mapUnavailableDate>[];
}> {
  await getTeacherById(teacherId);

  const availability = await pool.query<AvailabilityRow>(
    `
      SELECT id, teacher_id, day_of_week, start_time, end_time, timezone, is_active, created_at, updated_at
      FROM teacher_availability
      WHERE teacher_id = $1
      ORDER BY day_of_week, start_time
    `,
    [teacherId]
  );

  const unavailableDates = await pool.query<UnavailableDateRow>(
    `
      SELECT id, teacher_id, unavailable_date, start_time, end_time, reason, created_by_user_id, created_at, updated_at
      FROM teacher_unavailable_dates
      WHERE teacher_id = $1
      ORDER BY unavailable_date DESC, start_time
    `,
    [teacherId]
  );

  return {
    availability: availability.rows.map(mapAvailability),
    unavailableDates: unavailableDates.rows.map(mapUnavailableDate)
  };
}

export async function createAvailability(
  teacherId: string,
  input: CreateAvailabilityInput
): Promise<ReturnType<typeof mapAvailability>> {
  await getTeacherById(teacherId);

  const result = await pool.query<AvailabilityRow>(
    `
      INSERT INTO teacher_availability (
        teacher_id,
        day_of_week,
        start_time,
        end_time,
        timezone,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, teacher_id, day_of_week, start_time, end_time, timezone, is_active, created_at, updated_at
    `,
    [
      teacherId,
      input.dayOfWeek,
      input.startTime,
      input.endTime,
      input.timezone,
      input.isActive ?? true
    ]
  );

  return mapAvailability(result.rows[0]);
}

export async function replaceAvailability(
  teacherId: string,
  input: ReplaceAvailabilityInput,
  user: AuthenticatedUser
): Promise<Awaited<ReturnType<typeof listAvailability>>> {
  await assertCanManageTeacherAvailability(teacherId, user);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM teacher_availability WHERE teacher_id = $1", [teacherId]);

    for (const slot of input.availability) {
      await client.query(
        `
          INSERT INTO teacher_availability (
            teacher_id,
            day_of_week,
            start_time,
            end_time,
            timezone,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          teacherId,
          slot.dayOfWeek,
          slot.startTime,
          slot.endTime,
          slot.timezone,
          slot.isActive ?? true
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return await listAvailability(teacherId);
}

export async function createUnavailableDate(
  teacherId: string,
  input: CreateUnavailableDateInput,
  createdByUserId: string
): Promise<ReturnType<typeof mapUnavailableDate>> {
  await getTeacherById(teacherId);

  if ((input.startTime && !input.endTime) || (!input.startTime && input.endTime)) {
    throw new ApiError(422, "Both startTime and endTime are required for partial-day blocks", "INVALID_TIME_WINDOW");
  }

  const result = await pool.query<UnavailableDateRow>(
    `
      INSERT INTO teacher_unavailable_dates (
        teacher_id,
        unavailable_date,
        start_time,
        end_time,
        reason,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, teacher_id, unavailable_date, start_time, end_time, reason, created_by_user_id, created_at, updated_at
    `,
    [
      teacherId,
      input.unavailableDate,
      input.startTime ?? null,
      input.endTime ?? null,
      input.reason ?? null,
      createdByUserId
    ]
  );

  return mapUnavailableDate(result.rows[0]);
}

export async function deleteUnavailableDate(teacherId: string, dateId: string): Promise<void> {
  const result = await pool.query(
    "DELETE FROM teacher_unavailable_dates WHERE id = $1 AND teacher_id = $2",
    [dateId, teacherId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "Unavailable date not found", "UNAVAILABLE_DATE_NOT_FOUND");
  }
}

function baseTeacherSelect(): string {
  return `
    SELECT DISTINCT
      u.id,
      u.username,
      u.first_name,
      u.last_name,
      u.email,
      u.phone,
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

function mapTeacher(row: TeacherRow): TeacherItem {
  return {
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    status: row.status,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAvailability(row: AvailabilityRow) {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    timezone: row.timezone,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUnavailableDate(row: UnavailableDateRow) {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    unavailableDate: row.unavailable_date,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function assertCanManageTeacherAvailability(teacherId: string, user: AuthenticatedUser): Promise<void> {
  await getTeacherById(teacherId);

  if (user.roles.includes("admin") || user.roles.includes("support") || user.id === teacherId) {
    return;
  }

  throw new ApiError(403, "Cannot update another teacher availability", "TEACHER_AVAILABILITY_FORBIDDEN");
}
