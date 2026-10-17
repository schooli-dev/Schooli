import type { RequestHandler } from "express";
import { ApiError } from "../../utils/ApiError.js";
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

export const getHomeworkAnalyticsSummary: RequestHandler = asyncHandler(async (_req, res) => {
  sendSuccess(res, { message: "Homework summary fetched", data: await service.getHomeworkAnalyticsSummary() });
});

export const getHomeworkAnalyticsFilters: RequestHandler = asyncHandler(async (_req, res) => {
  sendSuccess(res, { message: "Homework filters fetched", data: await service.getHomeworkAnalyticsFilters() });
});

export const listHomeworkAssignments: RequestHandler = asyncHandler(async (req, res) => {
  const result = await service.listHomeworkAssignments(req.query as never);
  sendSuccess(res, { message: "Homework assignments fetched", data: result.items, pagination: result.pagination });
});

export const getHomeworkAssignmentDetail: RequestHandler = asyncHandler(async (req, res) => {
  const detail = await service.getHomeworkAssignmentDetail(req.params.id as string);
  if (!detail) throw new ApiError(404, "Homework assignment not found", "HOMEWORK_ASSIGNMENT_NOT_FOUND");
  sendSuccess(res, { message: "Homework assignment detail fetched", data: detail });
});
