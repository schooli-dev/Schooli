import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as controller from "./reportsAnalytics.controller.js";
import { curriculumModulesQuerySchema, curriculumModuleTeachersParamsSchema } from "./reportsAnalytics.validation.js";

export const reportsAnalyticsRoutes = Router();

reportsAnalyticsRoutes.use(authMiddleware);

reportsAnalyticsRoutes.get("/curriculum/summary", requirePermission("reports_analytics.view"), controller.getCurriculumSummary);
reportsAnalyticsRoutes.get("/curriculum/filters", requirePermission("reports_analytics.view"), controller.getCurriculumFilters);
reportsAnalyticsRoutes.get(
  "/curriculum/modules",
  requirePermission("reports_analytics.view"),
  validate(curriculumModulesQuerySchema),
  controller.listCurriculumModuleAnalytics
);
reportsAnalyticsRoutes.get(
  "/curriculum/modules/:moduleId/teachers",
  requirePermission("reports_analytics.view"),
  validate(curriculumModuleTeachersParamsSchema),
  controller.getModuleTeacherProgress
);
