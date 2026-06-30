import { z } from "zod";

const uuid = z.string().uuid();
const notificationChannel = z.enum(["email", "in_app", "sms_future", "whatsapp_future"]);
const recipientRole = z.enum(["admin", "teacher", "student", "support"]);

export const listNotificationRulesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    eventKey: z.string().trim().optional(),
    channel: notificationChannel.optional(),
    recipientRole: recipientRole.optional(),
    isEnabled: z.coerce.boolean().optional()
  })
});

export const createNotificationRuleSchema = z.object({
  body: z.object({
    eventKey: z.string().trim().min(2).max(120).regex(/^[a-z0-9._-]+$/),
    channel: notificationChannel.default("email"),
    recipientRole,
    emailTemplateId: uuid.optional().nullable(),
    isEnabled: z.boolean().optional(),
    conditions: z.record(z.unknown()).default({})
  })
});

export const updateNotificationRuleSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z
    .object({
      eventKey: z.string().trim().min(2).max(120).regex(/^[a-z0-9._-]+$/).optional(),
      channel: notificationChannel.optional(),
      recipientRole: recipientRole.optional(),
      emailTemplateId: uuid.optional().nullable(),
      conditions: z.record(z.unknown()).optional()
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field is required"
    })
});

export const updateNotificationRuleStatusSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z.object({
    isEnabled: z.boolean()
  })
});

export const listDeliveryLogsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    eventKey: z.string().trim().optional(),
    channel: notificationChannel.optional(),
    status: z.enum(["pending", "sent", "failed", "skipped"]).optional(),
    recipientUserId: uuid.optional()
  })
});

export const listMyNotificationsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().positive().max(20).default(5)
  })
});

export type ListNotificationRulesInput = z.infer<typeof listNotificationRulesSchema>["query"];
export type CreateNotificationRuleInput = z.infer<typeof createNotificationRuleSchema>["body"];
export type UpdateNotificationRuleInput = z.infer<typeof updateNotificationRuleSchema>["body"];
export type UpdateNotificationRuleStatusInput = z.infer<typeof updateNotificationRuleStatusSchema>["body"];
export type ListDeliveryLogsInput = z.infer<typeof listDeliveryLogsSchema>["query"];
export type ListMyNotificationsInput = z.infer<typeof listMyNotificationsSchema>["query"];
