import type { Request, RequestHandler } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as teachersService from "./teachers.service.js";

export const listTeachers: RequestHandler = asyncHandler(async (req, res) => {
  const result = await teachersService.listTeachers(req.query);

  sendSuccess(res, {
    message: "Teachers fetched",
    data: result.teachers,
    pagination: result.pagination
  });
});

export const getTeacher: RequestHandler = asyncHandler(async (req, res) => {
  const teacher = await teachersService.getTeacherById(getIdParam(req));

  sendSuccess(res, {
    message: "Teacher fetched",
    data: teacher
  });
});

export const listAvailability: RequestHandler = asyncHandler(async (req, res) => {
  const availability = await teachersService.listAvailability(getIdParam(req));

  sendSuccess(res, {
    message: "Teacher availability fetched",
    data: availability
  });
});

export const createAvailability: RequestHandler = asyncHandler(async (req, res) => {
  const availability = await teachersService.createAvailability(getIdParam(req), req.body);

  sendSuccess(res, {
    statusCode: 201,
    message: "Teacher availability created",
    data: availability
  });
});

export const replaceAvailability: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const availability = await teachersService.replaceAvailability(getIdParam(req), req.body, req.user);

  sendSuccess(res, {
    message: "Teacher availability updated",
    data: availability
  });
});

export const createUnavailableDate: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const unavailableDate = await teachersService.createUnavailableDate(getIdParam(req), req.body, req.user.id);

  sendSuccess(res, {
    statusCode: 201,
    message: "Teacher unavailable date created",
    data: unavailableDate
  });
});

export const deleteUnavailableDate: RequestHandler = asyncHandler(async (req, res) => {
  await teachersService.deleteUnavailableDate(getIdParam(req), getDateIdParam(req));

  sendSuccess(res, {
    message: "Teacher unavailable date deleted"
  });
});

function getIdParam(req: Request): string {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
}

function getDateIdParam(req: Request): string {
  const dateId = req.params.dateId;

  return Array.isArray(dateId) ? dateId[0] : dateId;
}
