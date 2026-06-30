import { z } from "zod";

const uuidParam = z.object({
  id: z.string().uuid()
});

const dayOfWeek = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
]);

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Expected HH:mm or HH:mm:ss");
const ianaTimezone = z.string().trim().min(1).refine(
  (value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
      return true;
    } catch {
      return false;
    }
  },
  { message: "Expected a valid IANA timezone such as Asia/Kolkata or Europe/Paris" }
);

export const listTeachersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().trim().optional(),
    status: z.enum(["active", "inactive", "suspended"]).optional()
  })
});

export const teacherIdSchema = z.object({
  params: uuidParam
});

export const createAvailabilitySchema = z.object({
  params: uuidParam,
  body: z.object({
    dayOfWeek,
    startTime: timeString,
    endTime: timeString,
    timezone: ianaTimezone.default("Asia/Kolkata"),
    isActive: z.boolean().optional()
  })
});

const availabilityInput = z
  .object({
    dayOfWeek,
    startTime: timeString,
    endTime: timeString,
    timezone: ianaTimezone.default("Asia/Kolkata"),
    isActive: z.boolean().optional()
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "Start time must be before end time",
    path: ["endTime"]
  });

export const replaceAvailabilitySchema = z.object({
  params: uuidParam,
  body: z.object({
    availability: z.array(availabilityInput).max(14)
  })
});

export const createUnavailableDateSchema = z.object({
  params: uuidParam,
  body: z.object({
    unavailableDate: z.string().date(),
    startTime: timeString.optional(),
    endTime: timeString.optional(),
    reason: z.string().trim().optional()
  })
});

export const deleteUnavailableDateSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    dateId: z.string().uuid()
  })
});

export type ListTeachersInput = z.infer<typeof listTeachersSchema>["query"];
export type CreateAvailabilityInput = z.infer<typeof createAvailabilitySchema>["body"];
export type ReplaceAvailabilityInput = z.infer<typeof replaceAvailabilitySchema>["body"];
export type CreateUnavailableDateInput = z.infer<typeof createUnavailableDateSchema>["body"];
