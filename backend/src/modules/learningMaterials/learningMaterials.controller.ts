import type { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as service from "./learningMaterials.service.js";
import { downloadLearningMaterial, uploadLearningMaterial } from "./learningMaterials.storage.js";
import { ApiError } from "../../utils/ApiError.js";

export const listCourses: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Courses fetched", data: await service.listCourses(req.query) });
});

export const createCourse: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { statusCode: 201, message: "Course created", data: await service.createCourse(req.body, req.user!) });
});

export const getCourse: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Course fetched", data: await service.getCourse(req.params.id as string) });
});

export const updateCourse: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Course updated", data: await service.updateCourse(req.params.id as string, req.body, req.user!) });
});

export const listModules: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Modules fetched", data: await service.listModules(req.query) });
});

export const createModule: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { statusCode: 201, message: "Module created", data: await service.createModule(req.body, req.user!) });
});

export const getModule: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Module fetched", data: await service.getModule(req.params.id as string) });
});

export const updateModule: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Module updated", data: await service.updateModule(req.params.id as string, req.body, req.user!) });
});

export const replaceModuleTeachers: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Module teacher access updated", data: await service.replaceModuleTeachers(req.params.id as string, req.body.teacherIds, req.user!) });
});

export const getTeacherModules: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Teacher module access fetched", data: await service.getTeacherModules(req.params.teacherId as string) });
});

export const listTeacherAccess: RequestHandler = asyncHandler(async (_req, res) => {
  sendSuccess(res, { message: "Teacher access fetched", data: await service.listTeacherAccess() });
});

export const replaceTeacherModules: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Teacher module access updated", data: await service.replaceTeacherModules(req.params.teacherId as string, req.body.moduleIds, req.user!) });
});

export const listLessons: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Curriculum classes fetched", data: await service.listLessons(req.query) });
});
export const listMyModules: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Assigned modules fetched", data: await service.listTeacherAssignedModules(req.user!.id) });
});
export const listMyLessons: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Assigned curriculum classes fetched", data: await service.listTeacherAssignedLessons(req.user!.id) });
});
export const getMyModule: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Assigned module fetched", data: await service.getTeacherAssignedModule(req.user!.id, req.params.id as string) });
});
export const getMyLesson: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Assigned curriculum class fetched", data: await service.getTeacherAssignedLesson(req.user!.id, req.params.id as string) });
});
export const createLesson: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { statusCode: 201, message: "Curriculum class created", data: await service.createLesson(req.body, req.user!) });
});
export const getLesson: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Curriculum class fetched", data: await service.getLesson(req.params.id as string) });
});
export const updateLesson: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: "Curriculum class updated", data: await service.updateLesson(req.params.id as string, req.body, req.user!) });
});
export const uploadMaterialFile: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, "Choose a file to upload", "FILE_REQUIRED");
  sendSuccess(res, { statusCode: 201, message: "File uploaded", data: await uploadLearningMaterial(req.file) });
});
export const createMaterial: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { statusCode: 201, message: "Learning material created", data: await service.createMaterial(req.body, req.user!) });
});
export const createMaterialRevision: RequestHandler = asyncHandler(async (req, res) => {
  sendSuccess(res, { statusCode: 201, message: "Learning material revision created", data: await service.createMaterialRevision(req.params.id as string, req.body, req.user!) });
});
async function sendMaterialFile(
  _req: Request,
  res: Response,
  material: { storageKey: string; fileName: string; mimeType: string }
): Promise<void> {
  const safeName = material.fileName.replace(/["\\]/g, "");
  const file = await downloadLearningMaterial(material.storageKey, material.fileName, material.mimeType);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  file.body.pipe(res);
}

export const downloadMaterial: RequestHandler = asyncHandler(async (req, res) => {
  await sendMaterialFile(req, res, await service.getMaterialFile(req.params.id as string));
});
export const downloadMyMaterial: RequestHandler = asyncHandler(async (req, res) => {
  await sendMaterialFile(req, res, await service.getTeacherMaterialFile(req.user!.id, req.params.id as string));
});
export const deleteMaterial: RequestHandler = asyncHandler(async (req, res) => {
  await service.deleteMaterial(req.params.id as string, req.user!);
  sendSuccess(res, { message: "Learning material deleted", data: null });
});
