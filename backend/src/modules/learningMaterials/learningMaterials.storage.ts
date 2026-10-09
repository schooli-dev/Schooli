import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import type { Express } from "express";
import type { Readable } from "stream";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

// Files are validated by extension, not the browser-supplied MIME type, because that is unreliable.
// Only types the in-site viewer can render are accepted: legacy binary Office formats (doc/ppt/xls)
// are rejected outright since there is no server-side converter for them.
const allowedFileTypes = new Map<string, string>([
  ["pdf", "application/pdf"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ["txt", "text/plain"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["gif", "image/gif"]
]);

// Student homework submissions accept far more than learning materials (documents, archives,
// code, project files, video). Nothing here is rendered inline by the server: code and markup are
// stored and served as plain text so an uploaded .html file can never run in the app's origin.
const submissionFileTypes = new Map<string, string>([
  ...allowedFileTypes,
  ["doc", "application/msword"],
  ["ppt", "application/vnd.ms-powerpoint"],
  ["xls", "application/vnd.ms-excel"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["csv", "text/csv"],
  ["zip", "application/zip"],
  ["rar", "application/vnd.rar"],
  ["7z", "application/x-7z-compressed"],
  ["mp4", "video/mp4"],
  ["mov", "video/quicktime"],
  ["webm", "video/webm"],
  ...["py", "js", "ts", "tsx", "jsx", "java", "c", "cpp", "h", "cs", "go", "rs", "rb", "php", "swift", "kt", "sql", "sh", "html", "css", "json", "xml", "md", "yml", "yaml", "ipynb", "sb3"].map(
    (extension) => [extension, "text/plain"] as [string, string]
  )
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

export async function uploadLearningMaterial(
  file: Express.Multer.File,
  folder: "learning-materials" | "homework" | "homework-submissions" = "learning-materials"
): Promise<UploadedLearningMaterialFile> {
  if (!isConfigured()) {
    throw new ApiError(503, "File uploads are not configured. Add the Cloudflare R2 settings first.", "R2_NOT_CONFIGURED");
  }
  const extension = file.originalname.includes(".") ? file.originalname.slice(file.originalname.lastIndexOf(".") + 1).toLowerCase() : "";
  const mimeType = (folder === "homework-submissions" ? submissionFileTypes : allowedFileTypes).get(extension);
  if (!mimeType) {
    throw new ApiError(
      422,
      folder === "homework-submissions"
        ? "This file type is not supported. Upload a document, image, archive (ZIP), code, project file or video."
        : "This file type is not supported. Upload a PDF, DOCX, PPTX, TXT, or image (JPG, PNG, WEBP, GIF) file.",
      "UNSUPPORTED_FILE_TYPE"
    );
  }

  const fileName = sanitiseFileName(file.originalname);
  const storageKey = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}-${fileName}`;
  await getClient().send(new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME!,
    Key: storageKey,
    Body: file.buffer,
    ContentType: mimeType,
    ContentDisposition: `attachment; filename="${fileName}"`
  }));

  return { storageKey, fileName, mimeType, sizeBytes: file.size };
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
