import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as notificationController from "./notifications.controller.js";
import {
  createNotificationRuleSchema,
  listDeliveryLogsSchema,
  listNotificationRulesSchema,
  updateNotificationRuleSchema,
  updateNotificationRuleStatusSchema
} from "./notifications.validation.js";

export const notificationRulesRoutes = Router();
export const notificationDeliveryLogsRoutes = Router();

notificationRulesRoutes.use(authMiddleware);
notificationDeliveryLogsRoutes.use(authMiddleware);

notificationRulesRoutes.get(
  "/",
  requirePermission("notification.view"),
  validate(listNotificationRulesSchema),
  notificationController.listNotificationRules
);
notificationRulesRoutes.post(
  "/",
  requirePermission("notification.update"),
  validate(createNotificationRuleSchema),
  notificationController.createNotificationRule
);
notificationRulesRoutes.patch(
  "/:id",
  requirePermission("notification.update"),
  validate(updateNotificationRuleSchema),
  notificationController.updateNotificationRule
);
notificationRulesRoutes.patch(
  "/:id/status",
  requirePermission("notification.update"),
  validate(updateNotificationRuleStatusSchema),
  notificationController.updateNotificationRuleStatus
);

notificationDeliveryLogsRoutes.get(
  "/",
  requirePermission("notification.view"),
  validate(listDeliveryLogsSchema),
  notificationController.listDeliveryLogs
);
