import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import type { AuthenticatedUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  LogoutInput,
  RefreshInput,
  ResetPasswordInput
} from "./auth.validation.js";

type UserAuthRow = {
  id: string;
  username: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  last_login_at: Date | null;
  must_change_password: boolean;
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

type PasswordResetTokenRow = {
  id: string;
  user_id: string;
  expires_at: Date;
  used_at: Date | null;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
};

const PASSWORD_RESET_TOKEN_MINUTES = 30;

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
  const mustChangePassword = shouldRequirePasswordChange(user);

  await pool.query(
    `
      UPDATE users
      SET last_login_at = NOW(),
          must_change_password = CASE WHEN $2 THEN TRUE ELSE must_change_password END,
          updated_at = NOW()
      WHERE id = $1
    `,
    [user.id, mustChangePassword]
  );

  return {
    ...authResponse,
    user: mapUser(user),
    roles: user.roles,
    permissions: user.permissions,
    mustChangePassword
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
      permissions: user.permissions,
      mustChangePassword: shouldRequirePasswordChange(user)
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

export async function forgotPassword(input: ForgotPasswordInput): Promise<{
  resetToken?: string;
  expiresAt?: Date;
}> {
  const user = await findActiveUserByIdentifier(input.identifier);

  if (!user) {
    return {};
  }

  const resetToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(resetToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_MINUTES * 60 * 1000);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [user.id]
    );
    await client.query(
      `
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `,
      [user.id, tokenHash, expiresAt]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (env.NODE_ENV === "production") {
    return {};
  }

  return { resetToken, expiresAt };
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashResetToken(input.token);
  const passwordHash = await hashPassword(input.password);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query<PasswordResetTokenRow>(
      `
        SELECT id, user_id, expires_at, used_at
        FROM password_reset_tokens
        WHERE token_hash = $1
        FOR UPDATE
      `,
      [tokenHash]
    );
    const token = tokenResult.rows[0];

    if (!token || token.used_at || token.expires_at.getTime() <= Date.now()) {
      throw new ApiError(400, "Reset link is invalid or expired", "PASSWORD_RESET_TOKEN_INVALID");
    }

    const user = await findActiveUserById(token.user_id, client);

    if (!user) {
      throw new ApiError(400, "Reset link is invalid or expired", "PASSWORD_RESET_TOKEN_INVALID");
    }

    await client.query(
      `
        UPDATE users
        SET password_hash = $1,
            updated_at = NOW()
        WHERE id = $2
      `,
      [passwordHash, token.user_id]
    );
    await client.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1", [token.id]);
    await client.query(
      `
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
      `,
      [token.user_id]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const passwordHash = await hashPassword(input.password);

  await pool.query(
    `
      UPDATE users
      SET password_hash = $1,
          must_change_password = FALSE,
          updated_at = NOW()
      WHERE id = $2
        AND is_active = TRUE
        AND status = 'active'
    `,
    [passwordHash, userId]
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

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
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
      u.last_login_at,
      u.must_change_password,
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

function shouldRequirePasswordChange(user: Pick<UserAuthRow, "roles" | "last_login_at" | "must_change_password">): boolean {
  return !user.roles.includes("admin") && (user.must_change_password || !user.last_login_at);
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
