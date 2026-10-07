import { z } from "zod";

export const listStudentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().trim().optional(),
    status: z.enum(["active", "inactive", "suspended"]).optional()
  })
});

export const studentIdSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
});

export const myStudentCurriculumSchema = z.object({
  params: z.object({
    studentId: z.string().uuid()
  }),
  query: z.object({
    moduleId: z.string().uuid().optional(),
    lessonId: z.string().uuid().optional()
  })
});

export type ListStudentsInput = z.infer<typeof listStudentsSchema>["query"];
