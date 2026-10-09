import { z } from "zod";
import { customHomeworkSchema } from "../homework/homework.validation.js";

const uuid = z.string().uuid();
const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Expected a valid ISO date-time"
});

export const attendanceStatusSchema = z.enum(["pending", "present", "absent", "late", "excused"]);

// The in-classroom Mark Attendance dialog (2026-09 redesign) only ever writes present/absent
// through markPresentAbsentSchema below; late/excused remain available to other flows (e.g.
// admin override, the existing teacher-attendance "Verify" page) via the schemas above.
export const academicOutcomeSchema = z.enum(["completed", "partially_completed", "continue_next_class"]);
export const attendanceHomeworkTypeSchema = z.enum(["none", "curriculum", "custom"]);

const outcomeFields = {
  academicOutcome: academicOutcomeSchema.optional(),
  taughtSummary: z.string().trim().max(4000).nullable().optional(),
  continueSummary: z.string().trim().max(4000).nullable().optional(),
  homeworkType: attendanceHomeworkTypeSchema.optional(),
  homeworkMaterialId: uuid.nullable().optional(),
  // Curriculum homework: any number of the homework items of the session's curriculum class,
  // each becoming its own assignment for this student, due on homeworkDueDate (default 7 days).
  homeworkMaterialIds: z.array(uuid).max(20).optional(),
  homeworkDueDate: isoDateTime.nullable().optional(),
  homeworkCustomText: z.string().trim().max(4000).nullable().optional(),
  // The "Create Custom Homework" form: created for this student when the attendance is saved.
  customHomework: customHomeworkSchema.optional()
};

/**
 * Cross-field rule shared by mark and update: an outcome (and anything that only makes sense
 * with one - taught/continue summary, homework) may only exist when status is 'present'.
 * `statusKnown` is false on PATCH when the caller isn't also changing status in this request,
 * in which case these checks are skipped here and re-asserted against the stored row in the
 * service layer (also backstopped by the DB CHECK constraint from migration 027).
 */
type OutcomeFieldsBody = {
  status?: string;
  academicOutcome?: string;
  taughtSummary?: string | null;
  continueSummary?: string | null;
  homeworkType?: string;
  homeworkMaterialId?: string | null;
  homeworkMaterialIds?: string[];
  homeworkDueDate?: string | null;
  homeworkCustomText?: string | null;
  customHomework?: unknown;
};

function refineOutcomeFields(body: OutcomeFieldsBody, context: z.RefinementCtx, statusKnown: boolean, requireOutcome = true) {
  const isPresent = body.status === "present";
  const hasOutcomeData =
    body.academicOutcome !== undefined ||
    body.taughtSummary ||
    body.continueSummary ||
    (body.homeworkType && body.homeworkType !== "none") ||
    body.homeworkMaterialId ||
    body.homeworkMaterialIds?.length ||
    body.homeworkCustomText;

  if (statusKnown && !isPresent && hasOutcomeData) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Academic outcome, homework, and taught/continue notes only apply when status is 'present'",
      path: ["academicOutcome"]
    });
  }

  if (requireOutcome && statusKnown && isPresent && body.academicOutcome === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Academic outcome is required when status is 'present'",
      path: ["academicOutcome"]
    });
  }

  if (body.homeworkType === "curriculum" && !body.homeworkMaterialId && !body.homeworkMaterialIds?.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one curriculum homework when homeworkType is 'curriculum'",
      path: ["homeworkMaterialIds"]
    });
  }

  // customHomework is optional on re-save (the homework assigned earlier is kept); the service
  // rejects a first save with homeworkType 'custom' and no form.
  if (body.customHomework && body.homeworkType !== "custom") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "customHomework requires homeworkType 'custom'",
      path: ["customHomework"]
    });
  }

  if ((!body.homeworkType || body.homeworkType === "none") && (body.homeworkMaterialId || body.homeworkMaterialIds?.length || body.homeworkCustomText)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "homeworkMaterialId/homeworkCustomText require homeworkType 'curriculum' or 'custom'",
      path: ["homeworkType"]
    });
  }
}

export const listAttendanceSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    classId: uuid.optional(),
    teacherId: uuid.optional(),
    studentId: uuid.optional(),
    status: attendanceStatusSchema.optional(),
    from: isoDateTime.optional(),
    to: isoDateTime.optional()
  })
});

export const classAttendanceSchema = z.object({
  params: z.object({
    id: uuid
  })
});

export const attendanceIdSchema = z.object({
  params: z.object({
    id: uuid
  })
});

export const markAttendanceSchema = z.object({
  body: z
    .object({
      classId: uuid,
      studentId: uuid,
      status: attendanceStatusSchema.exclude(["pending"]),
      teacherNotes: z.string().trim().max(2000).nullable().optional(),
      zoomJoinTime: isoDateTime.nullable().optional(),
      zoomLeaveTime: isoDateTime.nullable().optional(),
      totalZoomMinutes: z.number().int().min(0).nullable().optional(),
      ...outcomeFields
    })
    .superRefine((body, context) => refineOutcomeFields(body, context, true))
});

export const updateAttendanceSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z
    .object({
      status: attendanceStatusSchema.exclude(["pending"]).optional(),
      teacherNotes: z.string().trim().max(2000).nullable().optional(),
      zoomJoinTime: isoDateTime.nullable().optional(),
      zoomLeaveTime: isoDateTime.nullable().optional(),
      totalZoomMinutes: z.number().int().min(0).nullable().optional(),
      ...outcomeFields
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field is required"
    })
    // The retro-verify flow (PATCH) may confirm Present without a lesson outcome; the live
    // Mark Attendance dialog (POST /attendance/mark) always requires one.
    .superRefine((body, context) => refineOutcomeFields(body, context, body.status !== undefined, false))
});

export type ListAttendanceInput = z.infer<typeof listAttendanceSchema>["query"];
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>["body"];
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>["body"];
