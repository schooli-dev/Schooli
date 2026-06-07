import { z } from "zod";

const uuid = z.string().uuid();
const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Expected a valid ISO date-time"
});

export const listClassesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.enum(["scheduled", "live", "completed", "cancelled", "rescheduled", "failed", "no_show"]).optional(),
    teacherId: uuid.optional(),
    studentId: uuid.optional(),
    from: isoDateTime.optional(),
    to: isoDateTime.optional()
  })
});

export const classIdSchema = z.object({
  params: z.object({
    id: uuid
  })
});

export const checkConflictsSchema = z.object({
  body: z.object({
    teacherId: uuid,
    studentId: uuid,
    startTime: isoDateTime,
    durationMinutes: z.number().int().positive().max(480),
    timezone: z.string().trim().min(1).default("Asia/Kolkata"),
    excludeClassId: uuid.optional()
  })
});

export const createClassSchema = z.object({
  body: z.object({
    teacherId: uuid,
    studentId: uuid,
    title: z.string().trim().min(1),
    startTime: isoDateTime,
    durationMinutes: z.number().int().positive().max(480),
    timezone: z.string().trim().min(1).default("Asia/Kolkata"),
    notes: z.string().trim().optional(),
    overrideConflicts: z.boolean().optional()
  })
});

export const updateClassSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z
    .object({
      title: z.string().trim().min(1).optional(),
      notes: z.string().trim().nullable().optional()
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field is required"
    })
});

export const cancelClassSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z.object({
    reason: z.string().trim().min(1)
  })
});

export const rescheduleClassSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z.object({
    startTime: isoDateTime,
    durationMinutes: z.number().int().positive().max(480),
    timezone: z.string().trim().min(1).default("Asia/Kolkata"),
    overrideConflicts: z.boolean().optional()
  })
});

export type ListClassesInput = z.infer<typeof listClassesSchema>["query"];
export type CheckConflictsInput = z.infer<typeof checkConflictsSchema>["body"];
export type CreateClassInput = z.infer<typeof createClassSchema>["body"];
export type UpdateClassInput = z.infer<typeof updateClassSchema>["body"];
export type CancelClassInput = z.infer<typeof cancelClassSchema>["body"];
export type RescheduleClassInput = z.infer<typeof rescheduleClassSchema>["body"];
