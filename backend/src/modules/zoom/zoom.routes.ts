import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as zoomController from "./zoom.controller.js";
import { createZoomMeetingSchema, getZoomMeetingSchema, zoomSignatureSchema } from "./zoom.validation.js";

export const zoomRoutes = Router();
export const zoomClassRoutes = Router({ mergeParams: true });

zoomRoutes.post(
  "/meetings",
  authMiddleware,
  requirePermission("class.create"),
  validate(createZoomMeetingSchema),
  zoomController.createMeeting
);
zoomRoutes.get(
  "/meetings/:id",
  authMiddleware,
  requirePermission("class.view"),
  validate(getZoomMeetingSchema),
  zoomController.getMeeting
);
zoomRoutes.post("/webhook", zoomController.webhook);

zoomClassRoutes.use(authMiddleware);
zoomClassRoutes.post(
  "/signature",
  requirePermission("class.join"),
  validate(zoomSignatureSchema),
  zoomController.signature
);
