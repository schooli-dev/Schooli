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
  ZOOM_ACCOUNT_ID: z.string().optional(),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
  ZOOM_WEBHOOK_SECRET_TOKEN: z.string().optional(),
  ZOOM_DEFAULT_HOST_EMAIL: z.string().email().optional(),
  ZOOM_AUTO_CREATE_MEETINGS: z.coerce.boolean().default(false),
  ZOOM_MEETING_WAITING_ROOM: z.coerce.boolean().default(true),
  ZOOM_MEETING_JOIN_BEFORE_HOST: z.coerce.boolean().default(false),
  ZOOM_MEETING_PASSWORD_REQUIRED: z.coerce.boolean().default(true),
  ZOOM_MEETING_AUTO_RECORDING: z.enum(["none", "local", "cloud"]).default("none"),
  ZOOM_MEETING_SDK_KEY: z.string().optional(),
  ZOOM_MEETING_SDK_SECRET: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
