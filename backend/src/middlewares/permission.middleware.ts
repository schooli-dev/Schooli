import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, "Authentication required", "UNAUTHORIZED"));
      return;
    }

    if (!req.user.permissions.includes(permission)) {
      next(new ApiError(403, "Permission denied", "FORBIDDEN", { required: permission }));
      return;
    }

    next();
  };
}

export function requireRole(role: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new ApiError(401, "Authentication required", "UNAUTHORIZED"));
    if (!req.user.roles.includes(role)) return next(new ApiError(403, "Role access denied", "FORBIDDEN"));
    next();
  };
}
