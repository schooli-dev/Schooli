import { Router, type Response } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { downloadLearningMaterial, uploadLearningMaterial, uploadLimitBytes } from "../learningMaterials/learningMaterials.storage.js";
import {
  getHomeworkDetail,
  getHomeworkDocumentFile,
  getHomeworkResourceFile,
  getHomeworkSummary,
  getSubmissionFile,
  listHomework,
  listHomeworkLibrary,
  reviewHomework,
  submitHomework,
  type StoredFile
} from "./homework.service.js";
import {
  homeworkIdSchema,
  homeworkResourceFileSchema,
  homeworkSubmissionFileSchema,
  listHomeworkSchema,
  reviewHomeworkSchema,
  submitHomeworkSchema
} from "./homework.validation.js";

export const homeworkRoutes = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: uploadLimitBytes() } });

homeworkRoutes.use(authMiddleware);

async function sendStoredFile(res: Response, file: StoredFile): Promise<void> {
  const stored = await downloadLearningMaterial(file.storageKey, file.fileName, file.mimeType);
  res.setHeader("Content-Type", stored.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${stored.fileName.replace(/["\\]/g, "")}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  stored.body.pipe(res);
}

// Attachment for a custom homework form (teacher). Private R2 bucket, homework/ prefix; nothing is
// written to the database until the attendance is saved.
homeworkRoutes.post(
  "/uploads",
  requirePermission("homework.create"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(422, "Choose a file to upload", "FILE_REQUIRED");
    sendSuccess(res, { statusCode: 201, message: "Homework attachment uploaded", data: await uploadLearningMaterial(req.file, "homework") });
  })
);

// A student's work (wider file-type list: documents, archives, code, project files, video).
homeworkRoutes.post(
  "/submission-uploads",
  requirePermission("homework.submit"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(422, "Choose a file to upload", "FILE_REQUIRED");
    sendSuccess(res, { statusCode: 201, message: "Submission file uploaded", data: await uploadLearningMaterial(req.file, "homework-submissions") });
  })
);

homeworkRoutes.get(
  "/library",
  requirePermission("homework.create"),
  asyncHandler(async (req, res) => {
    sendSuccess(res, { message: "Homework library fetched", data: await listHomeworkLibrary(req.user!.id) });
  })
);

homeworkRoutes.get(
  "/summary",
  requirePermission("homework.view"),
  asyncHandler(async (req, res) => {
    sendSuccess(res, { message: "Homework summary fetched", data: await getHomeworkSummary(req.user!) });
  })
);

// Role-scoped: teachers see homework they assigned, students see their own, admin/support see all.
homeworkRoutes.get(
  "/",
  requirePermission("homework.view"),
  validate(listHomeworkSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, { message: "Homework fetched", data: await listHomework(req.query as never, req.user!) });
  })
);

homeworkRoutes.get(
  "/:id",
  requirePermission("homework.view"),
  validate(homeworkIdSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, { message: "Homework fetched", data: await getHomeworkDetail(req.user!, req.params.id as string) });
  })
);

homeworkRoutes.post(
  "/:id/submissions",
  requirePermission("homework.submit"),
  validate(submitHomeworkSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, { statusCode: 201, message: "Homework submitted", data: await submitHomework(req.user!, req.params.id as string, req.body) });
  })
);

homeworkRoutes.post(
  "/:id/review",
  requirePermission("homework.review"),
  validate(reviewHomeworkSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, { message: "Evaluation saved", data: await reviewHomework(req.user!, req.params.id as string, req.body) });
  })
);

homeworkRoutes.get(
  "/:id/document/file",
  requirePermission("homework.view"),
  validate(homeworkIdSchema),
  asyncHandler(async (req, res) => {
    await sendStoredFile(res, await getHomeworkDocumentFile(req.user!, req.params.id as string));
  })
);

homeworkRoutes.get(
  "/:id/resources/:resourceId/file",
  requirePermission("homework.view"),
  validate(homeworkResourceFileSchema),
  asyncHandler(async (req, res) => {
    await sendStoredFile(res, await getHomeworkResourceFile(req.user!, req.params.id as string, req.params.resourceId as string));
  })
);

homeworkRoutes.get(
  "/:id/submissions/:submissionId/files/:fileId/file",
  requirePermission("homework.view"),
  validate(homeworkSubmissionFileSchema),
  asyncHandler(async (req, res) => {
    await sendStoredFile(res, await getSubmissionFile(req.user!, req.params.id as string, req.params.submissionId as string, req.params.fileId as string));
  })
);
