import { z } from "zod";

const uuid = z.string().uuid();
const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Expected a valid ISO date-time"
});

export const attendanceStatusSchema = z.enum(["pending", "present", "absent", "late", "excused"]);

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
  body: z.object({
    classId: uuid,
    studentId: uuid,
    status: attendanceStatusSchema.exclude(["pending"]),
    teacherNotes: z.string().trim().max(2000).nullable().optional(),
    zoomJoinTime: isoDateTime.nullable().optional(),
    zoomLeaveTime: isoDateTime.nullable().optional(),
    totalZoomMinutes: z.number().int().min(0).nullable().optional()
  })
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
      totalZoomMinutes: z.number().int().min(0).nullable().optional()
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field is required"
    })
});

export type ListAttendanceInput = z.infer<typeof listAttendanceSchema>["query"];
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>["body"];
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>["body"];
