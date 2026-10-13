import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { auditModules, listAuditLogs } from "./audit.service.js";
import { listAuditLogsSchema } from "./audit.validation.js";

export const auditRoutes = Router();

// Read-only, and only for users holding audit.view (admin by default). Nothing here writes.
auditRoutes.use(authMiddleware, requirePermission("audit.view"));

// The modules and event types the Audit Trail page can filter by.
auditRoutes.get(
  "/modules",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, { message: "Audit modules fetched", data: auditModules });
  })
);

auditRoutes.get(
  "/",
  validate(listAuditLogsSchema),
  asyncHandler(async (req, res) => {
    const result = await listAuditLogs(req.query as never);
    sendSuccess(res, { message: "Audit trail fetched", data: result.items, pagination: result.pagination });
  })
);
