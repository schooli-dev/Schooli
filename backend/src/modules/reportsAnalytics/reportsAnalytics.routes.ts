import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { downloadLearningMaterial } from "../learningMaterials/learningMaterials.storage.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as controller from "./reportsAnalytics.controller.js";
import { getHomeworkSubmissionFile } from "./reportsAnalytics.service.js";
import {
  curriculumModulesQuerySchema,
  curriculumModuleTeachersParamsSchema,
  homeworkAssignmentIdParamsSchema,
  homeworkAssignmentsQuerySchema,
  homeworkSubmissionFileParamsSchema
} from "./reportsAnalytics.validation.js";

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

reportsAnalyticsRoutes.get("/homework/summary", requirePermission("reports_analytics.view"), controller.getHomeworkAnalyticsSummary);
reportsAnalyticsRoutes.get("/homework/filters", requirePermission("reports_analytics.view"), controller.getHomeworkAnalyticsFilters);
reportsAnalyticsRoutes.get(
  "/homework/assignments",
  requirePermission("reports_analytics.view"),
  validate(homeworkAssignmentsQuerySchema),
  controller.listHomeworkAssignments
);
reportsAnalyticsRoutes.get(
  "/homework/assignments/:id",
  requirePermission("reports_analytics.view"),
  validate(homeworkAssignmentIdParamsSchema),
  controller.getHomeworkAssignmentDetail
);
reportsAnalyticsRoutes.get(
  "/homework/assignments/:id/submissions/:submissionId/files/:fileId/file",
  requirePermission("reports_analytics.view"),
  validate(homeworkSubmissionFileParamsSchema),
  asyncHandler(async (req, res) => {
    const file = await getHomeworkSubmissionFile(req.params.id as string, req.params.submissionId as string, req.params.fileId as string);
    const stored = await downloadLearningMaterial(file.storageKey, file.fileName, file.mimeType);
    res.setHeader("Content-Type", stored.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${stored.fileName.replace(/["\\]/g, "")}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    stored.body.pipe(res);
  })
);
