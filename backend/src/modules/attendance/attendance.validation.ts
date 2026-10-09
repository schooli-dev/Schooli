import { z } from "zod";

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
  homeworkCustomText: z.string().trim().max(4000).nullable().optional()
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
  homeworkCustomText?: string | null;
};

function refineOutcomeFields(body: OutcomeFieldsBody, context: z.RefinementCtx, statusKnown: boolean, requireOutcome = true) {
  const isPresent = body.status === "present";
  const hasOutcomeData =
    body.academicOutcome !== undefined ||
    body.taughtSummary ||
    body.continueSummary ||
    (body.homeworkType && body.homeworkType !== "none") ||
    body.homeworkMaterialId ||
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

  if (body.homeworkType === "curriculum" && !body.homeworkMaterialId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "homeworkMaterialId is required when homeworkType is 'curriculum'",
      path: ["homeworkMaterialId"]
    });
  }

  if (body.homeworkType === "custom" && !body.homeworkCustomText) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "homeworkCustomText is required when homeworkType is 'custom'",
      path: ["homeworkCustomText"]
    });
  }

  if ((!body.homeworkType || body.homeworkType === "none") && (body.homeworkMaterialId || body.homeworkCustomText)) {
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
