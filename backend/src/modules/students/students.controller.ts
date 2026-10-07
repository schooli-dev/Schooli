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

export const listMyStudents: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    message: "My students fetched",
    data: await studentsService.listMyStudents(req.user!.id)
  });
});

export const getMyStudentCurriculum: RequestHandler = asyncHandler(async (req, res) => {
  const studentId = Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId;

  sendSuccess(res, {
    message: "Student curriculum fetched",
    data: await studentsService.getMyStudentCurriculum(req.user!.id, studentId, req.query)
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
