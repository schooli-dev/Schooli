import type { Request, RequestHandler } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as dailyService from "./daily.service.js";

export const createRoom: RequestHandler = asyncHandler(async (req, res) => {
  const room = await dailyService.createDailyRoomByClassId(req.body.classId);

  sendSuccess(res, {
    statusCode: 201,
    message: "Daily room created",
    data: room
  });
});

export const getRoom: RequestHandler = asyncHandler(async (req, res) => {
  const room = await dailyService.getVideoMeetingById(getIdParam(req));

  sendSuccess(res, {
    message: "Daily room fetched",
    data: room
  });
});

export const webhook: RequestHandler = asyncHandler(async (req, res) => {
  const data = await dailyService.handleDailyWebhook(req.body);

  res.status(200).json(data);
});

export const join: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const data = await dailyService.createDailyJoinPayload(getIdParam(req), req.user, req.body.role);

  sendSuccess(res, {
    message: "Daily join payload created",
    data
  });
});

export const leave: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const requestedRole = req.body.role ?? 0;
  const role = requestedRole === 1 && (req.user.roles.includes("admin") || req.user.roles.includes("teacher")) ? 1 : 0;

  await dailyService.releaseClassroomForDaily(getIdParam(req), req.user.id, role);

  sendSuccess(res, {
    message: "Classroom session released",
    data: {
      classId: getIdParam(req),
      role
    }
  });
});

function getIdParam(req: Request): string {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
}
