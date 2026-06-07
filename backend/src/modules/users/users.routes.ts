import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as usersController from "./users.controller.js";
import {
  assignUserRolesSchema,
  createUserSchema,
  getUserSchema,
  listUsersSchema,
  updateUserSchema,
  updateUserStatusSchema
} from "./users.validation.js";

export const usersRoutes = Router();

usersRoutes.use(authMiddleware);

usersRoutes.get("/", requirePermission("user.view"), validate(listUsersSchema), usersController.listUsers);
usersRoutes.post("/", requirePermission("user.create"), validate(createUserSchema), usersController.createUser);
usersRoutes.get("/:id", requirePermission("user.view"), validate(getUserSchema), usersController.getUser);
usersRoutes.patch("/:id", requirePermission("user.update"), validate(updateUserSchema), usersController.updateUser);
usersRoutes.patch(
  "/:id/status",
  requirePermission("user.deactivate"),
  validate(updateUserStatusSchema),
  usersController.updateUserStatus
);
usersRoutes.post(
  "/:id/roles",
  requirePermission("user.update"),
  validate(assignUserRolesSchema),
  usersController.assignUserRoles
);
