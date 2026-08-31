import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  PUBLIC_API_BASE_URL: z.string().url().optional(),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:4200"),
  DAILY_API_KEY: z.string().trim().optional(),
  DAILY_DOMAIN: z.string().trim().optional(),
  DAILY_AUTO_CREATE_ROOMS: z.coerce.boolean().default(true),
  DAILY_ROOM_PRIVACY: z.enum(["public", "private"]).default("private"),
  DAILY_ENABLE_PREJOIN_UI: z.coerce.boolean().default(true),
  DAILY_ENABLE_CHAT: z.coerce.boolean().default(true),
  DAILY_ENABLE_RECORDING: z.enum(["off", "cloud", "cloud-audio-only", "local", "raw-tracks"]).default("off"),
  R2_ENDPOINT: z.string().url().optional(),
  R2_BUCKET_NAME: z.string().trim().min(3).max(63).optional(),
  R2_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
  R2_MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(25)
}).superRefine((value, ctx) => {
  const configured = [value.R2_ENDPOINT, value.R2_BUCKET_NAME, value.R2_ACCESS_KEY_ID, value.R2_SECRET_ACCESS_KEY].filter(Boolean);
  if (configured.length > 0 && configured.length < 4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["R2_ENDPOINT"],
      message: "R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be configured together"
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
