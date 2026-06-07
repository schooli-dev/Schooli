import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import type { AuthenticatedUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import type { LoginInput, LogoutInput, RefreshInput } from "./auth.validation.js";

type UserAuthRow = {
  id: string;
  username: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  roles: string[];
  permissions: string[];
};

type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
  roles: string[];
  permissions: string[];
};

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await findActiveUserByIdentifier(input.identifier);

  if (!user) {
    throw new ApiError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const passwordMatches = await verifyPassword(input.password, user.password_hash);

  if (!passwordMatches) {
    throw new ApiError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const authResponse = await issueTokenPair(user.id);

  await pool.query("UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1", [user.id]);

  return {
    ...authResponse,
    user: mapUser(user),
    roles: user.roles,
    permissions: user.permissions
  };
}

export async function refresh(input: RefreshInput): Promise<AuthResponse> {
  const payload = verifyRefreshToken(input.refreshToken);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query<RefreshTokenRow>(
      `
        SELECT id, user_id, token_hash, expires_at, revoked_at
        FROM refresh_tokens
        WHERE id = $1
        FOR UPDATE
      `,
      [payload.tokenId]
    );

    const storedToken = tokenResult.rows[0];

    if (!storedToken || storedToken.user_id !== payload.sub || storedToken.revoked_at) {
      throw new ApiError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
    }

    if (storedToken.expires_at.getTime() <= Date.now()) {
      throw new ApiError(401, "Refresh token has expired", "REFRESH_TOKEN_EXPIRED");
    }

    const tokenMatches = await verifyPassword(input.refreshToken, storedToken.token_hash);

    if (!tokenMatches) {
      throw new ApiError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
    }

    await client.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [storedToken.id]);

    const user = await findActiveUserById(payload.sub, client);

    if (!user) {
      throw new ApiError(401, "User is not active or no longer exists", "UNAUTHORIZED");
    }

    const authResponse = await issueTokenPair(user.id, client);

    await client.query("COMMIT");

    return {
      ...authResponse,
      user: mapUser(user),
      roles: user.roles,
      permissions: user.permissions
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function logout(input: LogoutInput): Promise<void> {
  const payload = verifyRefreshToken(input.refreshToken);

  await pool.query(
    `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND revoked_at IS NULL
    `,
    [payload.tokenId, payload.sub]
  );
}

export async function getMe(userId: string): Promise<{
  user: AuthenticatedUser;
  roles: string[];
  permissions: string[];
}> {
  const user = await findActiveUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  }

  return {
    user: mapUser(user),
    roles: user.roles,
    permissions: user.permissions
  };
}

async function issueTokenPair(userId: string, client?: PoolClient): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const tokenId = crypto.randomUUID();
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId, tokenId);
  const tokenHash = await hashPassword(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const db = client ?? pool;

  await db.query(
    `
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [tokenId, userId, tokenHash, expiresAt]
  );

  return { accessToken, refreshToken };
}

async function findActiveUserByIdentifier(identifier: string): Promise<UserAuthRow | null> {
  const result = await pool.query<UserAuthRow>(
    userAuthQuery("LOWER(u.email::TEXT) = LOWER($1) OR LOWER(u.username) = LOWER($1) OR u.phone = $1"),
    [identifier]
  );

  return result.rows[0] ?? null;
}

async function findActiveUserById(userId: string, client?: PoolClient): Promise<UserAuthRow | null> {
  const db = client ?? pool;
  const result = await db.query<UserAuthRow>(userAuthQuery("u.id = $1"), [userId]);

  return result.rows[0] ?? null;
}

function userAuthQuery(whereClause: string): string {
  return `
    SELECT
      u.id,
      u.username,
      u.first_name,
      u.last_name,
      u.email,
      u.phone,
      u.password_hash,
      COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
      COALESCE(array_agg(DISTINCT p.key) FILTER (WHERE p.key IS NOT NULL), '{}') AS permissions
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE (${whereClause})
      AND u.is_active = TRUE
      AND u.status = 'active'
    GROUP BY u.id
  `;
}

function mapUser(user: UserAuthRow): AuthenticatedUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    firstName: user.first_name,
    lastName: user.last_name,
    roles: user.roles,
    permissions: user.permissions
  };
}
