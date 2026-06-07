import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(1, "Email or phone is required"),
    password: z.string().min(1, "Password is required")
  })
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required")
  })
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required")
  })
});

export type LoginInput = z.infer<typeof loginSchema>["body"];
export type RefreshInput = z.infer<typeof refreshSchema>["body"];
export type LogoutInput = z.infer<typeof logoutSchema>["body"];
