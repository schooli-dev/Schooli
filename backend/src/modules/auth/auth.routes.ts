import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import * as authController from "./auth.controller.js";
import { forgotPasswordSchema, loginSchema, logoutSchema, refreshSchema, resetPasswordSchema } from "./auth.validation.js";

export const authRoutes = Router();

authRoutes.post("/login", validate(loginSchema), authController.login);
authRoutes.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
authRoutes.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword);
authRoutes.post("/refresh", validate(refreshSchema), authController.refresh);
authRoutes.post("/logout", validate(logoutSchema), authController.logout);
authRoutes.get("/me", authMiddleware, authController.me);
