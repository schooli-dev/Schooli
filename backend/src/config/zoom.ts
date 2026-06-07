import { env } from "./env.js";

export const zoomConfig = {
  accountId: env.ZOOM_ACCOUNT_ID,
  clientId: env.ZOOM_CLIENT_ID,
  clientSecret: env.ZOOM_CLIENT_SECRET,
  webhookSecretToken: env.ZOOM_WEBHOOK_SECRET_TOKEN,
  defaultHostEmail: env.ZOOM_DEFAULT_HOST_EMAIL,
  autoCreateMeetings: env.ZOOM_AUTO_CREATE_MEETINGS,
  waitingRoom: env.ZOOM_MEETING_WAITING_ROOM,
  joinBeforeHost: env.ZOOM_MEETING_JOIN_BEFORE_HOST,
  passwordRequired: env.ZOOM_MEETING_PASSWORD_REQUIRED,
  autoRecording: env.ZOOM_MEETING_AUTO_RECORDING,
  meetingSdkKey: env.ZOOM_MEETING_SDK_KEY,
  meetingSdkSecret: env.ZOOM_MEETING_SDK_SECRET
};

export function isZoomServerConfigured(): boolean {
  return Boolean(
    zoomConfig.accountId &&
      zoomConfig.clientId &&
      zoomConfig.clientSecret &&
      zoomConfig.defaultHostEmail
  );
}

export function isZoomMeetingSdkConfigured(): boolean {
  return Boolean(zoomConfig.meetingSdkKey && zoomConfig.meetingSdkSecret);
}
