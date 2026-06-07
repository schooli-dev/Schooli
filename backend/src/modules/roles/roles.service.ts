import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import { ApiError } from "../../utils/ApiError.js";

export type RoleListItem = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  usersAssigned: number;
  createdAt: Date;
  updatedAt: Date;
};

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  users_assigned: string;
  created_at: Date;
  updated_at: Date;
};

export async function listRoles(): Promise<RoleListItem[]> {
  const result = await pool.query<RoleRow>(
    `
      SELECT
        r.id,
        r.name,
        r.description,
        COALESCE(array_agg(p.key ORDER BY p.key) FILTER (WHERE p.key IS NOT NULL), '{}') AS permissions,
        COUNT(DISTINCT ur_users.user_id)::TEXT AS users_assigned,
        r.created_at,
        r.updated_at
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      LEFT JOIN user_roles ur_users ON ur_users.role_id = r.id
      GROUP BY r.id
      ORDER BY r.name
    `
  );

  return result.rows.map(mapRole);
}

export async function createRole(input: {
  name: string;
  description?: string | null;
  permissions: string[];
}): Promise<RoleListItem> {
  assertPermissionSelection(input.permissions);
  assertMutableRoleName(input.name);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roleResult = await client.query<{ id: string }>(
      `
        INSERT INTO roles (name, description)
        VALUES ($1, $2)
        RETURNING id
      `,
      [normalizeRoleName(input.name), input.description ?? null]
    );

    await replaceRolePermissions(client, roleResult.rows[0].id, input.permissions);
    await client.query("COMMIT");

    return await getRoleById(roleResult.rows[0].id);
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "Role name already exists", "ROLE_ALREADY_EXISTS");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateRole(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    permissions: string[];
  }
): Promise<RoleListItem> {
  assertPermissionSelection(input.permissions);

  const existing = await getRoleById(id);

  if (existing.name === "admin") {
    throw new ApiError(403, "Admin role cannot be edited", "PROTECTED_ROLE");
  }

  if (input.name) {
    assertMutableRoleName(input.name);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        UPDATE roles
        SET name = COALESCE($1, name),
            description = $2,
            updated_at = NOW()
        WHERE id = $3
      `,
      [input.name ? normalizeRoleName(input.name) : null, input.description ?? null, id]
    );

    await replaceRolePermissions(client, id, input.permissions);
    await client.query("COMMIT");

    return await getRoleById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error)) {
      throw new ApiError(409, "Role name already exists", "ROLE_ALREADY_EXISTS");
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getRoleById(id: string): Promise<RoleListItem> {
  const result = await pool.query<RoleRow>(
    `
      SELECT
        r.id,
        r.name,
        r.description,
        COALESCE(array_agg(p.key ORDER BY p.key) FILTER (WHERE p.key IS NOT NULL), '{}') AS permissions,
        COUNT(DISTINCT ur_users.user_id)::TEXT AS users_assigned,
        r.created_at,
        r.updated_at
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      LEFT JOIN user_roles ur_users ON ur_users.role_id = r.id
      WHERE r.id = $1
      GROUP BY r.id
    `,
    [id]
  );

  if (!result.rows[0]) {
    throw new ApiError(404, "Role not found", "ROLE_NOT_FOUND");
  }

  return mapRole(result.rows[0]);
}

async function replaceRolePermissions(client: PoolClient, roleId: string, permissionKeys: string[]): Promise<void> {
  const uniqueKeys = [...new Set(permissionKeys)];
  const permissions = await client.query<{ id: string; key: string }>(
    "SELECT id, key FROM permissions WHERE key = ANY($1::TEXT[])",
    [uniqueKeys]
  );

  if (permissions.rows.length !== uniqueKeys.length) {
    throw new ApiError(422, "Invalid permissions selected", "INVALID_PERMISSIONS");
  }

  await client.query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);

  for (const permission of permissions.rows) {
    await client.query(
      "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [roleId, permission.id]
    );
  }
}

function mapRole(row: RoleRow): RoleListItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: row.permissions,
    usersAssigned: Number(row.users_assigned ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function assertPermissionSelection(permissions: string[]): void {
  if (!permissions.length) {
    throw new ApiError(422, "At least one permission is required", "PERMISSION_REQUIRED");
  }
}

function assertMutableRoleName(name: string): void {
  if (["admin"].includes(normalizeRoleName(name))) {
    throw new ApiError(403, "Protected role name", "PROTECTED_ROLE");
  }
}

function normalizeRoleName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
