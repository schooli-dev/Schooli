import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import * as adminDashboardController from "./adminDashboard.controller.js";

export const adminDashboardRoutes = Router();

adminDashboardRoutes.use(authMiddleware);
adminDashboardRoutes.get("/", requirePermission("report.view"), adminDashboardController.getDashboardStats);
