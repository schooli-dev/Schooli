import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requirePermission } from "../../middlewares/permission.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as emailTemplateController from "./emailTemplates.controller.js";
import {
  createEmailTemplateSchema,
  emailTemplateIdSchema,
  listEmailTemplatesSchema,
  updateEmailTemplateSchema,
  updateEmailTemplateStatusSchema
} from "./emailTemplates.validation.js";

export const emailTemplatesRoutes = Router();

emailTemplatesRoutes.use(authMiddleware);

emailTemplatesRoutes.get(
  "/",
  requirePermission("email_template.view"),
  validate(listEmailTemplatesSchema),
  emailTemplateController.listEmailTemplates
);
emailTemplatesRoutes.post(
  "/",
  requirePermission("email_template.create"),
  validate(createEmailTemplateSchema),
  emailTemplateController.createEmailTemplate
);
emailTemplatesRoutes.get(
  "/:id",
  requirePermission("email_template.view"),
  validate(emailTemplateIdSchema),
  emailTemplateController.getEmailTemplate
);
emailTemplatesRoutes.patch(
  "/:id",
  requirePermission("email_template.update"),
  validate(updateEmailTemplateSchema),
  emailTemplateController.updateEmailTemplate
);
emailTemplatesRoutes.patch(
  "/:id/status",
  requirePermission("email_template.update"),
  validate(updateEmailTemplateStatusSchema),
  emailTemplateController.updateEmailTemplateStatus
);
