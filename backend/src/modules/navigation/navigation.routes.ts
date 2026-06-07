import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import * as navigationController from "./navigation.controller.js";

export const navigationRoutes = Router();

navigationRoutes.use(authMiddleware);
navigationRoutes.get("/pages", navigationController.getPages);
