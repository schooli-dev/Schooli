import type { Request, RequestHandler } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as cancellationService from "./classCancellationRequests.service.js";

export const listCancellationRequests: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const result = await cancellationService.listCancellationRequests(req.query, req.user);

  sendSuccess(res, {
    message: "Class cancellation requests fetched",
    data: result.requests,
    pagination: result.pagination
  });
});

export const listClassCancellationRequests: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const result = await cancellationService.listCancellationRequests(
    { ...req.query, classId: getIdParam(req) },
    req.user
  );

  sendSuccess(res, {
    message: "Class cancellation requests fetched",
    data: result.requests,
    pagination: result.pagination
  });
});

export const createCancellationRequest: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const request = await cancellationService.createCancellationRequest(getIdParam(req), req.body, req.user);

  sendSuccess(res, {
    statusCode: 201,
    message: "Class cancellation request created",
    data: request
  });
});

export const updateCancellationRequestStatus: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const request = await cancellationService.updateCancellationRequestStatus(getIdParam(req), req.body, req.user);

  sendSuccess(res, {
    message: "Class cancellation request status updated",
    data: request
  });
});

function getIdParam(req: Request): string {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
}
