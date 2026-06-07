import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import * as permissionsController from "./permissions.controller.js";

export const permissionsRoutes = Router();

permissionsRoutes.get(
  "/",
  authMiddleware,
  requirePermission("permission.view"),
  permissionsController.listPermissions
);
