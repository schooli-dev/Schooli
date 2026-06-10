import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import type { AuthenticatedUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, getPaginationMeta, type PaginationMeta } from "../../utils/pagination.js";
import { cancelZoomMeetingForClass } from "../zoom/zoom.service.js";
import type {
  CreateCancellationRequestInput,
  ListCancellationRequestsInput,
  UpdateCancellationRequestStatusInput
} from "./classCancellationRequests.validation.js";

export type CancellationRequestItem = {
  id: string;
  classId: string;
  classTitle: string;
  classStartTime: Date;
  teacherId: string;
  teacherName: string;
  requestedByUserId: string;
  requestedByName: string;
  requestedByRole: string;
  reason: string;
  status: string;
  adminNote: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CancellationRequestRow = {
  id: string;
  class_id: string;
  class_title: string;
  class_start_time: Date;
  teacher_id: string;
  teacher_name: string;
  requested_by_user_id: string;
  requested_by_name: string;
  requested_by_role: string;
  reason: string;
  status: string;
  admin_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function listCancellationRequests(
  input: ListCancellationRequestsInput,
  user: AuthenticatedUser
): Promise<{ requests: CancellationRequestItem[]; pagination: PaginationMeta }> {
  const { page, limit, offset } = getPagination(input);
  const values: unknown[] = [];
  const filters: string[] = [];

  addScopedCancellationFilters(filters, values, user);

  if (input.status) {
    values.push(input.status);
    filters.push(`ccr.status = $${values.length}`);
  }

  if (input.classId) {
    values.push(input.classId);
    filters.push(`ccr.class_id = $${values.length}`);
  }

  if (input.requestedByUserId) {
    values.push(input.requestedByUserId);
    filters.push(`ccr.requested_by_user_id = $${values.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const countResult = await pool.query<{ total: string }>(
    `
      SELECT COUNT(DISTINCT ccr.id) AS total
      FROM class_cancellation_requests ccr
      JOIN classes c ON c.id = ccr.class_id
      ${whereClause}
    `,
    values
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(limit, offset);
  const result = await pool.query<CancellationRequestRow>(
    `
      ${baseCancellationRequestSelect()}
      ${whereClause}
      ORDER BY ccr.created_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    requests: result.rows.map(mapCancellationRequest),
    pagination: getPaginationMeta(page, limit, total)
  };
}

export async function createCancellationRequest(
  classId: string,
  input: CreateCancellationRequestInput,
  user: AuthenticatedUser
): Promise<CancellationRequestItem> {
  await assertCanRequestClassCancellation(classId, user);

  const existingPending = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM class_cancellation_requests
      WHERE class_id = $1
        AND requested_by_user_id = $2
        AND status = 'pending'
      LIMIT 1
    `,
    [classId, user.id]
  );

  if (existingPending.rows[0]) {
    throw new ApiError(409, "Pending cancellation request already exists", "CANCELLATION_REQUEST_EXISTS");
  }

  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO class_cancellation_requests (
        class_id,
        requested_by_user_id,
        requested_by_role,
        reason
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [classId, user.id, getPrimaryRequesterRole(user), input.reason]
  );

  return await getCancellationRequestById(result.rows[0].id, user);
}

export async function updateCancellationRequestStatus(
  id: string,
  input: UpdateCancellationRequestStatusInput,
  user: AuthenticatedUser
): Promise<CancellationRequestItem> {
  if (input.status !== "withdrawn" && !user.permissions.includes("class.cancel")) {
    throw new ApiError(403, "Permission denied", "FORBIDDEN", { required: "class.cancel" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query<{ id: string; class_id: string; requested_by_user_id: string; status: string }>(
      `
        SELECT id, class_id, requested_by_user_id, status
        FROM class_cancellation_requests
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );
    const request = requestResult.rows[0];

    if (!request) {
      throw new ApiError(404, "Cancellation request not found", "CANCELLATION_REQUEST_NOT_FOUND");
    }

    if (request.status !== "pending") {
      throw new ApiError(409, "Only pending cancellation requests can be updated", "CANCELLATION_REQUEST_NOT_PENDING");
    }

    if (input.status === "withdrawn" && request.requested_by_user_id !== user.id && !user.roles.includes("admin")) {
      throw new ApiError(403, "Only requester or admin can withdraw this request", "FORBIDDEN");
    }

    await client.query(
      `
        UPDATE class_cancellation_requests
        SET status = $1::class_cancellation_request_status,
            admin_note = $2,
            reviewed_by_user_id = CASE WHEN $1::class_cancellation_request_status = 'withdrawn' THEN reviewed_by_user_id ELSE $3 END,
            reviewed_at = CASE WHEN $1::class_cancellation_request_status = 'withdrawn' THEN reviewed_at ELSE NOW() END,
            updated_at = NOW()
        WHERE id = $4
      `,
      [input.status, input.adminNote ?? null, user.id, id]
    );

  if (input.status === "approved") {
      await cancelClassForApprovedRequest(client, request.class_id, input.adminNote ?? "Cancellation request approved");
      await cancelZoomMeetingForClass(request.class_id, client);
      await updateTeacherWorkSessionStatus(client, request.class_id, "cancelled");
    }

    await client.query("COMMIT");

    return await getCancellationRequestById(id, user);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getCancellationRequestById(
  id: string,
  user: AuthenticatedUser
): Promise<CancellationRequestItem> {
  const values: unknown[] = [id];
  const filters = ["ccr.id = $1"];
  addScopedCancellationFilters(filters, values, user);

  const result = await pool.query<CancellationRequestRow>(
    `
      ${baseCancellationRequestSelect()}
      WHERE ${filters.join(" AND ")}
    `,
    values
  );
  const request = result.rows[0];

  if (!request) {
    throw new ApiError(404, "Cancellation request not found", "CANCELLATION_REQUEST_NOT_FOUND");
  }

  return mapCancellationRequest(request);
}

async function assertCanRequestClassCancellation(classId: string, user: AuthenticatedUser): Promise<void> {
  const values: unknown[] = [classId];
  const filters = ["c.id = $1", "c.status = 'scheduled'"];

  if (user.roles.includes("admin") || user.roles.includes("support")) {
    // Admin/support can request on behalf operationally when permission allows.
  } else if (user.roles.includes("teacher")) {
    values.push(user.id);
    filters.push(`c.teacher_id = $${values.length}`);
  } else {
    values.push(user.id);
    filters.push(`
      EXISTS (
        SELECT 1 FROM class_participants cp
        WHERE cp.class_id = c.id
          AND cp.student_id = $${values.length}
      )
    `);
  }

  const result = await pool.query<{ id: string }>(
    `
      SELECT c.id
      FROM classes c
      WHERE ${filters.join(" AND ")}
      LIMIT 1
    `,
    values
  );

  if (!result.rows[0]) {
    throw new ApiError(404, "Scheduled class not found for cancellation request", "CLASS_NOT_FOUND");
  }
}

async function cancelClassForApprovedRequest(
  client: PoolClient,
  classId: string,
  reason: string
): Promise<void> {
  const result = await client.query(
    `
      UPDATE classes
      SET status = 'cancelled',
          cancelled_at = NOW(),
          cancellation_reason = $1,
          updated_at = NOW()
      WHERE id = $2
        AND status = 'scheduled'
    `,
    [reason, classId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(409, "Class can no longer be cancelled", "CLASS_NOT_CANCELLABLE");
  }
}

async function updateTeacherWorkSessionStatus(
  client: PoolClient,
  classId: string,
  status: "cancelled"
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

function baseCancellationRequestSelect(): string {
  return `
    SELECT
      ccr.id,
      ccr.class_id,
      c.title AS class_title,
      c.start_time AS class_start_time,
      c.teacher_id,
      CONCAT(teacher.first_name, ' ', teacher.last_name) AS teacher_name,
      ccr.requested_by_user_id,
      CONCAT(requester.first_name, ' ', requester.last_name) AS requested_by_name,
      ccr.requested_by_role,
      ccr.reason,
      ccr.status,
      ccr.admin_note,
      ccr.reviewed_by_user_id,
      ccr.reviewed_at,
      ccr.created_at,
      ccr.updated_at
    FROM class_cancellation_requests ccr
    JOIN classes c ON c.id = ccr.class_id
    JOIN users teacher ON teacher.id = c.teacher_id
    JOIN users requester ON requester.id = ccr.requested_by_user_id
  `;
}

function addScopedCancellationFilters(
  filters: string[],
  values: unknown[],
  user: AuthenticatedUser
): void {
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
    (
      ccr.requested_by_user_id = $${values.length}
      OR EXISTS (
        SELECT 1 FROM class_participants scoped_cp
        WHERE scoped_cp.class_id = c.id
          AND scoped_cp.student_id = $${values.length}
      )
    )
  `);
}

function getPrimaryRequesterRole(user: AuthenticatedUser): string {
  if (user.roles.includes("student")) {
    return "student";
  }

  if (user.roles.includes("teacher")) {
    return "teacher";
  }

  if (user.roles.includes("support")) {
    return "support";
  }

  return "admin";
}

function mapCancellationRequest(row: CancellationRequestRow): CancellationRequestItem {
  return {
    id: row.id,
    classId: row.class_id,
    classTitle: row.class_title,
    classStartTime: row.class_start_time,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    requestedByUserId: row.requested_by_user_id,
    requestedByName: row.requested_by_name,
    requestedByRole: row.requested_by_role,
    reason: row.reason,
    status: row.status,
    adminNote: row.admin_note,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
