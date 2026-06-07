import { z } from "zod";

const assignmentStatus = z.enum(["active", "inactive"]);

export const listAssignmentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: assignmentStatus.optional(),
    teacherId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional()
  })
});

export const createAssignmentSchema = z.object({
  body: z.object({
    teacherId: z.string().uuid(),
    studentId: z.string().uuid(),
    notes: z.string().trim().optional()
  })
});

export const updateAssignmentStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    status: assignmentStatus
  })
});

export type ListAssignmentsInput = z.infer<typeof listAssignmentsSchema>["query"];
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>["body"];
export type UpdateAssignmentStatusInput = z.infer<typeof updateAssignmentStatusSchema>["body"];
