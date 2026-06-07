import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as teachersController from "./teachers.controller.js";
import {
  createAvailabilitySchema,
  createUnavailableDateSchema,
  deleteUnavailableDateSchema,
  listTeachersSchema,
  replaceAvailabilitySchema,
  teacherIdSchema
} from "./teachers.validation.js";

export const teachersRoutes = Router();

teachersRoutes.use(authMiddleware);

teachersRoutes.get("/", requirePermission("teacher.view"), validate(listTeachersSchema), teachersController.listTeachers);
teachersRoutes.get("/:id", requirePermission("teacher.view"), validate(teacherIdSchema), teachersController.getTeacher);
teachersRoutes.get(
  "/:id/availability",
  requirePermission("teacher.view"),
  validate(teacherIdSchema),
  teachersController.listAvailability
);
teachersRoutes.post(
  "/:id/availability",
  requirePermission("teacher.update"),
  validate(createAvailabilitySchema),
  teachersController.createAvailability
);
teachersRoutes.patch(
  "/:id/availability",
  requirePermission("teacher.view"),
  validate(replaceAvailabilitySchema),
  teachersController.replaceAvailability
);
teachersRoutes.post(
  "/:id/unavailable-dates",
  requirePermission("teacher.update"),
  validate(createUnavailableDateSchema),
  teachersController.createUnavailableDate
);
teachersRoutes.delete(
  "/:id/unavailable-dates/:dateId",
  requirePermission("teacher.update"),
  validate(deleteUnavailableDateSchema),
  teachersController.deleteUnavailableDate
);
