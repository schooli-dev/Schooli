import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as studentsController from "./students.controller.js";
import { listStudentsSchema, studentIdSchema } from "./students.validation.js";

export const studentsRoutes = Router();

studentsRoutes.use(authMiddleware);

studentsRoutes.get("/", requirePermission("student.view"), validate(listStudentsSchema), studentsController.listStudents);
studentsRoutes.get("/:id", requirePermission("student.view"), validate(studentIdSchema), studentsController.getStudent);
