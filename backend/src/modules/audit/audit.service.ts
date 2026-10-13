import type { Pool, PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import { getPagination, getPaginationMeta, type PaginationMeta } from "../../utils/pagination.js";
import type { ListAuditLogsInput } from "./audit.validation.js";

/**
 * Audit trail: a read-only, chronological history of important actions.
 * Rows are written by the module that performs the action (inside the same transaction, so a rolled
 * back action leaves no trace) and are only ever read by admins through GET /api/audit.
 *
 * To audit a new module: add it to `auditModules`, then call `recordAudit` where its actions happen.
 */

export const auditModules = [
  {
    key: "homework",
    label: "Homework",
    actions: [
      { key: "homework.assigned", label: "Assigned" },
      { key: "homework.updated", label: "Updated" },
      { key: "homework.withdrawn", label: "Withdrawn" },
      { key: "homework.submitted", label: "Submitted" },
      { key: "homework.resubmitted", label: "Resubmitted" },
      { key: "homework.reviewed", label: "Reviewed" },
      { key: "homework.revision_required", label: "Revision required" },
      { key: "homework.completed", label: "Completed" }
    ]
  }
] as const;

export type AuditEntry = {
  module: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string; name: string; role: string } | null;
  subjectUserId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  /** Written as a DB offset so two entries of one action (reviewed, then its outcome) keep their order. */
  offsetMs?: number;
};

type Queryable = Pool | PoolClient;

export async function recordAudit(entry: AuditEntry, db: Queryable = pool): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (actor_user_id, actor_name, actor_role, action, module, entity_type, entity_id, subject_user_id, summary, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::JSONB, clock_timestamp() + ($11::INT * INTERVAL '1 millisecond'))`,
    [
      entry.actor?.id ?? null,
      entry.actor?.name ?? null,
      entry.actor?.role ?? null,
      entry.action,
      entry.module,
      entry.entityType,
      entry.entityId,
      entry.subjectUserId ?? null,
      entry.summary,
      JSON.stringify(entry.metadata ?? {}),
      entry.offsetMs ?? 0
    ]
  );
}

export type AuditLogItem = {
  id: string;
  createdAt: Date;
  module: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  actorName: string | null;
  actorRole: string | null;
  studentName: string | null;
  homeworkTitle: string | null;
  curriculumModule: string | null;
  lessonLabel: string | null;
  attempt: number | null;
  points: number | null;
  maxPoints: number | null;
  backfilled: boolean;
};

type Row = {
  id: string;
  created_at: Date;
  module: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  actor_name: string | null;
  actor_role: string | null;
  metadata: Record<string, unknown> | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numeric(value: unknown): number | null {
  return typeof value === "number" ? value : typeof value === "string" && value !== "" && !Number.isNaN(Number(value)) ? Number(value) : null;
}

function mapRow(row: Row): AuditLogItem {
  const meta = row.metadata ?? {};
  const lessonNumber = numeric(meta.lessonNumber);
  const lessonTitle = text(meta.lessonTitle);
  return {
    id: row.id,
    createdAt: row.created_at,
    module: row.module,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary ?? row.action,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    studentName: text(meta.studentName),
    homeworkTitle: text(meta.homeworkTitle),
    curriculumModule: text(meta.moduleName),
    lessonLabel: lessonTitle ? (lessonNumber ? `Class ${lessonNumber} - ${lessonTitle}` : lessonTitle) : null,
    attempt: numeric(meta.attempt),
    points: numeric(meta.points),
    maxPoints: numeric(meta.maxPoints),
    backfilled: meta.backfilled === true
  };
}

export async function listAuditLogs(input: ListAuditLogsInput): Promise<{ items: AuditLogItem[]; pagination: PaginationMeta }> {
  const { page, limit, offset } = getPagination(input);
  const values: unknown[] = [];
  const filters: string[] = [];
  const param = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (input.module) filters.push(`a.module = ${param(input.module)}`);
  // "Include": only the chosen event types.
  if (input.actions?.length) filters.push(`a.action = ANY(${param(input.actions)}::TEXT[])`);
  if (input.from) filters.push(`a.created_at >= ${param(input.from)}::TIMESTAMPTZ`);
  if (input.to) filters.push(`a.created_at <= ${param(input.to)}::TIMESTAMPTZ`);
  if (input.entityId) filters.push(`a.entity_id = ${param(input.entityId)}::UUID`);
  if (input.actorRole) filters.push(`a.actor_role = ${param(input.actorRole)}`);
  if (input.search) {
    const like = param(`%${input.search}%`);
    filters.push(
      `(a.summary ILIKE ${like} OR a.actor_name ILIKE ${like} OR a.metadata->>'studentName' ILIKE ${like}
        OR a.metadata->>'teacherName' ILIKE ${like} OR a.metadata->>'homeworkTitle' ILIKE ${like}
        OR a.metadata->>'moduleName' ILIKE ${like} OR a.metadata->>'courseName' ILIKE ${like})`
    );
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const direction = input.sort === "asc" ? "ASC" : "DESC";

  const total = (await pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM audit_logs a ${where}`, values)).rows[0].count;
  const rows = await pool.query<Row>(
    `SELECT a.id, a.created_at, a.module, a.action, a.entity_type, a.entity_id, a.summary, a.actor_name, a.actor_role, a.metadata
     FROM audit_logs a ${where}
     ORDER BY a.created_at ${direction}, a.id ${direction}
     LIMIT ${param(limit)} OFFSET ${param(offset)}`,
    values
  );

  return { items: rows.rows.map(mapRow), pagination: getPaginationMeta(page, limit, Number(total)) };
}
