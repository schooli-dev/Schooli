import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as cancellationController from "./classCancellationRequests.controller.js";
import {
  createCancellationRequestSchema,
  listCancellationRequestsSchema,
  updateCancellationRequestStatusSchema
} from "./classCancellationRequests.validation.js";

export const classCancellationRequestsRoutes = Router();

classCancellationRequestsRoutes.use(authMiddleware);

classCancellationRequestsRoutes.get(
  "/",
  requirePermission("class.view"),
  validate(listCancellationRequestsSchema),
  cancellationController.listCancellationRequests
);

classCancellationRequestsRoutes.patch(
  "/:id/status",
  validate(updateCancellationRequestStatusSchema),
  cancellationController.updateCancellationRequestStatus
);

export const classCancellationSubroutes = Router({ mergeParams: true });

classCancellationSubroutes.use(authMiddleware);

classCancellationSubroutes.get(
  "/",
  requirePermission("class.view"),
  cancellationController.listClassCancellationRequests
);

classCancellationSubroutes.post(
  "/",
  requirePermission("class.request_cancel"),
  validate(createCancellationRequestSchema),
  cancellationController.createCancellationRequest
);
