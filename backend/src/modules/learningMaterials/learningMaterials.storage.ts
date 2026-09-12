import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import type { Express } from "express";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

let client: S3Client | null = null;

export type UploadedLearningMaterialFile = {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export function uploadLimitBytes(): number {
  return env.R2_MAX_UPLOAD_MB * 1024 * 1024;
}

export async function uploadLearningMaterial(file: Express.Multer.File): Promise<UploadedLearningMaterialFile> {
  if (!isConfigured()) {
    throw new ApiError(503, "File uploads are not configured. Add the Cloudflare R2 settings first.", "R2_NOT_CONFIGURED");
  }
  if (!allowedMimeTypes.has(file.mimetype)) {
    throw new ApiError(422, "This file type is not supported. Upload a document, spreadsheet, presentation, PDF, text file, or image.", "UNSUPPORTED_FILE_TYPE");
  }

  const fileName = sanitiseFileName(file.originalname);
  const storageKey = `learning-materials/${new Date().toISOString().slice(0, 7)}/${randomUUID()}-${fileName}`;
  await getClient().send(new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME!,
    Key: storageKey,
    Body: file.buffer,
    ContentType: file.mimetype,
    ContentDisposition: `attachment; filename="${fileName}"`
  }));

  return { storageKey, fileName, mimeType: file.mimetype, sizeBytes: file.size };
}

function isConfigured(): boolean {
  return Boolean(env.R2_ENDPOINT && env.R2_BUCKET_NAME && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
}

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!
      }
    });
  }
  return client;
}

function sanitiseFileName(fileName: string): string {
  const safeName = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 160);
  return safeName || "uploaded-file";
}
