import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as classesController from "./classes.controller.js";
import {
  cancelClassSchema,
  checkConflictsSchema,
  classIdSchema,
  createClassSchema,
  listClassesSchema,
  rescheduleClassSchema,
  updateClassSchema
} from "./classes.validation.js";

export const classesRoutes = Router();
export const calendarRoutes = Router();

classesRoutes.use(authMiddleware);

classesRoutes.post(
  "/check-conflicts",
  requirePermission("class.create"),
  validate(checkConflictsSchema),
  classesController.checkConflicts
);
classesRoutes.get("/", requirePermission("class.view"), validate(listClassesSchema), classesController.listClasses);
classesRoutes.post("/", requirePermission("class.create"), validate(createClassSchema), classesController.createClass);
classesRoutes.get("/:id", requirePermission("class.view"), validate(classIdSchema), classesController.getClass);
classesRoutes.patch("/:id", requirePermission("class.update"), validate(updateClassSchema), classesController.updateClass);
classesRoutes.post(
  "/:id/cancel",
  requirePermission("class.cancel"),
  validate(cancelClassSchema),
  classesController.cancelClass
);
classesRoutes.post(
  "/:id/reschedule",
  requirePermission("class.reschedule"),
  validate(rescheduleClassSchema),
  classesController.rescheduleClass
);
classesRoutes.post("/:id/join", requirePermission("class.join"), validate(classIdSchema), classesController.joinClass);
classesRoutes.get("/:id/ics", requirePermission("class.view"), validate(classIdSchema), classesController.getIcs);

calendarRoutes.use(authMiddleware);
calendarRoutes.get(
  "/classes",
  requirePermission("class.view"),
  validate(listClassesSchema),
  classesController.listClasses
);
