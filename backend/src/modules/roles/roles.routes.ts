import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as rolesController from "./roles.controller.js";
import { createRoleSchema, updateRoleSchema } from "./roles.validation.js";

export const rolesRoutes = Router();

rolesRoutes.get("/", authMiddleware, requirePermission("role.view"), rolesController.listRoles);
rolesRoutes.post("/", authMiddleware, requirePermission("settings.update"), validate(createRoleSchema), rolesController.createRole);
rolesRoutes.patch("/:id", authMiddleware, requirePermission("settings.update"), validate(updateRoleSchema), rolesController.updateRole);
