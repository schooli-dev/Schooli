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

// 24:00 is allowed only as an end-of-day value. It lets adjacent daily slots
// cover midnight without creating an artificial 23:59 gap.
const timeString = z
  .string()
  .regex(/^(?:([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?|24:00(?::00)?)$/, "Expected HH:mm, HH:mm:ss, or 24:00");
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

const availabilityInput = z
  .object({
    dayOfWeek,
    startTime: timeString,
    endTime: timeString,
    timezone: ianaTimezone.default("Asia/Kolkata"),
    isActive: z.boolean().optional()
  })
  .refine((value) => toMinutes(value.startTime) < toMinutes(value.endTime), {
    message: "Start time must be before end time and availability cannot cross into the next day",
    path: ["endTime"]
  });

function toMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

export const createAvailabilitySchema = z.object({
  params: uuidParam,
  body: availabilityInput
});

export const replaceAvailabilitySchema = z.object({
  params: uuidParam,
  body: z.object({
    availability: z.array(availabilityInput).max(56)
  }).superRefine(({ availability }, context) => {
    const slotsByDay = new Map<string, Array<{ index: number; start: number; end: number }>>();
    const timezones = new Set(availability.map((slot) => slot.timezone));

    if (timezones.size > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "All weekly availability slots for a teacher must use the same timezone",
        path: ["availability"]
      });
    }

    availability.forEach((slot, index) => {
      const slots = slotsByDay.get(slot.dayOfWeek) ?? [];
      slots.push({ index, start: toMinutes(slot.startTime), end: toMinutes(slot.endTime) });
      slotsByDay.set(slot.dayOfWeek, slots);
    });

    for (const slots of slotsByDay.values()) {
      slots.sort((left, right) => left.start - right.start || left.end - right.end);

      for (let index = 1; index < slots.length; index += 1) {
        const previous = slots[index - 1];
        const current = slots[index];

        if (current.start < previous.end) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Time slots on the same day cannot overlap",
            path: ["availability", current.index, "startTime"]
          });
        }
      }
    }
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
