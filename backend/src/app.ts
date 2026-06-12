import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openApiSpec } from "./docs/openapi.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { appDetailsRoutes } from "./modules/appDetails/appDetails.routes.js";
import { adminDashboardRoutes } from "./modules/adminDashboard/adminDashboard.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { attendanceRoutes, classAttendanceRoutes } from "./modules/attendance/attendance.routes.js";
import {
  classCancellationRequestsRoutes,
  classCancellationSubroutes
} from "./modules/classCancellationRequests/classCancellationRequests.routes.js";
import { calendarRoutes, classesRoutes } from "./modules/classes/classes.routes.js";
import { dailyClassRoutes, dailyRoutes } from "./modules/daily/daily.routes.js";
import { emailTemplatesRoutes } from "./modules/emailTemplates/emailTemplates.routes.js";
import {
  notificationDeliveryLogsRoutes,
  notificationRulesRoutes
} from "./modules/notifications/notifications.routes.js";
import { navigationRoutes } from "./modules/navigation/navigation.routes.js";
import { permissionsRoutes } from "./modules/permissions/permissions.routes.js";
import { rolesRoutes } from "./modules/roles/roles.routes.js";
import { studentsRoutes } from "./modules/students/students.routes.js";
import { teachersRoutes } from "./modules/teachers/teachers.routes.js";
import { teacherStudentAssignmentsRoutes } from "./modules/teacherStudentAssignments/teacherStudentAssignments.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { sendSuccess } from "./utils/apiResponse.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
      (req as typeof req & { rawBody?: string }).rawBody = buffer.toString("utf8");
    }
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/api/docs.json", (_req, res) => {
  res.json(openApiSpec);
});
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    sendSuccess(res, {
      message: "Backend is healthy",
      data: {
        service: "schooliedu-backend",
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString()
      }
    });
  })
);

app.use("/api/app", appDetailsRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/permissions", permissionsRoutes);
app.use("/api/navigation", navigationRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/teachers", teachersRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/teacher-student-assignments", teacherStudentAssignmentsRoutes);
app.use("/api/class-cancellation-requests", classCancellationRequestsRoutes);
app.use("/api/classes/:id/cancel-requests", classCancellationSubroutes);
app.use("/api/classes/:id/attendance", classAttendanceRoutes);
app.use("/api/classes/:id/daily", dailyClassRoutes);
app.use("/api/classes", classesRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/daily", dailyRoutes);
app.use("/api/email-templates", emailTemplatesRoutes);
app.use("/api/notification-rules", notificationRulesRoutes);
app.use("/api/notification-delivery-logs", notificationDeliveryLogsRoutes);

app.use(errorMiddleware);
