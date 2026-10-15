import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as service from "./reportsAnalytics.service.js";

export const getCurriculumSummary: RequestHandler = asyncHandler(async (_req, res) => {
  sendSuccess(res, { message: "Curriculum summary fetched", data: await service.getCurriculumSummary() });
});

export const getCurriculumFilters: RequestHandler = asyncHandler(async (_req, res) => {
  sendSuccess(res, { message: "Curriculum filters fetched", data: await service.getCurriculumFilters() });
});

export const listCurriculumModuleAnalytics: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Curriculum module analytics fetched", data: await service.listCurriculumModuleAnalytics(req.query) });
});

export const getModuleTeacherProgress: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Module teacher progress fetched", data: await service.getModuleTeacherProgress(req.params.moduleId as string) });
});
