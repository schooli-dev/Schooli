import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as rolesService from "./roles.service.js";

export const listRoles: RequestHandler = asyncHandler(async (_req, res) => {
  const roles = await rolesService.listRoles();

  sendSuccess(res, {
    message: "Roles fetched",
    data: roles
  });
});

export const createRole: RequestHandler = asyncHandler(async (req, res) => {
  const role = await rolesService.createRole(req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: "Role created",
    data: role
  });
});

export const updateRole: RequestHandler = asyncHandler(async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const role = await rolesService.updateRole(id, req.body);

  sendSuccess(res, {
    message: "Role updated",
    data: role
  });
});

export const deleteRole: RequestHandler = asyncHandler(async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await rolesService.deleteRole(id);

  sendSuccess(res, {
    message: "Role deleted",
    data: { id }
  });
});
