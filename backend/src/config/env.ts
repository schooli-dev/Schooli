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
  DAILY_ENABLE_RECORDING: z.enum(["off", "cloud", "cloud-audio-only", "local", "raw-tracks"]).default("off")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
