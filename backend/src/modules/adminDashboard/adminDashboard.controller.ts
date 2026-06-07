import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as adminDashboardService from "./adminDashboard.service.js";

export const getDashboardStats: RequestHandler = asyncHandler(async (_req, res) => {
  const stats = await adminDashboardService.getStats();

  sendSuccess(res, {
    message: "Admin dashboard stats fetched",
    data: stats
  });
});
