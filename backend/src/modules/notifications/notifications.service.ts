import { pool } from "../../db/pool.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, getPaginationMeta, type PaginationMeta } from "../../utils/pagination.js";
import type {
  CreateNotificationRuleInput,
  ListDeliveryLogsInput,
  ListNotificationRulesInput,
  UpdateNotificationRuleInput,
  UpdateNotificationRuleStatusInput
} from "./notifications.validation.js";

type NotificationRuleRow = {
  id: string;
  event_key: string;
  channel: string;
  recipient_role: string;
  email_template_id: string | null;
  email_template_key: string | null;
  is_enabled: boolean;
  conditions: Record<string, unknown>;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type DeliveryLogRow = {
  id: string;
  notification_rule_id: string | null;
  event_key: string;
  channel: string;
  recipient_user_id: string | null;
  recipient_email: string | null;
  email_template_id: string | null;
  subject: string | null;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  payload: Record<string, unknown>;
  sent_at: Date | null;
  created_at: Date;
};

export async function listNotificationRules(input: ListNotificationRulesInput): Promise<{
  rules: ReturnType<typeof mapRule>[];
  pagination: PaginationMeta;
}> {
  const { page, limit, offset } = getPagination(input);
  const values: unknown[] = [];
  const filters: string[] = [];

  addFilter(filters, values, "nr.event_key", input.eventKey);
  addFilter(filters, values, "nr.channel", input.channel);
  addFilter(filters, values, "nr.recipient_role", input.recipientRole);

  if (input.isEnabled !== undefined) {
    values.push(input.isEnabled);
    filters.push(`nr.is_enabled = $${values.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM notification_rules nr ${whereClause}`,
    values
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(limit, offset);
  const result = await pool.query<NotificationRuleRow>(
    `
      ${baseRuleSelect()}
      ${whereClause}
      ORDER BY nr.updated_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    rules: result.rows.map(mapRule),
    pagination: getPaginationMeta(page, limit, total)
  };
}

export async function createNotificationRule(
  input: CreateNotificationRuleInput,
  userId: string
): Promise<ReturnType<typeof mapRule>> {
  await assertEmailTemplateExistsIfProvided(input.emailTemplateId ?? null);

  try {
    const result = await pool.query<{ id: string }>(
      `
        INSERT INTO notification_rules (
          event_key,
          channel,
          recipient_role,
          email_template_id,
          is_enabled,
          conditions,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6::JSONB, $7, $7)
        RETURNING id
      `,
      [
        input.eventKey,
        input.channel,
        input.recipientRole,
        input.emailTemplateId ?? null,
        input.isEnabled ?? true,
        JSON.stringify(input.conditions),
        userId
      ]
    );

    return await getNotificationRuleById(result.rows[0].id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "Notification rule already exists for this event/channel/role", "NOTIFICATION_RULE_EXISTS");
    }

    throw error;
  }
}

export async function updateNotificationRule(
  id: string,
  input: UpdateNotificationRuleInput,
  userId: string
): Promise<ReturnType<typeof mapRule>> {
  await assertEmailTemplateExistsIfProvided(input.emailTemplateId ?? null);

  const updates: string[] = [];
  const values: unknown[] = [];

  addUpdate(updates, values, "event_key", input.eventKey);
  addUpdate(updates, values, "channel", input.channel);
  addUpdate(updates, values, "recipient_role", input.recipientRole);
  addUpdate(updates, values, "email_template_id", input.emailTemplateId);

  if (input.conditions !== undefined) {
    values.push(JSON.stringify(input.conditions));
    updates.push(`conditions = $${values.length}::JSONB`);
  }

  values.push(userId);
  updates.push(`updated_by_user_id = $${values.length}`);
  values.push(id);

  try {
    const result = await pool.query<{ id: string }>(
      `
        UPDATE notification_rules
        SET ${updates.join(", ")},
            updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id
      `,
      values
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "Notification rule not found", "NOTIFICATION_RULE_NOT_FOUND");
    }

    return await getNotificationRuleById(id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "Notification rule already exists for this event/channel/role", "NOTIFICATION_RULE_EXISTS");
    }

    throw error;
  }
}

export async function updateNotificationRuleStatus(
  id: string,
  input: UpdateNotificationRuleStatusInput,
  userId: string
): Promise<ReturnType<typeof mapRule>> {
  const result = await pool.query<{ id: string }>(
    `
      UPDATE notification_rules
      SET is_enabled = $1,
          updated_by_user_id = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING id
    `,
    [input.isEnabled, userId, id]
  );

  if (!result.rows[0]) {
    throw new ApiError(404, "Notification rule not found", "NOTIFICATION_RULE_NOT_FOUND");
  }

  return await getNotificationRuleById(id);
}

export async function getNotificationRuleById(id: string): Promise<ReturnType<typeof mapRule>> {
  const result = await pool.query<NotificationRuleRow>(
    `
      ${baseRuleSelect()}
      WHERE nr.id = $1
    `,
    [id]
  );
  const rule = result.rows[0];

  if (!rule) {
    throw new ApiError(404, "Notification rule not found", "NOTIFICATION_RULE_NOT_FOUND");
  }

  return mapRule(rule);
}

export async function listDeliveryLogs(input: ListDeliveryLogsInput): Promise<{
  logs: ReturnType<typeof mapDeliveryLog>[];
  pagination: PaginationMeta;
}> {
  const { page, limit, offset } = getPagination(input);
  const values: unknown[] = [];
  const filters: string[] = [];

  addFilter(filters, values, "event_key", input.eventKey);
  addFilter(filters, values, "channel", input.channel);
  addFilter(filters, values, "status", input.status);
  addFilter(filters, values, "recipient_user_id", input.recipientUserId);

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM notification_delivery_logs ${whereClause}`,
    values
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(limit, offset);
  const result = await pool.query<DeliveryLogRow>(
    `
      SELECT id, notification_rule_id, event_key, channel, recipient_user_id,
             recipient_email, email_template_id, subject, status, provider_message_id,
             error_message, payload, sent_at, created_at
      FROM notification_delivery_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    logs: result.rows.map(mapDeliveryLog),
    pagination: getPaginationMeta(page, limit, total)
  };
}

async function assertEmailTemplateExistsIfProvided(emailTemplateId: string | null): Promise<void> {
  if (!emailTemplateId) {
    return;
  }

  const result = await pool.query<{ id: string }>(
    "SELECT id FROM email_templates WHERE id = $1",
    [emailTemplateId]
  );

  if (!result.rows[0]) {
    throw new ApiError(422, "Email template does not exist", "EMAIL_TEMPLATE_NOT_FOUND");
  }
}

function baseRuleSelect(): string {
  return `
    SELECT nr.id, nr.event_key, nr.channel, nr.recipient_role, nr.email_template_id,
           et.key AS email_template_key, nr.is_enabled, nr.conditions,
           nr.created_by_user_id, nr.updated_by_user_id, nr.created_at, nr.updated_at
    FROM notification_rules nr
    LEFT JOIN email_templates et ON et.id = nr.email_template_id
  `;
}

function mapRule(row: NotificationRuleRow) {
  return {
    id: row.id,
    eventKey: row.event_key,
    channel: row.channel,
    recipientRole: row.recipient_role,
    emailTemplateId: row.email_template_id,
    emailTemplateKey: row.email_template_key,
    isEnabled: row.is_enabled,
    conditions: row.conditions,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDeliveryLog(row: DeliveryLogRow) {
  return {
    id: row.id,
    notificationRuleId: row.notification_rule_id,
    eventKey: row.event_key,
    channel: row.channel,
    recipientUserId: row.recipient_user_id,
    recipientEmail: row.recipient_email,
    emailTemplateId: row.email_template_id,
    subject: row.subject,
    status: row.status,
    providerMessageId: row.provider_message_id,
    errorMessage: row.error_message,
    payload: row.payload,
    sentAt: row.sent_at,
    createdAt: row.created_at
  };
}

function addFilter(filters: string[], values: unknown[], column: string, value: unknown): void {
  if (value === undefined) {
    return;
  }

  values.push(value);
  filters.push(`${column} = $${values.length}`);
}

function addUpdate(
  updates: string[],
  values: unknown[],
  column: string,
  value: string | Record<string, unknown> | null | undefined
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
