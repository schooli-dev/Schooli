import { z } from "zod";

const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Expected a valid ISO date-time"
});

export const submissionTypeSchema = z.enum(["file", "text", "link", "file_text"]);

// Attachments are uploaded first (POST /api/homework/uploads) and referenced by storage key, so
// only keys under the homework/ prefix are accepted - never an arbitrary bucket path.
export const homeworkAttachmentSchema = z.object({
  storageKey: z.string().trim().min(1).max(500).startsWith("homework/"),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(150).nullable().optional(),
  sizeBytes: z.coerce.number().int().nonnegative().nullable().optional()
});

/** The "Create Custom Homework" form. It is assigned to exactly one student by the attendance save. */
export const customHomeworkSchema = z.object({
  title: z.string().trim().min(2).max(200),
  instructions: z.string().trim().max(5000).nullable().optional(),
  maxPoints: z.coerce.number().int().min(1).max(1000).default(10),
  dueDate: isoDateTime.nullable().optional(),
  submissionType: submissionTypeSchema.default("file"),
  attachments: z.array(homeworkAttachmentSchema).max(10).default([]),
  saveToLibrary: z.boolean().default(false)
});

export type CustomHomeworkInput = z.infer<typeof customHomeworkSchema>;

const uuid = z.string().uuid();

export const homeworkIdSchema = z.object({ params: z.object({ id: uuid }) });

export const homeworkResourceFileSchema = z.object({ params: z.object({ id: uuid, resourceId: uuid }) });

export const homeworkSubmissionFileSchema = z.object({ params: z.object({ id: uuid, submissionId: uuid, fileId: uuid }) });

export const listHomeworkSchema = z.object({
  query: z.object({
    status: z
      .enum(["all", "pending", "submitted", "needs_revision", "completed", "completed_this_week", "overdue"])
      .default("all"),
    search: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().positive().max(200).default(100)
  })
});

// Student work is uploaded first (POST /api/homework/submission-uploads) and referenced by key.
const submissionFileSchema = z.object({
  storageKey: z.string().trim().min(1).max(500).startsWith("homework-submissions/"),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(150).nullable().optional(),
  sizeBytes: z.coerce.number().int().nonnegative().nullable().optional()
});

export const submitHomeworkSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    text: z.string().trim().max(20000).optional(),
    link: z.string().trim().url().max(2000).optional(),
    comment: z.string().trim().max(2000).optional(),
    files: z.array(submissionFileSchema).max(10).default([])
  })
});

export const reviewHomeworkSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      result: z.enum(["complete", "revision"]),
      points: z.coerce.number().min(0).max(1000),
      feedback: z.string().trim().max(5000).optional()
    })
    .superRefine((body, context) => {
      if (body.result === "revision" && !body.feedback) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Feedback is required when asking for a revision", path: ["feedback"] });
      }
    })
});

export type ListHomeworkInput = z.infer<typeof listHomeworkSchema>["query"];
export type SubmitHomeworkInput = z.infer<typeof submitHomeworkSchema>["body"];
export type ReviewHomeworkInput = z.infer<typeof reviewHomeworkSchema>["body"];
