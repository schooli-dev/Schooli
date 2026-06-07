import { Router } from "express";
import * as appDetailsController from "./appDetails.controller.js";

export const appDetailsRoutes = Router();

appDetailsRoutes.get("/details", appDetailsController.getDetails);
