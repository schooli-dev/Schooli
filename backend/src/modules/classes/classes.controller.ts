import type { Request, RequestHandler } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as classesService from "./classes.service.js";

export const checkConflicts: RequestHandler = asyncHandler(async (req, res) => {
  const result = await classesService.checkConflicts(req.body);

  sendSuccess(res, {
    message: result.hasConflicts ? "Scheduling conflicts found" : "No scheduling conflicts found",
    data: result
  });
});

export const listClasses: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const result = await classesService.listClasses(req.query, req.user);

  sendSuccess(res, {
    message: "Classes fetched",
    data: result.classes,
    pagination: result.pagination
  });
});

export const createClass: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const classItem = await classesService.createClass(req.body, req.user);

  sendSuccess(res, {
    statusCode: 201,
    message: "Class scheduled",
    data: classItem
  });
});

export const getClass: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const classItem = await classesService.getClassById(getIdParam(req), req.user);

  sendSuccess(res, {
    message: "Class fetched",
    data: classItem
  });
});

export const updateClass: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const classItem = await classesService.updateClass(getIdParam(req), req.body, req.user);

  sendSuccess(res, {
    message: "Class updated",
    data: classItem
  });
});

export const cancelClass: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const classItem = await classesService.cancelClass(getIdParam(req), req.body, req.user);

  sendSuccess(res, {
    message: "Class cancelled",
    data: classItem
  });
});

export const rescheduleClass: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const classItem = await classesService.rescheduleClass(getIdParam(req), req.body, req.user);

  sendSuccess(res, {
    message: "Class rescheduled",
    data: classItem
  });
});

export const joinClass: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const payload = await classesService.getJoinPayload(getIdParam(req), req.user);

  sendSuccess(res, {
    message: "Class join payload fetched",
    data: payload
  });
});

export const getIcs: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const ics = await classesService.getIcs(getIdParam(req), req.user);

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="class-${getIdParam(req)}.ics"`);
  res.status(200).send(ics);
});

function getIdParam(req: Request): string {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
}
