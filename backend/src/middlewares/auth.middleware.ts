import type { NextFunction, Request, Response } from "express";
import { pool } from "../db/pool.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/jwt.js";

type AuthUserRow = {
  id: string;
  username: string | null;
  email: string;
  phone: string | null;
  timezone: string;
  first_name: string;
  last_name: string;
  roles: string[];
  permissions: string[];
};

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req);
    const payload = verifyAccessToken(token);

    const result = await pool.query<AuthUserRow>(
      `
        SELECT
          u.id,
          u.username,
          u.email,
          u.phone,
          u.timezone,
          u.first_name,
          u.last_name,
          COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
          COALESCE(array_agg(DISTINCT p.key) FILTER (WHERE p.key IS NOT NULL), '{}') AS permissions
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        LEFT JOIN permissions p ON p.id = rp.permission_id
        WHERE u.id = $1
          AND u.is_active = TRUE
          AND u.status = 'active'
        GROUP BY u.id
      `,
      [payload.sub]
    );

    const user = result.rows[0];

    if (!user) {
      throw new ApiError(401, "User is not active or no longer exists", "UNAUTHORIZED");
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      timezone: user.timezone,
      firstName: user.first_name,
      lastName: user.last_name,
      roles: user.roles,
      permissions: user.permissions
    };

    next();
  } catch (error) {
    next(error);
  }
}

function extractBearerToken(req: Request): string {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing bearer token", "MISSING_AUTH_TOKEN");
  }

  return authorization.slice("Bearer ".length).trim();
}
