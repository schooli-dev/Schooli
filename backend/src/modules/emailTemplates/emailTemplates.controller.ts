import type { Request, RequestHandler } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as emailTemplateService from "./emailTemplates.service.js";

export const listEmailTemplates: RequestHandler = asyncHandler(async (req, res) => {
  const result = await emailTemplateService.listEmailTemplates(req.query);

  sendSuccess(res, {
    message: "Email templates fetched",
    data: result.templates,
    pagination: result.pagination
  });
});

export const createEmailTemplate: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const template = await emailTemplateService.createEmailTemplate(req.body, req.user.id);

  sendSuccess(res, {
    statusCode: 201,
    message: "Email template created",
    data: template
  });
});

export const getEmailTemplate: RequestHandler = asyncHandler(async (req, res) => {
  const template = await emailTemplateService.getEmailTemplateById(getIdParam(req));

  sendSuccess(res, {
    message: "Email template fetched",
    data: template
  });
});

export const updateEmailTemplate: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const template = await emailTemplateService.updateEmailTemplate(getIdParam(req), req.body, req.user.id);

  sendSuccess(res, {
    message: "Email template updated",
    data: template
  });
});

export const updateEmailTemplateStatus: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const template = await emailTemplateService.updateEmailTemplateStatus(getIdParam(req), req.body, req.user.id);

  sendSuccess(res, {
    message: "Email template status updated",
    data: template
  });
});

function getIdParam(req: Request): string {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
}
