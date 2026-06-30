import type { Request, RequestHandler } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as notificationService from "./notifications.service.js";

export const listNotificationRules: RequestHandler = asyncHandler(async (req, res) => {
  const result = await notificationService.listNotificationRules(req.query);

  sendSuccess(res, {
    message: "Notification rules fetched",
    data: result.rules,
    pagination: result.pagination
  });
});

export const createNotificationRule: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const rule = await notificationService.createNotificationRule(req.body, req.user.id);

  sendSuccess(res, {
    statusCode: 201,
    message: "Notification rule created",
    data: rule
  });
});

export const updateNotificationRule: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const rule = await notificationService.updateNotificationRule(getIdParam(req), req.body, req.user.id);

  sendSuccess(res, {
    message: "Notification rule updated",
    data: rule
  });
});

export const updateNotificationRuleStatus: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const rule = await notificationService.updateNotificationRuleStatus(getIdParam(req), req.body, req.user.id);

  sendSuccess(res, {
    message: "Notification rule status updated",
    data: rule
  });
});

export const listDeliveryLogs: RequestHandler = asyncHandler(async (req, res) => {
  const result = await notificationService.listDeliveryLogs(req.query);

  sendSuccess(res, {
    message: "Notification delivery logs fetched",
    data: result.logs,
    pagination: result.pagination
  });
});

export const listMyNotifications: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const result = await notificationService.listMyNotifications(req.user.id, {
    limit: Number(req.query.limit ?? 5)
  });

  sendSuccess(res, {
    message: "Notifications fetched",
    data: result
  });
});

export const markMyNotificationsRead: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const result = await notificationService.markMyNotificationsRead(req.user.id);

  sendSuccess(res, {
    message: "Notifications marked as read",
    data: result
  });
});

function getIdParam(req: Request): string {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
}
