import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as dailyController from "./daily.controller.js";
import { createDailyRoomSchema, dailyJoinSchema, dailyLeaveSchema, getDailyRoomSchema } from "./daily.validation.js";

export const dailyRoutes = Router();
export const dailyClassRoutes = Router({ mergeParams: true });

dailyRoutes.post(
  "/rooms",
  authMiddleware,
  requirePermission("class.create"),
  validate(createDailyRoomSchema),
  dailyController.createRoom
);
dailyRoutes.get(
  "/rooms/:id",
  authMiddleware,
  requirePermission("class.view"),
  validate(getDailyRoomSchema),
  dailyController.getRoom
);
dailyRoutes.post("/webhook", dailyController.webhook);

dailyClassRoutes.use(authMiddleware);
dailyClassRoutes.post(
  "/join",
  requirePermission("class.join"),
  validate(dailyJoinSchema),
  dailyController.join
);
dailyClassRoutes.post(
  "/leave",
  requirePermission("class.join"),
  validate(dailyLeaveSchema),
  dailyController.leave
);
