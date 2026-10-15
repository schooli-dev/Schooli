import { z } from "zod";

export const curriculumModulesQuerySchema = z.object({
  query: z.object({
    courseId: z.string().uuid().optional(),
    moduleId: z.string().uuid().optional(),
    status: z.enum(["all", "active", "inactive"]).optional(),
    sort: z.enum(["courseName", "moduleName", "classesDesc", "teachersDesc"]).optional()
  })
});

export const curriculumModuleTeachersParamsSchema = z.object({
  params: z.object({ moduleId: z.string().uuid() })
});
