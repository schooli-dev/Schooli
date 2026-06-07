import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as assignmentController from "./teacherStudentAssignments.controller.js";
import {
  createAssignmentSchema,
  listAssignmentsSchema,
  updateAssignmentStatusSchema
} from "./teacherStudentAssignments.validation.js";

export const teacherStudentAssignmentsRoutes = Router();

teacherStudentAssignmentsRoutes.use(authMiddleware);

teacherStudentAssignmentsRoutes.get(
  "/",
  requirePermission("teacher.view"),
  validate(listAssignmentsSchema),
  assignmentController.listAssignments
);
teacherStudentAssignmentsRoutes.post(
  "/",
  requirePermission("teacher.update"),
  validate(createAssignmentSchema),
  assignmentController.createAssignment
);
teacherStudentAssignmentsRoutes.patch(
  "/:id/status",
  requirePermission("teacher.update"),
  validate(updateAssignmentStatusSchema),
  assignmentController.updateAssignmentStatus
);
