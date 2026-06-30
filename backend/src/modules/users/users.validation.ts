import { z } from "zod";

const uuidParam = z.object({
  id: z.string().uuid()
});

const userStatus = z.enum(["active", "inactive", "suspended"]);
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
const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Expected a valid ISO date-time"
});
const strongPassword = z
  .string()
  .min(12)
  .max(72)
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");
const personName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z][A-Za-z\s'-]*$/, "Only letters, spaces, apostrophes, and hyphens are allowed");

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().trim().optional(),
    role: z.string().trim().optional(),
    status: userStatus.optional(),
    createdFrom: isoDateTime.optional(),
    createdTo: isoDateTime.optional()
  })
});

export const getUserSchema = z.object({
  params: uuidParam
});

export const createUserSchema = z.object({
  body: z.object({
    firstName: personName,
    lastName: personName,
    username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/).optional(),
    email: z.string().trim().email(),
    phone: z.string().trim().min(8).max(20).regex(/^\+\d{1,4}\d{6,15}$/, "Expected ISD code followed by phone number"),
    timezone: ianaTimezone.default("Asia/Kolkata"),
    password: strongPassword,
    avatarUrl: z.string().url().optional(),
    roles: z.array(z.string().trim().min(1)).min(1).optional()
  })
});

export const updateUserSchema = z.object({
  params: uuidParam,
  body: z
    .object({
      firstName: z.string().trim().min(1).optional(),
      lastName: z.string().trim().min(1).optional(),
      username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/).nullable().optional(),
      email: z.string().trim().email().optional(),
      phone: z.string().trim().min(5).max(30).nullable().optional(),
      timezone: ianaTimezone.optional(),
      avatarUrl: z.string().url().nullable().optional()
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field is required"
    })
});

export const updateUserStatusSchema = z.object({
  params: uuidParam,
  body: z.object({
    status: userStatus,
    isActive: z.boolean().optional()
  })
});

export const assignUserRolesSchema = z.object({
  params: uuidParam,
  body: z.object({
    roles: z.array(z.string().trim().min(1)).min(1)
  })
});

export type ListUsersInput = z.infer<typeof listUsersSchema>["query"];
export type CreateUserInput = z.infer<typeof createUserSchema>["body"];
export type UpdateUserInput = z.infer<typeof updateUserSchema>["body"];
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>["body"];
export type AssignUserRolesInput = z.infer<typeof assignUserRolesSchema>["body"];
