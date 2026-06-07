import type { Request, RequestHandler } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as assignmentService from "./teacherStudentAssignments.service.js";

export const listAssignments: RequestHandler = asyncHandler(async (req, res) => {
  const result = await assignmentService.listAssignments(req.query);

  sendSuccess(res, {
    message: "Teacher-student assignments fetched",
    data: result.assignments,
    pagination: result.pagination
  });
});

export const createAssignment: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const assignment = await assignmentService.createAssignment(req.body, req.user.id);

  sendSuccess(res, {
    statusCode: 201,
    message: "Teacher-student assignment created",
    data: assignment
  });
});

export const updateAssignmentStatus: RequestHandler = asyncHandler(async (req, res) => {
  const assignment = await assignmentService.updateAssignmentStatus(getIdParam(req), req.body);

  sendSuccess(res, {
    message: "Teacher-student assignment status updated",
    data: assignment
  });
});

function getIdParam(req: Request): string {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
}
