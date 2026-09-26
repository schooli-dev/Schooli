import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import type { Express } from "express";
import type { Readable } from "stream";
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

export type DownloadedLearningMaterialFile = {
  body: Readable;
  fileName: string;
  mimeType: string;
};

export type LearningMaterialStorageStats = {
  status: "connected" | "not_configured" | "unavailable";
  objectCount: number;
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

export async function downloadLearningMaterial(storageKey: string, fileName: string, mimeType: string): Promise<DownloadedLearningMaterialFile> {
  ensureConfigured();
  const result = await getClient().send(new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME!, Key: storageKey }));
  if (!result.Body) throw new ApiError(404, "The uploaded file could not be found", "MATERIAL_FILE_NOT_FOUND");
  return { body: result.Body as Readable, fileName, mimeType };
}

export async function deleteLearningMaterial(storageKey: string): Promise<void> {
  ensureConfigured();
  await getClient().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME!, Key: storageKey }));
}

export async function getLearningMaterialStorageStats(): Promise<LearningMaterialStorageStats> {
  if (!isConfigured()) return { status: "not_configured", objectCount: 0, sizeBytes: 0 };

  try {
    let continuationToken: string | undefined;
    let objectCount = 0;
    let sizeBytes = 0;

    do {
      const result = await getClient().send(new ListObjectsV2Command({
        Bucket: env.R2_BUCKET_NAME!,
        Prefix: "learning-materials/",
        ContinuationToken: continuationToken
      }));
      for (const object of result.Contents ?? []) {
        objectCount += 1;
        sizeBytes += object.Size ?? 0;
      }
      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken);

    return { status: "connected", objectCount, sizeBytes };
  } catch {
    return { status: "unavailable", objectCount: 0, sizeBytes: 0 };
  }
}

function isConfigured(): boolean {
  return Boolean(env.R2_ENDPOINT && env.R2_BUCKET_NAME && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
}

function ensureConfigured(): void {
  if (!isConfigured()) {
    throw new ApiError(503, "File storage is not configured. Add the Cloudflare R2 settings first.", "R2_NOT_CONFIGURED");
  }
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
