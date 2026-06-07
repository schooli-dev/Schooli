import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as attendanceController from "./attendance.controller.js";
import {
  attendanceIdSchema,
  classAttendanceSchema,
  listAttendanceSchema,
  markAttendanceSchema,
  updateAttendanceSchema
} from "./attendance.validation.js";

export const attendanceRoutes = Router();
export const classAttendanceRoutes = Router({ mergeParams: true });

attendanceRoutes.use(authMiddleware);
attendanceRoutes.get("/", requirePermission("attendance.view"), validate(listAttendanceSchema), attendanceController.listAttendance);
attendanceRoutes.post("/mark", requirePermission("attendance.mark"), validate(markAttendanceSchema), attendanceController.markAttendance);
attendanceRoutes.patch(
  "/:id",
  requirePermission("attendance.mark"),
  validate(updateAttendanceSchema),
  attendanceController.updateAttendance
);

classAttendanceRoutes.use(authMiddleware);
classAttendanceRoutes.get(
  "/",
  requirePermission("attendance.view"),
  validate(classAttendanceSchema),
  attendanceController.listClassAttendance
);
