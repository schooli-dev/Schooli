import { z } from "zod";

export const curriculumModulesQuerySchema = z.object({
  query: z.object({
    courseId: z.string().uuid().optional(),
    moduleId: z.string().uuid().optional(),
    status: z.enum(["all", "active", "inactive"]).optional(),
    sort: z.enum(["courseName", "moduleName", "classesDesc", "teachersDesc"]).optional()
  })
});

export const homeworkAssignmentsQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(160).optional(),
    status: z.enum(["all", "pending", "pending_review", "revision_required", "completed", "overdue"]).optional(),
    studentId: z.string().uuid().optional(),
    teacherId: z.string().uuid().optional(),
    courseId: z.string().uuid().optional(),
    moduleId: z.string().uuid().optional(),
    lessonId: z.string().uuid().optional(),
    homeworkType: z.enum(["all", "curriculum", "custom"]).optional(),
    dateFrom: z.string().trim().max(40).optional(),
    dateTo: z.string().trim().max(40).optional(),
    sort: z.enum(["assignedDesc", "assignedAsc", "dueDateAsc", "dueDateDesc", "studentName"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional()
  })
});

export const curriculumModuleTeachersParamsSchema = z.object({
  params: z.object({ moduleId: z.string().uuid() })
});

export const homeworkAssignmentIdParamsSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

export const homeworkSubmissionFileParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    submissionId: z.string().uuid(),
    fileId: z.string().uuid()
  })
});
