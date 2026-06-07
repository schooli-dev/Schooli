import { pool } from "../../db/pool.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, getPaginationMeta, type PaginationMeta } from "../../utils/pagination.js";
import type {
  CreateAssignmentInput,
  ListAssignmentsInput,
  UpdateAssignmentStatusInput
} from "./teacherStudentAssignments.validation.js";

export type AssignmentItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: string;
  assignedByUserId: string | null;
  assignedAt: Date;
  endedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AssignmentRow = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  teacher_email: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: string;
  assigned_by_user_id: string | null;
  assigned_at: Date;
  ended_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function listAssignments(input: ListAssignmentsInput): Promise<{
  assignments: AssignmentItem[];
  pagination: PaginationMeta;
}> {
  const { page, limit, offset } = getPagination(input);
  const values: unknown[] = [];
  const filters: string[] = [];

  if (input.status) {
    values.push(input.status);
    filters.push(`tsa.status = $${values.length}`);
  }

  if (input.teacherId) {
    values.push(input.teacherId);
    filters.push(`tsa.teacher_id = $${values.length}`);
  }

  if (input.studentId) {
    values.push(input.studentId);
    filters.push(`tsa.student_id = $${values.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM teacher_student_assignments tsa ${whereClause}`,
    values
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(limit, offset);
  const result = await pool.query<AssignmentRow>(
    `
      ${baseAssignmentSelect()}
      ${whereClause}
      ORDER BY tsa.assigned_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    assignments: result.rows.map(mapAssignment),
    pagination: getPaginationMeta(page, limit, total)
  };
}

export async function createAssignment(
  input: CreateAssignmentInput,
  assignedByUserId: string
): Promise<AssignmentItem> {
  await assertUserHasRole(input.teacherId, "teacher");
  await assertUserHasRole(input.studentId, "student");

  try {
    const result = await pool.query<{ id: string }>(
      `
        INSERT INTO teacher_student_assignments (
          teacher_id,
          student_id,
          assigned_by_user_id,
          notes
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [input.teacherId, input.studentId, assignedByUserId, input.notes ?? null]
    );

    return await getAssignmentById(result.rows[0].id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "Active assignment already exists", "ASSIGNMENT_ALREADY_EXISTS");
    }

    throw error;
  }
}

export async function updateAssignmentStatus(
  id: string,
  input: UpdateAssignmentStatusInput
): Promise<AssignmentItem> {
  const result = await pool.query<{ id: string }>(
    `
      UPDATE teacher_student_assignments
      SET status = $1::assignment_status,
          ended_at = CASE
            WHEN $1::assignment_status = 'inactive' THEN COALESCE(ended_at, NOW())
            ELSE NULL
          END,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `,
    [input.status, id]
  );

  if (!result.rows[0]) {
    throw new ApiError(404, "Assignment not found", "ASSIGNMENT_NOT_FOUND");
  }

  return await getAssignmentById(id);
}

async function getAssignmentById(id: string): Promise<AssignmentItem> {
  const result = await pool.query<AssignmentRow>(
    `
      ${baseAssignmentSelect()}
      WHERE tsa.id = $1
    `,
    [id]
  );

  const assignment = result.rows[0];

  if (!assignment) {
    throw new ApiError(404, "Assignment not found", "ASSIGNMENT_NOT_FOUND");
  }

  return mapAssignment(assignment);
}

async function assertUserHasRole(userId: string, roleName: "teacher" | "student"): Promise<void> {
  const result = await pool.query<{ id: string }>(
    `
      SELECT u.id
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
        AND r.name = $2
        AND u.is_active = TRUE
        AND u.status = 'active'
    `,
    [userId, roleName]
  );

  if (!result.rows[0]) {
    throw new ApiError(422, `Selected user must be an active ${roleName}`, "INVALID_ASSIGNMENT_USER");
  }
}

function baseAssignmentSelect(): string {
  return `
    SELECT
      tsa.id,
      tsa.teacher_id,
      CONCAT(t.first_name, ' ', t.last_name) AS teacher_name,
      t.email AS teacher_email,
      tsa.student_id,
      CONCAT(s.first_name, ' ', s.last_name) AS student_name,
      s.email AS student_email,
      tsa.status,
      tsa.assigned_by_user_id,
      tsa.assigned_at,
      tsa.ended_at,
      tsa.notes,
      tsa.created_at,
      tsa.updated_at
    FROM teacher_student_assignments tsa
    JOIN users t ON t.id = tsa.teacher_id
    JOIN users s ON s.id = tsa.student_id
  `;
}

function mapAssignment(row: AssignmentRow): AssignmentItem {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    teacherEmail: row.teacher_email,
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    status: row.status,
    assignedByUserId: row.assigned_by_user_id,
    assignedAt: row.assigned_at,
    endedAt: row.ended_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
