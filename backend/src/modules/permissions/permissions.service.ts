import { pool } from "../../db/pool.js";
import { getPagePermissionCatalog, type PagePermissionGroup } from "../navigation/navigation.policy.js";

export type PermissionListItem = {
  id: string;
  key: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PermissionRow = {
  id: string;
  key: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function listPermissions(): Promise<PermissionListItem[]> {
  const result = await pool.query<PermissionRow>(
    `
      SELECT id, key, description, created_at, updated_at
      FROM permissions
      ORDER BY key
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    key: row.key,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export function listPagePermissions(): PagePermissionGroup[] {
  return getPagePermissionCatalog();
}
