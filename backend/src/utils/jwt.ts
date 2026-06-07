import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

export type AccessTokenPayload = {
  sub: string;
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  tokenId: string;
  type: "refresh";
};

export function signAccessToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign({ sub: userId, type: "access" }, env.JWT_ACCESS_SECRET, options);
}

export function signRefreshToken(userId: string, tokenId: string): string {
  const options: SignOptions = {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign({ sub: userId, tokenId, type: "refresh" }, env.JWT_REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);

    if (!isAccessTokenPayload(payload)) {
      throw new ApiError(401, "Invalid access token", "INVALID_ACCESS_TOKEN");
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(401, "Invalid or expired access token", "INVALID_ACCESS_TOKEN");
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);

    if (!isRefreshTokenPayload(payload)) {
      throw new ApiError(401, "Invalid refresh token", "INVALID_REFRESH_TOKEN");
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(401, "Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
  }
}

function isAccessTokenPayload(payload: unknown): payload is AccessTokenPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "sub" in payload &&
    "type" in payload &&
    typeof payload.sub === "string" &&
    payload.type === "access"
  );
}

function isRefreshTokenPayload(payload: unknown): payload is RefreshTokenPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "sub" in payload &&
    "tokenId" in payload &&
    "type" in payload &&
    typeof payload.sub === "string" &&
    typeof payload.tokenId === "string" &&
    payload.type === "refresh"
  );
}
