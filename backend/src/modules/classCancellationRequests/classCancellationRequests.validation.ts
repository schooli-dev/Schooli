import { z } from "zod";

const uuid = z.string().uuid();
const requestStatus = z.enum(["pending", "approved", "rejected", "withdrawn"]);

export const listCancellationRequestsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: requestStatus.optional(),
    classId: uuid.optional(),
    requestedByUserId: uuid.optional()
  })
});

export const listClassCancellationRequestsSchema = z.object({
  params: z.object({
    id: uuid
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: requestStatus.optional()
  })
});

export const createCancellationRequestSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z.object({
    reason: z.string().trim().min(1)
  })
});

export const updateCancellationRequestStatusSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z.object({
    status: z.enum(["approved", "rejected", "withdrawn"]),
    adminNote: z.string().trim().optional()
  })
});

export type ListCancellationRequestsInput = z.infer<typeof listCancellationRequestsSchema>["query"];
export type ListClassCancellationRequestsInput = z.infer<typeof listClassCancellationRequestsSchema>["query"];
export type CreateCancellationRequestInput = z.infer<typeof createCancellationRequestSchema>["body"];
export type UpdateCancellationRequestStatusInput = z.infer<typeof updateCancellationRequestStatusSchema>["body"];
