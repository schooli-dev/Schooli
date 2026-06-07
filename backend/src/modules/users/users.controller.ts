import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as usersService from "./users.service.js";

export const listUsers: RequestHandler = asyncHandler(async (req, res) => {
  const result = await usersService.listUsers(req.query);

  sendSuccess(res, {
    message: "Users fetched",
    data: result.users,
    pagination: result.pagination
  });
});

export const createUser: RequestHandler = asyncHandler(async (req, res) => {
  const user = await usersService.createUser(req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: "User created",
    data: user
  });
});

export const getUser: RequestHandler = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById(getIdParam(req));

  sendSuccess(res, {
    message: "User fetched",
    data: user
  });
});

export const updateUser: RequestHandler = asyncHandler(async (req, res) => {
  const user = await usersService.updateUser(getIdParam(req), req.body, req.user);

  sendSuccess(res, {
    message: "User updated",
    data: user
  });
});

export const updateUserStatus: RequestHandler = asyncHandler(async (req, res) => {
  const user = await usersService.updateUserStatus(getIdParam(req), req.body, req.user);

  sendSuccess(res, {
    message: "User status updated",
    data: user
  });
});

export const assignUserRoles: RequestHandler = asyncHandler(async (req, res) => {
  const user = await usersService.assignUserRoles(getIdParam(req), req.body, req.user);

  sendSuccess(res, {
    message: "User roles updated",
    data: user
  });
});

function getIdParam(req: Parameters<RequestHandler>[0]): string {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
}
