import { z } from "zod";

const idParam = z.object({ id: z.string().uuid() });
const status = z.enum(["active", "inactive"]);
const name = z.string().trim().min(2).max(160);
const description = z.string().trim().max(4000).nullable().optional();

export const listCoursesSchema = z.object({
  query: z.object({
    search: z.string().trim().max(160).optional(),
    status: z.enum(["all", "active", "inactive"]).optional()
  })
});

export const createCourseSchema = z.object({
  body: z.object({
    name,
    description,
    iconKey: z.string().trim().min(1).max(80).default("bi-code-slash"),
    iconUrl: z.string().trim().url().nullable().optional(),
    status: status.default("active")
  })
});

export const updateCourseSchema = z.object({
  params: idParam,
  body: z.object({
    name: name.optional(),
    description,
    iconKey: z.string().trim().min(1).max(80).optional(),
    iconUrl: z.string().trim().url().nullable().optional(),
    status: status.optional()
  }).refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" })
});

export const getCourseSchema = z.object({ params: idParam });

export const listModulesSchema = z.object({
  query: z.object({
    search: z.string().trim().max(160).optional(),
    courseId: z.string().uuid().optional(),
    status: z.enum(["all", "active", "inactive"]).optional(),
    sort: z.enum(["order", "name", "createdAt", "updatedAt"]).optional()
  })
});

export const createModuleSchema = z.object({
  body: z.object({
    courseId: z.string().uuid(),
    name,
    description,
    sortOrder: z.coerce.number().int().positive(),
    status: status.default("active")
  })
});

export const updateModuleSchema = z.object({
  params: idParam,
  body: z.object({
    courseId: z.string().uuid().optional(),
    name: name.optional(),
    description,
    sortOrder: z.coerce.number().int().positive().optional(),
    status: status.optional()
  }).refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" })
});

export const getModuleSchema = z.object({ params: idParam });

export const replaceModuleTeachersSchema = z.object({
  params: idParam,
  body: z.object({ teacherIds: z.array(z.string().uuid()) })
});

const materialSection = z.enum(["presentation", "lesson_plan", "homework", "file"]);
const materialSource = z.enum(["file", "link"]);
const materialAudience = z.enum(["teachers_only", "students_and_teachers"]);

export const listLessonsSchema = z.object({ query: z.object({ moduleId: z.string().uuid().optional(), status: z.enum(["all", "active", "inactive"]).optional() }) });
export const getLessonSchema = z.object({ params: idParam });
export const createLessonSchema = z.object({ body: z.object({ moduleId: z.string().uuid(), lessonNumber: z.coerce.number().int().positive(), title: name, description, sortOrder: z.coerce.number().int().positive(), status: status.default("active") }) });
export const updateLessonSchema = z.object({ params: idParam, body: z.object({ moduleId: z.string().uuid().optional(), lessonNumber: z.coerce.number().int().positive().optional(), title: name.optional(), description, sortOrder: z.coerce.number().int().positive().optional(), status: status.optional() }).refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" }) });

const materialDetails = z.object({
  section: materialSection, sourceType: materialSource, title: name,
  fileUrl: z.string().trim().url().optional(), storageKey: z.string().trim().min(1).max(500).optional(), fileName: z.string().trim().min(1).max(255).optional(), mimeType: z.string().trim().max(150).optional(), sizeBytes: z.coerce.number().int().nonnegative().optional(),
  externalUrl: z.string().trim().url().optional(), audience: materialAudience.default("teachers_only"), allowLateSubmission: z.boolean().default(false)
}).superRefine((input, ctx) => {
  if (input.sourceType === "file" && !input.fileUrl && !input.storageKey) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["storageKey"], message: "A file upload or fileUrl is required for file material" });
  if (input.sourceType === "link" && !input.externalUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["externalUrl"], message: "externalUrl is required for linked material" });
});

const materialBody = z.object({ lessonId: z.string().uuid() }).merge(materialDetails.innerType()).superRefine((input, ctx) => {
  if (input.sourceType === "file" && !input.fileUrl && !input.storageKey) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["storageKey"], message: "A file upload or fileUrl is required for file material" });
  if (input.sourceType === "link" && !input.externalUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["externalUrl"], message: "externalUrl is required for linked material" });
});

export const createMaterialSchema = z.object({ body: materialBody });
export const createMaterialRevisionSchema = z.object({ params: idParam, body: materialDetails });
