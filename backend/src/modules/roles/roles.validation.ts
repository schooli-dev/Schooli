import { z } from "zod";

const uuidParam = z.object({
  id: z.string().uuid()
});

const roleName = z
  .string()
  .trim()
  .min(3)
  .max(60)
  .regex(/^[A-Za-z][A-Za-z0-9 _-]*$/, "Role name must start with a letter and use letters, numbers, spaces, underscores, or hyphens");

const permissionKeys = z.array(z.string().trim().min(1)).min(1);

export const createRoleSchema = z.object({
  body: z.object({
    name: roleName,
    description: z.string().trim().max(500).nullable().optional(),
    permissions: permissionKeys
  })
});

export const updateRoleSchema = z.object({
  params: uuidParam,
  body: z.object({
    name: roleName.optional(),
    description: z.string().trim().max(500).nullable().optional(),
    permissions: permissionKeys
  })
});
