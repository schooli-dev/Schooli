import type { Request, RequestHandler } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as attendanceService from "./attendance.service.js";

export const listAttendance: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const result = await attendanceService.listAttendance(req.query, req.user);

  sendSuccess(res, {
    message: "Attendance fetched",
    data: result.attendance,
    pagination: result.pagination
  });
});

export const listClassAttendance: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const attendance = await attendanceService.listClassAttendance(getIdParam(req), req.user);

  sendSuccess(res, {
    message: "Class attendance fetched",
    data: attendance
  });
});

export const markAttendance: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const attendance = await attendanceService.markAttendance(req.body, req.user);

  sendSuccess(res, {
    message: "Attendance marked",
    data: attendance
  });
});

export const updateAttendance: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const attendance = await attendanceService.updateAttendance(getIdParam(req), req.body, req.user);

  sendSuccess(res, {
    message: "Attendance updated",
    data: attendance
  });
});

function getIdParam(req: Request): string {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
}
