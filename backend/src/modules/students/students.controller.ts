import type { Request, RequestHandler } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as studentsService from "./students.service.js";

export const listStudents: RequestHandler = asyncHandler(async (req, res) => {
  const result = await studentsService.listStudents(req.query);

  sendSuccess(res, {
    message: "Students fetched",
    data: result.students,
    pagination: result.pagination
  });
});

export const getStudent: RequestHandler = asyncHandler(async (req, res) => {
  const student = await studentsService.getStudentById(getIdParam(req));

  sendSuccess(res, {
    message: "Student fetched",
    data: student
  });
});

function getIdParam(req: Request): string {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
}
