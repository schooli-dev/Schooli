import type { ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError.js";

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const isTooLarge = error.code === "LIMIT_FILE_SIZE";
    res.status(isTooLarge ? 413 : 422).json({
      success: false,
      message: isTooLarge ? "The selected file is larger than the configured upload limit" : "The file upload could not be processed",
      error: { code: isTooLarge ? "FILE_TOO_LARGE" : "FILE_UPLOAD_ERROR" }
    });
    return;
  }
  if (error instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: "Validation failed",
      error: {
        code: "VALIDATION_ERROR",
        details: error.flatten().fieldErrors
      }
    });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: {
        code: error.code,
        details: error.details
      }
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: {
      code: "INTERNAL_SERVER_ERROR"
    }
  });
};
