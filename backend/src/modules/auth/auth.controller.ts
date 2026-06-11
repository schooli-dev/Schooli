import type { RequestHandler } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as authService from "./auth.service.js";

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);

  sendSuccess(res, {
    message: "Login successful",
    data
  });
});

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req.body);

  sendSuccess(res, {
    message: "Token refreshed",
    data
  });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  await authService.logout(req.body);

  sendSuccess(res, {
    message: "Logout successful"
  });
});

export const forgotPassword: RequestHandler = asyncHandler(async (req, res) => {
  const data = await authService.forgotPassword(req.body);

  sendSuccess(res, {
    message: "If the account exists, password reset instructions are ready.",
    data
  });
});

export const resetPassword: RequestHandler = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);

  sendSuccess(res, {
    message: "Password reset successful"
  });
});

export const me: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const data = await authService.getMe(req.user.id);

  sendSuccess(res, {
    message: "Current user fetched",
    data
  });
});
