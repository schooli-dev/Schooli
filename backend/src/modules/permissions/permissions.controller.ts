import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as permissionsService from "./permissions.service.js";

export const listPermissions: RequestHandler = asyncHandler(async (_req, res) => {
  const permissions = await permissionsService.listPermissions();

  sendSuccess(res, {
    message: "Permissions fetched",
    data: permissions
  });
});
