import { z } from "zod";

const uuid = z.string().uuid();

export const listEmailTemplatesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().trim().optional(),
    isActive: z.coerce.boolean().optional()
  })
});

export const emailTemplateIdSchema = z.object({
  params: z.object({
    id: uuid
  })
});

export const createEmailTemplateSchema = z.object({
  body: z.object({
    key: z.string().trim().min(2).max(120).regex(/^[a-z0-9._-]+$/),
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
    subject: z.string().trim().min(1),
    htmlBody: z.string().trim().min(1),
    textBody: z.string().trim().optional(),
    availableVariables: z.array(z.string().trim().min(1)).default([]),
    isActive: z.boolean().optional()
  })
});

export const updateEmailTemplateSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z
    .object({
      key: z.string().trim().min(2).max(120).regex(/^[a-z0-9._-]+$/).optional(),
      name: z.string().trim().min(1).optional(),
      description: z.string().trim().nullable().optional(),
      subject: z.string().trim().min(1).optional(),
      htmlBody: z.string().trim().min(1).optional(),
      textBody: z.string().trim().nullable().optional(),
      availableVariables: z.array(z.string().trim().min(1)).optional()
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field is required"
    })
});

export const updateEmailTemplateStatusSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z.object({
    isActive: z.boolean()
  })
});

export type ListEmailTemplatesInput = z.infer<typeof listEmailTemplatesSchema>["query"];
export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>["body"];
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>["body"];
export type UpdateEmailTemplateStatusInput = z.infer<typeof updateEmailTemplateStatusSchema>["body"];
