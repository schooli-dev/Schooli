import { env } from "./env.js";

export const dailyConfig = {
  apiKey: env.DAILY_API_KEY,
  domain: env.DAILY_DOMAIN,
  autoCreateRooms: env.DAILY_AUTO_CREATE_ROOMS,
  roomPrivacy: env.DAILY_ROOM_PRIVACY,
  enablePrejoinUi: env.DAILY_ENABLE_PREJOIN_UI,
  enableChat: env.DAILY_ENABLE_CHAT,
  enableRecording: env.DAILY_ENABLE_RECORDING
};

export function isDailyConfigured(): boolean {
  return Boolean(dailyConfig.apiKey && dailyConfig.domain);
}

export function getDailyApiBaseUrl(): string {
  return "https://api.daily.co/v1";
}

export function getDailyDomainUrl(): string | null {
  const domain = dailyConfig.domain?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return domain ? `https://${domain}` : null;
}
