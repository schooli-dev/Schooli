import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { getNavigationPolicy } from "./navigation.policy.js";

export const getPages = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  sendSuccess(res, {
    message: "Navigation policy fetched",
    data: getNavigationPolicy(req.user)
  });
});
