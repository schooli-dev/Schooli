import { pool } from "../../db/pool.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, getPaginationMeta, type PaginationMeta } from "../../utils/pagination.js";
import type {
  CreateEmailTemplateInput,
  ListEmailTemplatesInput,
  UpdateEmailTemplateInput,
  UpdateEmailTemplateStatusInput
} from "./emailTemplates.validation.js";

export type EmailTemplateItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  availableVariables: string[];
  isActive: boolean;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EmailTemplateRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  available_variables: string[];
  is_active: boolean;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function listEmailTemplates(input: ListEmailTemplatesInput): Promise<{
  templates: EmailTemplateItem[];
  pagination: PaginationMeta;
}> {
  const { page, limit, offset } = getPagination(input);
  const values: unknown[] = [];
  const filters: string[] = [];

  if (input.search) {
    values.push(`%${input.search}%`);
    filters.push(`(key ILIKE $${values.length} OR name ILIKE $${values.length} OR subject ILIKE $${values.length})`);
  }

  if (input.isActive !== undefined) {
    values.push(input.isActive);
    filters.push(`is_active = $${values.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM email_templates ${whereClause}`,
    values
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(limit, offset);
  const result = await pool.query<EmailTemplateRow>(
    `
      ${baseTemplateSelect()}
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
    `,
    values
  );

  return {
    templates: result.rows.map(mapTemplate),
    pagination: getPaginationMeta(page, limit, total)
  };
}

export async function createEmailTemplate(
  input: CreateEmailTemplateInput,
  userId: string
): Promise<EmailTemplateItem> {
  try {
    const result = await pool.query<{ id: string }>(
      `
        INSERT INTO email_templates (
          key,
          name,
          description,
          subject,
          html_body,
          text_body,
          available_variables,
          is_active,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::JSONB, $8, $9, $9)
        RETURNING id
      `,
      [
        input.key,
        input.name,
        input.description ?? null,
        input.subject,
        input.htmlBody,
        input.textBody ?? null,
        JSON.stringify(input.availableVariables),
        input.isActive ?? true,
        userId
      ]
    );

    return await getEmailTemplateById(result.rows[0].id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "Email template key already exists", "EMAIL_TEMPLATE_ALREADY_EXISTS");
    }

    throw error;
  }
}

export async function getEmailTemplateById(id: string): Promise<EmailTemplateItem> {
  const result = await pool.query<EmailTemplateRow>(
    `
      ${baseTemplateSelect()}
      WHERE id = $1
    `,
    [id]
  );
  const template = result.rows[0];

  if (!template) {
    throw new ApiError(404, "Email template not found", "EMAIL_TEMPLATE_NOT_FOUND");
  }

  return mapTemplate(template);
}

export async function updateEmailTemplate(
  id: string,
  input: UpdateEmailTemplateInput,
  userId: string
): Promise<EmailTemplateItem> {
  const updates: string[] = [];
  const values: unknown[] = [];

  addUpdate(updates, values, "key", input.key);
  addUpdate(updates, values, "name", input.name);
  addUpdate(updates, values, "description", input.description);
  addUpdate(updates, values, "subject", input.subject);
  addUpdate(updates, values, "html_body", input.htmlBody);
  addUpdate(updates, values, "text_body", input.textBody);

  if (input.availableVariables !== undefined) {
    values.push(JSON.stringify(input.availableVariables));
    updates.push(`available_variables = $${values.length}::JSONB`);
  }

  values.push(userId);
  updates.push(`updated_by_user_id = $${values.length}`);

  values.push(id);

  try {
    const result = await pool.query<{ id: string }>(
      `
        UPDATE email_templates
        SET ${updates.join(", ")},
            updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING id
      `,
      values
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "Email template not found", "EMAIL_TEMPLATE_NOT_FOUND");
    }

    return await getEmailTemplateById(id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "Email template key already exists", "EMAIL_TEMPLATE_ALREADY_EXISTS");
    }

    throw error;
  }
}

export async function updateEmailTemplateStatus(
  id: string,
  input: UpdateEmailTemplateStatusInput,
  userId: string
): Promise<EmailTemplateItem> {
  const result = await pool.query<{ id: string }>(
    `
      UPDATE email_templates
      SET is_active = $1,
          updated_by_user_id = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING id
    `,
    [input.isActive, userId, id]
  );

  if (!result.rows[0]) {
    throw new ApiError(404, "Email template not found", "EMAIL_TEMPLATE_NOT_FOUND");
  }

  return await getEmailTemplateById(id);
}

function baseTemplateSelect(): string {
  return `
    SELECT id, key, name, description, subject, html_body, text_body,
           available_variables, is_active, created_by_user_id, updated_by_user_id,
           created_at, updated_at
    FROM email_templates
  `;
}

function mapTemplate(row: EmailTemplateRow): EmailTemplateItem {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    subject: row.subject,
    htmlBody: row.html_body,
    textBody: row.text_body,
    availableVariables: row.available_variables,
    isActive: row.is_active,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
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
