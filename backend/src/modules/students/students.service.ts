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
