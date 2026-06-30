import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import type { AuthenticatedUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { hashPassword } from "../../utils/password.js";
import { getPagination, getPaginationMeta, type PaginationMeta } from "../../utils/pagination.js";
import type {
  AssignUserRolesInput,
  CreateUserInput,
  ListUsersInput,
  UpdateUserInput,
  UpdateUserStatusInput
} from "./users.validation.js";

export type UserListItem = {
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
  lastLoginAt: Date | null;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
  teacherAvailability?: {
    availability: Array<{
      id: string;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      timezone: string;
      isActive: boolean;
    }>;
    unavailableDates: Array<{
      id: string;
      unavailableDate: string;
      startTime: string | null;
      endTime: string | null;
      reason: string | null;
    }>;
  };
  supportStats?: {
    assignedTickets: number;
    solvedTickets: number;
  };
};

type UserRow = {
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
  last_login_at: Date | null;
  roles: string[];
  created_at: Date;
  updated_at: Date;
};

export async function listUsers(input: ListUsersInput): Promise<{
  users: UserListItem[];
  pagination: PaginationMeta;
}> {
  const { page, limit, offset } = getPagination(input);
  const values: unknown[] = [];
  const filters: string[] = [];

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

  if (input.role) {
    values.push(input.role);
    filters.push(`
      EXISTS (
        SELECT 1
        FROM user_roles role_filter_ur
        JOIN roles role_filter_r ON role_filter_r.id = role_filter_ur.role_id
        WHERE role_filter_ur.user_id = u.id
          AND role_filter_r.name = $${values.length}
      )
    `);
  }

  if (input.createdFrom) {
    values.push(new Date(input.createdFrom));
    filters.push(`u.created_at >= $${values.length}`);
  }

  if (input.createdTo) {
    values.push(new Date(input.createdTo));
    filters.push(`u.created_at <= $${values.length}`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM users u ${whereClause}`,
    values
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(limit, offset);
  const result = await pool.query<UserRow>(
    `
      ${baseUserSelect()}
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    users: result.rows.map(mapUser),
    pagination: getPaginationMeta(page, limit, total)
  };
}

export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  assertNoAdminRole(input.roles ?? []);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const passwordHash = await hashPassword(input.password);
    const userResult = await client.query<{ id: string }>(
      `
        INSERT INTO users (
          first_name,
          last_name,
          username,
          email,
          phone,
          timezone,
          password_hash,
          avatar_url,
          status,
          is_active,
          must_change_password
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', TRUE, $9)
        RETURNING id
      `,
      [
        input.firstName,
        input.lastName,
        input.username ?? null,
        input.email,
        input.phone ?? null,
        input.timezone,
        passwordHash,
        input.avatarUrl ?? null,
        !(input.roles ?? []).includes("admin")
      ]
    );

    const userId = userResult.rows[0]?.id;

    if (!userId) {
      throw new ApiError(500, "User was not created", "USER_CREATE_FAILED");
    }

    if (input.roles?.length) {
      await replaceUserRoles(client, userId, input.roles);
    }

    await client.query("COMMIT");

    return await getUserById(userId);
  } catch (error) {
    await client.query("ROLLBACK");

    if (isUniqueViolation(error)) {
      throw new ApiError(409, "User email, username, or phone already exists", "USER_ALREADY_EXISTS");
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function getUserById(id: string): Promise<UserListItem> {
  const result = await pool.query<UserRow>(
    `
      ${baseUserSelect()}
      WHERE u.id = $1
      GROUP BY u.id
    `,
    [id]
  );

  const user = result.rows[0];

  if (!user) {
    throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  }

  const mappedUser = mapUser(user);

  return {
    ...mappedUser,
    teacherAvailability: mappedUser.roles.includes("teacher") ? await getTeacherAvailabilitySummary(id) : undefined,
    supportStats: mappedUser.roles.includes("support") ? await getSupportStats(id) : undefined
  };
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actor?: AuthenticatedUser
): Promise<UserListItem> {
  assertNotSelfChange(id, actor, "Admins cannot edit their own profile from user management");
  const updates: string[] = [];
  const values: unknown[] = [];

  addUpdate(updates, values, "first_name", input.firstName);
  addUpdate(updates, values, "last_name", input.lastName);
  addUpdate(updates, values, "username", input.username);
  addUpdate(updates, values, "email", input.email);
  addUpdate(updates, values, "phone", input.phone);
  addUpdate(updates, values, "timezone", input.timezone);
  addUpdate(updates, values, "avatar_url", input.avatarUrl);

  if (updates.length === 0) {
    throw new ApiError(400, "No update fields provided", "NO_UPDATE_FIELDS");
  }

  values.push(id);

  try {
    const result = await pool.query<{ id: string }>(
      `
        UPDATE users
        SET ${updates.join(", ")},
            updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id
      `,
      values
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "User not found", "USER_NOT_FOUND");
    }

    return await getUserById(id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "User email, username, or phone already exists", "USER_ALREADY_EXISTS");
    }

    throw error;
  }
}

export async function updateUserStatus(
  id: string,
  input: UpdateUserStatusInput,
  actor?: AuthenticatedUser
): Promise<UserListItem> {
  assertNotSelfChange(id, actor, "Admins cannot change their own status from user management");
  const result = await pool.query<{ id: string }>(
    `
      UPDATE users
      SET status = $1,
          is_active = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING id
    `,
    [input.status, input.isActive ?? input.status === "active", id]
  );

  if (!result.rows[0]) {
    throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  }

  return await getUserById(id);
}

export async function assignUserRoles(
  id: string,
  input: AssignUserRolesInput,
  actor?: AuthenticatedUser
): Promise<UserListItem> {
  assertNotSelfChange(id, actor, "Admins cannot change their own role from user management");
  assertNoAdminRole(input.roles);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userExists = await client.query<{ id: string }>("SELECT id FROM users WHERE id = $1", [id]);

    if (!userExists.rows[0]) {
      throw new ApiError(404, "User not found", "USER_NOT_FOUND");
    }

    await replaceUserRoles(client, id, input.roles);
    await client.query("COMMIT");

    return await getUserById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function replaceUserRoles(client: PoolClient, userId: string, roleNames: string[]): Promise<void> {
  const uniqueRoleNames = [...new Set(roleNames)];
  const rolesResult = await client.query<{ id: string; name: string }>(
    "SELECT id, name FROM roles WHERE name = ANY($1::TEXT[])",
    [uniqueRoleNames]
  );

  if (rolesResult.rows.length !== uniqueRoleNames.length) {
    const foundRoles = new Set(rolesResult.rows.map((role) => role.name));
    const missingRoles = uniqueRoleNames.filter((role) => !foundRoles.has(role));

    throw new ApiError(422, "One or more roles do not exist", "INVALID_ROLES", {
      missingRoles
    });
  }

  await client.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);

  for (const role of rolesResult.rows) {
    await client.query(
      `
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [userId, role.id]
    );
  }
}

async function getTeacherAvailabilitySummary(userId: string): Promise<NonNullable<UserListItem["teacherAvailability"]>> {
  const [availability, unavailableDates] = await Promise.all([
    pool.query<{
      id: string;
      day_of_week: string;
      start_time: string;
      end_time: string;
      timezone: string;
      is_active: boolean;
    }>(
      `
        SELECT id, day_of_week, start_time, end_time, timezone, is_active
        FROM teacher_availability
        WHERE teacher_id = $1
        ORDER BY day_of_week, start_time
      `,
      [userId]
    ),
    pool.query<{
      id: string;
      unavailable_date: string;
      start_time: string | null;
      end_time: string | null;
      reason: string | null;
    }>(
      `
        SELECT id, unavailable_date, start_time, end_time, reason
        FROM teacher_unavailable_dates
        WHERE teacher_id = $1
        ORDER BY unavailable_date DESC, start_time
        LIMIT 10
      `,
      [userId]
    )
  ]);

  return {
    availability: availability.rows.map((row) => ({
      id: row.id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      timezone: row.timezone,
      isActive: row.is_active
    })),
    unavailableDates: unavailableDates.rows.map((row) => ({
      id: row.id,
      unavailableDate: row.unavailable_date,
      startTime: row.start_time,
      endTime: row.end_time,
      reason: row.reason
    }))
  };
}

async function getSupportStats(userId: string): Promise<NonNullable<UserListItem["supportStats"]>> {
  const result = await pool.query<{ assigned_tickets: string; solved_tickets: string }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE assigned_to_user_id = $1)::TEXT AS assigned_tickets,
        COUNT(*) FILTER (WHERE assigned_to_user_id = $1 AND status IN ('resolved', 'closed'))::TEXT AS solved_tickets
      FROM tickets
    `,
    [userId]
  );

  return {
    assignedTickets: Number(result.rows[0]?.assigned_tickets ?? 0),
    solvedTickets: Number(result.rows[0]?.solved_tickets ?? 0)
  };
}

function assertNoAdminRole(roles: string[]): void {
  if (roles.includes("admin")) {
    throw new ApiError(403, "Admin users cannot be created or assigned from user management", "ADMIN_ROLE_FORBIDDEN");
  }
}

function assertNotSelfChange(userId: string, actor: AuthenticatedUser | undefined, message: string): void {
  if (actor?.id === userId) {
    throw new ApiError(403, message, "SELF_MANAGEMENT_FORBIDDEN");
  }
}

function baseUserSelect(): string {
  return `
    SELECT
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
      u.last_login_at,
      COALESCE(array_agg(DISTINCT r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
  `;
}

function mapUser(row: UserRow): UserListItem {
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
    lastLoginAt: row.last_login_at,
    roles: row.roles,
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

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
