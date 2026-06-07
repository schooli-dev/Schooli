import { env } from "../../config/env.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";

export const getDetails = asyncHandler(async (_req, res) => {
  const apiBaseUrl = env.PUBLIC_API_BASE_URL ?? `http://localhost:${env.PORT}/api`;

  sendSuccess(res, {
    message: "Application details fetched",
    data: {
      appName: "SchooliEdu",
      service: "schooliedu-backend",
      environment: env.NODE_ENV,
      apiBaseUrl,
      docsUrl: `${apiBaseUrl}/docs`,
      healthUrl: `${apiBaseUrl}/health`
    }
  });
});
