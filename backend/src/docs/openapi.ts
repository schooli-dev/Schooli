import swaggerJSDoc from "swagger-jsdoc";
import { env } from "../config/env.js";

function getApiServerUrl(): string {
  if (!env.PUBLIC_API_BASE_URL) {
    return "http://localhost:5000";
  }

  try {
    return new URL(env.PUBLIC_API_BASE_URL).origin;
  } catch {
    return "http://localhost:5000";
  }
}

export const openApiSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SchooliEdu Backend API",
      version: "0.1.0",
      description: "Backend API for the SchooliEdu learning management platform."
    },
    servers: [
      {
        url: getApiServerUrl(),
        description: env.NODE_ENV === "production" ? "Deployed API" : "Local development"
      }
    ],
    tags: [
      { name: "Health" },
      { name: "Auth" },
      { name: "Roles" },
      { name: "Permissions" },
      { name: "Navigation" },
      { name: "Users" },
      { name: "Teachers" },
      { name: "Students" },
      { name: "Teacher Student Assignments" },
      { name: "Classes" },
      { name: "Calendar" },
      { name: "Class Cancellation Requests" },
      { name: "Attendance" },
      { name: "Daily" },
      { name: "Email Templates" },
      { name: "Notifications" },
      { name: "Notification Manager" },
      { name: "Learning Materials" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: { nullable: true }
          }
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                details: { nullable: true }
              }
            }
          }
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            username: { type: "string", nullable: true },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string", nullable: true },
            avatarUrl: { type: "string", nullable: true },
            status: { type: "string", enum: ["active", "inactive", "suspended"] },
            isActive: { type: "boolean" },
            roles: {
              type: "array",
              items: { type: "string" }
            }
          }
        },
        LoginRequest: {
          type: "object",
          required: ["identifier", "password"],
          properties: {
            identifier: { type: "string", example: "admin" },
            password: { type: "string", example: "Schooli@2025" }
          }
        },
        RefreshTokenRequest: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" }
          }
        },
        CreateUserRequest: {
          type: "object",
          required: ["firstName", "lastName", "email", "password"],
          properties: {
            firstName: { type: "string", example: "Demo" },
            lastName: { type: "string", example: "Teacher" },
            username: { type: "string", example: "demo_teacher" },
            email: { type: "string", format: "email", example: "demo.teacher@schooliedu.local" },
            phone: { type: "string", example: "+919999999999" },
            password: { type: "string", example: "Schooli@2025" },
            avatarUrl: { type: "string", example: "https://example.com/avatar.png" },
            roles: {
              type: "array",
              items: { type: "string", enum: ["admin", "teacher", "student", "support"] },
              example: ["teacher"]
            }
          }
        },
        UpdateUserRequest: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            username: { type: "string", nullable: true },
            email: { type: "string", format: "email" },
            phone: { type: "string", nullable: true },
            avatarUrl: { type: "string", nullable: true }
          }
        },
        UpdateUserStatusRequest: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["active", "inactive", "suspended"] },
            isActive: { type: "boolean" }
          }
        },
        AssignUserRolesRequest: {
          type: "object",
          required: ["roles"],
          properties: {
            roles: {
              type: "array",
              items: { type: "string", enum: ["admin", "teacher", "student", "support"] },
              example: ["teacher"]
            }
          }
        },
        CreateAssignmentRequest: {
          type: "object",
          required: ["teacherId", "studentId"],
          properties: {
            teacherId: { type: "string", format: "uuid" },
            studentId: { type: "string", format: "uuid" },
            notes: { type: "string", example: "Initial teacher assignment" }
          }
        },
        UpdateAssignmentStatusRequest: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["active", "inactive"] }
          }
        },
        CreateAvailabilityRequest: {
          type: "object",
          required: ["dayOfWeek", "startTime", "endTime"],
          properties: {
            dayOfWeek: {
              type: "string",
              enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
              example: "monday"
            },
            startTime: { type: "string", example: "16:00" },
            endTime: { type: "string", example: "20:00" },
            timezone: { type: "string", example: "Asia/Kolkata" },
            isActive: { type: "boolean", example: true }
          }
        },
        CreateUnavailableDateRequest: {
          type: "object",
          required: ["unavailableDate"],
          properties: {
            unavailableDate: { type: "string", format: "date", example: "2026-06-10" },
            startTime: { type: "string", example: "16:00" },
            endTime: { type: "string", example: "18:00" },
            reason: { type: "string", example: "Personal leave" }
          }
        },
        CheckClassConflictsRequest: {
          type: "object",
          required: ["teacherId", "studentId", "startTime", "durationMinutes"],
          properties: {
            teacherId: { type: "string", format: "uuid" },
            studentId: { type: "string", format: "uuid" },
            startTime: { type: "string", format: "date-time" },
            durationMinutes: { type: "integer", example: 60 },
            timezone: { type: "string", example: "Asia/Kolkata" },
            excludeClassId: { type: "string", format: "uuid" }
          }
        },
        CreateClassRequest: {
          type: "object",
          required: ["teacherId", "studentId", "title", "startTime", "durationMinutes"],
          properties: {
            teacherId: { type: "string", format: "uuid" },
            studentId: { type: "string", format: "uuid" },
            title: { type: "string", example: "Math class" },
            startTime: { type: "string", format: "date-time" },
            durationMinutes: { type: "integer", example: 60 },
            timezone: { type: "string", example: "Asia/Kolkata" },
            notes: { type: "string" },
            overrideConflicts: { type: "boolean", example: false }
          }
        },
        AvailableTeachersForSeriesRequest: {
          type: "object",
          required: ["studentId", "curriculumModuleId", "startDate", "timezone", "weeklySchedules", "classCount"],
          properties: {
            studentId: { type: "string", format: "uuid" },
            curriculumModuleId: { type: "string", format: "uuid" },
            startDate: { type: "string", format: "date", example: "2026-09-07" },
            timezone: { type: "string", example: "America/New_York" },
            weeklySchedules: {
              type: "array",
              items: {
                type: "object",
                required: ["dayOfWeek", "startTime"],
                properties: {
                  dayOfWeek: { type: "string", enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
                  startTime: { type: "string", example: "09:00" }
                }
              }
            },
            classCount: { type: "integer", example: 20 }
          }
        },
        CreateClassSeriesRequest: {
          type: "object",
          required: ["teacherId", "studentId", "curriculumModuleId", "startDate", "timezone", "weeklySchedules", "classCount"],
          properties: {
            teacherId: { type: "string", format: "uuid", description: "Chosen from the step-3 available-teachers response." },
            studentId: { type: "string", format: "uuid" },
            curriculumModuleId: { type: "string", format: "uuid" },
            startingLessonId: {
              type: "string",
              format: "uuid",
              description: "Optional. Begin mapping at this curriculum class of the module instead of its first one (e.g. a follow-up series finishing the remaining classes)."
            },
            title: {
              type: "string",
              example: "Math class",
              description: "Optional. Left unset, each occurrence's title is auto-populated from the module's ordered curriculum classes."
            },
            startDate: { type: "string", format: "date", example: "2026-09-07" },
            timezone: { type: "string", example: "America/New_York" },
            weeklySchedules: {
              type: "array",
              items: {
                type: "object",
                required: ["dayOfWeek", "startTime"],
                properties: {
                  dayOfWeek: { type: "string", enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
                  startTime: { type: "string", example: "09:00" }
                }
              }
            },
            classCount: { type: "integer", example: 20 },
            notes: { type: "string" },
            overrideConflicts: { type: "boolean", example: false }
          }
        },
        UpdateClassRequest: {
          type: "object",
          properties: {
            title: { type: "string" },
            notes: { type: "string", nullable: true }
          }
        },
        CancelClassRequest: {
          type: "object",
          required: ["reason"],
          properties: {
            reason: { type: "string", example: "Student requested cancellation" }
          }
        },
        RescheduleClassRequest: {
          type: "object",
          required: ["startTime", "durationMinutes"],
          properties: {
            startTime: { type: "string", format: "date-time" },
            durationMinutes: { type: "integer", example: 60 },
            timezone: { type: "string", example: "Asia/Kolkata" },
            overrideConflicts: { type: "boolean", example: false }
          }
        },
        CreateCancellationRequest: {
          type: "object",
          required: ["reason"],
          properties: {
            reason: { type: "string", example: "Student has an exam at the same time" }
          }
        },
        ReviewCancellationRequest: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["approved", "rejected", "withdrawn"], example: "approved" },
            adminNote: { type: "string", example: "Approved by admin" }
          }
        },
        MarkAttendanceRequest: {
          type: "object",
          required: ["classId", "studentId", "status"],
          properties: {
            classId: { type: "string", format: "uuid" },
            studentId: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["present", "absent", "late", "excused"], example: "present" },
            teacherNotes: { type: "string", nullable: true, example: "Student joined on time and completed the lesson." },
            zoomJoinTime: { type: "string", format: "date-time", nullable: true },
            zoomLeaveTime: { type: "string", format: "date-time", nullable: true },
            totalZoomMinutes: { type: "integer", nullable: true, example: 57 },
            academicOutcome: {
              type: "string",
              enum: ["completed", "partially_completed", "continue_next_class"],
              description: "Required when status is 'present'; rejected for any other status."
            },
            taughtSummary: { type: "string", nullable: true, description: "What was taught this session. Present only." },
            continueSummary: { type: "string", nullable: true, description: "What should continue next session. Present only." },
            homeworkType: { type: "string", enum: ["none", "curriculum", "custom"], default: "none" },
            homeworkMaterialId: { type: "string", format: "uuid", nullable: true, description: "Single curriculum homework (compatibility); prefer homeworkMaterialIds." },
            homeworkMaterialIds: { type: "array", items: { type: "string", format: "uuid" }, description: "homeworkType curriculum: one or more homework materials of the mapped curriculum lesson. Each becomes an assignment visible in Student Homework immediately; re-saving does not duplicate." },
            homeworkDueDate: { type: "string", format: "date-time", nullable: true, description: "Due date for the curriculum assignments (default 7 days)." },
            homeworkCustomText: { type: "string", nullable: true, description: "Legacy free text; custom homework now comes from customHomework." },
            customHomework: {
              type: "object",
              description: "The Create Custom Homework form. Allowed only with homeworkType 'custom'; created for this one student in the same transaction as the attendance. Omit on re-save to keep the homework assigned earlier.",
              required: ["title"],
              properties: {
                title: { type: "string" },
                instructions: { type: "string", nullable: true },
                maxPoints: { type: "integer", default: 10 },
                dueDate: { type: "string", format: "date-time", nullable: true },
                submissionType: { type: "string", enum: ["file", "text", "link", "file_text"], default: "file" },
                attachments: { type: "array", items: { type: "object", properties: { storageKey: { type: "string", description: "From POST /api/homework/uploads (must start with homework/)." }, fileName: { type: "string" }, mimeType: { type: "string" }, sizeBytes: { type: "integer" } } } },
                saveToLibrary: { type: "boolean", default: false }
              }
            }
          }
        },
        UpdateAttendanceRequest: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["present", "absent", "late", "excused"] },
            teacherNotes: { type: "string", nullable: true },
            zoomJoinTime: { type: "string", format: "date-time", nullable: true },
            zoomLeaveTime: { type: "string", format: "date-time", nullable: true },
            totalZoomMinutes: { type: "integer", nullable: true },
            academicOutcome: { type: "string", enum: ["completed", "partially_completed", "continue_next_class"] },
            taughtSummary: { type: "string", nullable: true },
            continueSummary: { type: "string", nullable: true },
            homeworkType: { type: "string", enum: ["none", "curriculum", "custom"] },
            homeworkMaterialId: { type: "string", format: "uuid", nullable: true },
            homeworkCustomText: { type: "string", nullable: true }
          }
        },
        CreateDailyRoomRequest: {
          type: "object",
          required: ["classId"],
          properties: {
            classId: { type: "string", format: "uuid" }
          }
        },
        DailyJoinRequest: {
          type: "object",
          properties: {
            role: { type: "integer", enum: [0, 1], example: 0 }
          }
        },
        CreateEmailTemplateRequest: {
          type: "object",
          required: ["key", "name", "subject", "htmlBody"],
          properties: {
            key: { type: "string", example: "class.scheduled.default" },
            name: { type: "string", example: "Class Scheduled" },
            description: { type: "string", example: "Sent when a class is scheduled" },
            subject: { type: "string", example: "Your class is scheduled" },
            htmlBody: { type: "string", example: "<h1>Hello {{studentName}}</h1><p>Your class starts at {{startTime}}</p>" },
            textBody: { type: "string", example: "Hello {{studentName}}, your class starts at {{startTime}}" },
            availableVariables: {
              type: "array",
              items: { type: "string" },
              example: ["studentName", "teacherName", "startTime", "joinUrl"]
            },
            isActive: { type: "boolean", example: true }
          }
        },
        UpdateEmailTemplateRequest: {
          type: "object",
          properties: {
            key: { type: "string" },
            name: { type: "string" },
            description: { type: "string", nullable: true },
            subject: { type: "string" },
            htmlBody: { type: "string" },
            textBody: { type: "string", nullable: true },
            availableVariables: {
              type: "array",
              items: { type: "string" }
            }
          }
        },
        UpdateEmailTemplateStatusRequest: {
          type: "object",
          required: ["isActive"],
          properties: {
            isActive: { type: "boolean" }
          }
        },
        CreateNotificationRuleRequest: {
          type: "object",
          required: ["eventKey", "recipientRole"],
          properties: {
            eventKey: { type: "string", example: "class.scheduled" },
            channel: { type: "string", enum: ["email", "in_app", "sms_future", "whatsapp_future"], example: "email" },
            recipientRole: { type: "string", enum: ["admin", "teacher", "student", "support"], example: "student" },
            emailTemplateId: { type: "string", format: "uuid", nullable: true },
            isEnabled: { type: "boolean", example: true },
            conditions: { type: "object", example: {} }
          }
        },
        UpdateNotificationRuleRequest: {
          type: "object",
          properties: {
            eventKey: { type: "string" },
            channel: { type: "string", enum: ["email", "in_app", "sms_future", "whatsapp_future"] },
            recipientRole: { type: "string", enum: ["admin", "teacher", "student", "support"] },
            emailTemplateId: { type: "string", format: "uuid", nullable: true },
            conditions: { type: "object" }
          }
        },
        UpdateNotificationRuleStatusRequest: {
          type: "object",
          required: ["isEnabled"],
          properties: {
            isEnabled: { type: "boolean" }
          }
        }
      }
    },
    paths: {
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Check API health",
          responses: {
            "200": { description: "Backend is healthy" }
          }
        }
      },
      "/api/app/details": {
        get: {
          tags: ["Health"],
          summary: "Get public frontend bootstrap configuration",
          responses: {
            "200": { description: "Application details fetched" }
          }
        }
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login with username, email, or phone",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Login successful" },
            "401": { description: "Invalid credentials" }
          }
        }
      },
      "/api/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Rotate refresh token and issue a new access token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshTokenRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Token refreshed" },
            "401": { description: "Invalid refresh token" }
          }
        }
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Revoke a refresh token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshTokenRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Logout successful" }
          }
        }
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get current authenticated user",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Current user fetched" },
            "401": { description: "Authentication required" }
          }
        }
      },
      "/api/roles": {
        get: {
          tags: ["Roles"],
          summary: "List roles",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Roles fetched" },
            "403": { description: "Requires role.view" }
          }
        }
      },
      "/api/permissions": {
        get: {
          tags: ["Permissions"],
          summary: "List permissions",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Permissions fetched" },
            "403": { description: "Requires permission.view" }
          }
        }
      },
      "/api/navigation/pages": {
        get: {
          tags: ["Navigation"],
          summary: "Get permission-filtered frontend pages and actions",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Navigation policy fetched" },
            "401": { description: "Authentication required" }
          }
        }
      },
      "/api/users": {
        get: {
          tags: ["Users"],
          summary: "List users",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "role", in: "query", schema: { type: "string" } },
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: ["active", "inactive", "suspended"] }
            }
          ],
          responses: {
            "200": { description: "Users fetched" },
            "403": { description: "Requires user.view" }
          }
        },
        post: {
          tags: ["Users"],
          summary: "Create user",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateUserRequest" }
              }
            }
          },
          responses: {
            "201": { description: "User created" },
            "403": { description: "Requires user.create" },
            "409": { description: "User already exists" }
          }
        }
      },
      "/api/users/{id}": {
        get: {
          tags: ["Users"],
          summary: "Get user by ID",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "User fetched" },
            "404": { description: "User not found" }
          }
        },
        patch: {
          tags: ["Users"],
          summary: "Update user",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateUserRequest" }
              }
            }
          },
          responses: {
            "200": { description: "User updated" },
            "403": { description: "Requires user.update" },
            "404": { description: "User not found" }
          }
        }
      },
      "/api/users/{id}/status": {
        patch: {
          tags: ["Users"],
          summary: "Update user status",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateUserStatusRequest" }
              }
            }
          },
          responses: {
            "200": { description: "User status updated" },
            "403": { description: "Requires user.deactivate" }
          }
        }
      },
      "/api/users/{id}/roles": {
        post: {
          tags: ["Users"],
          summary: "Replace user roles",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AssignUserRolesRequest" }
              }
            }
          },
          responses: {
            "200": { description: "User roles updated" },
            "403": { description: "Requires user.update" },
            "422": { description: "Invalid roles" }
          }
        }
      },
      "/api/teachers": {
        get: {
          tags: ["Teachers"],
          summary: "List teachers",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string", enum: ["active", "inactive", "suspended"] } }
          ],
          responses: {
            "200": { description: "Teachers fetched" },
            "403": { description: "Requires teacher.view" }
          }
        }
      },
      "/api/teachers/{id}": {
        get: {
          tags: ["Teachers"],
          summary: "Get teacher by ID",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Teacher fetched" },
            "404": { description: "Teacher not found" }
          }
        }
      },
      "/api/teachers/{id}/availability": {
        get: {
          tags: ["Teachers"],
          summary: "Get teacher availability and unavailable dates",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Teacher availability fetched" }
          }
        },
        post: {
          tags: ["Teachers"],
          summary: "Create teacher weekly availability",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateAvailabilityRequest" }
              }
            }
          },
          responses: {
            "201": { description: "Teacher availability created" },
            "403": { description: "Requires teacher.update" }
          }
        }
      },
      "/api/teachers/{id}/unavailable-dates": {
        post: {
          tags: ["Teachers"],
          summary: "Create teacher unavailable date",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateUnavailableDateRequest" }
              }
            }
          },
          responses: {
            "201": { description: "Teacher unavailable date created" },
            "403": { description: "Requires teacher.update" }
          }
        }
      },
      "/api/teachers/{id}/unavailable-dates/{dateId}": {
        delete: {
          tags: ["Teachers"],
          summary: "Delete teacher unavailable date",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "dateId", in: "path", required: true, schema: { type: "string", format: "uuid" } }
          ],
          responses: {
            "200": { description: "Teacher unavailable date deleted" },
            "404": { description: "Unavailable date not found" }
          }
        }
      },
      "/api/students": {
        get: {
          tags: ["Students"],
          summary: "List students",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string", enum: ["active", "inactive", "suspended"] } }
          ],
          responses: {
            "200": { description: "Students fetched" },
            "403": { description: "Requires student.view" }
          }
        }
      },
      "/api/homework/uploads": {
        post: {
          tags: ["Homework"],
          summary: "Upload an attachment for custom homework (private R2, homework/ prefix)",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } } },
          responses: { "201": { description: "Uploaded; returns storageKey, fileName, mimeType, sizeBytes" }, "503": { description: "R2 is not configured" } }
        }
      },
      "/api/homework/library": {
        get: {
          tags: ["Homework"],
          summary: "The signed-in teacher's saved homework library",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "Homework library fetched" } }
        }
      },
      "/api/homework/submission-uploads": {
        post: { tags: ["Homework"], summary: "Upload a submission file (student; private R2, homework-submissions/ prefix)", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } } }, responses: { "201": { description: "Uploaded; returns storageKey, fileName, mimeType, sizeBytes" } } }
      },
      "/api/homework": {
        get: {
          tags: ["Homework"],
          summary: "List homework (scoped: teacher own, student own, admin all) [homework.view]",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["all", "pending", "submitted", "needs_revision", "completed", "completed_this_week", "overdue"] } },
            { name: "search", in: "query", schema: { type: "string" } }
          ],
          responses: { "200": { description: "Homework fetched" } }
        }
      },
      "/api/homework/summary": {
        get: { tags: ["Homework"], summary: "Counts for the teacher dashboard cards / student tabs [homework.view]", security: [{ bearerAuth: [] }], responses: { "200": { description: "pending, submitted, needsRevision, completed, completedThisWeek, overdue, pendingReview, revisionRequired" } } }
      },
      "/api/homework/{id}": {
        get: { tags: ["Homework"], summary: "Homework detail with instructions, files and every attempt [homework.view]", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Homework fetched" }, "404": { description: "Not found or not yours" } } }
      },
      "/api/homework/{id}/submissions": {
        post: {
          tags: ["Homework"],
          summary: "Submit or resubmit (creates a NEW attempt; earlier attempts are never overwritten) [homework.submit]",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { text: { type: "string" }, link: { type: "string", format: "uri" }, comment: { type: "string" }, files: { type: "array", items: { type: "object", properties: { storageKey: { type: "string", description: "From /homework/submission-uploads" }, fileName: { type: "string" } } } } } } } } },
          responses: { "201": { description: "Submitted; status becomes submitted and the teacher is notified" }, "409": { description: "Not open for submission" }, "422": { description: "Does not match the homework submission type" } }
        }
      },
      "/api/homework/{id}/review": {
        post: {
          tags: ["Homework"],
          summary: "Review the latest attempt: Complete or Revision Required [homework.review]",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["result", "points"], properties: { result: { type: "string", enum: ["complete", "revision"] }, points: { type: "number", description: "0..maxPoints" }, feedback: { type: "string", description: "Required when result is revision." } } } } } },
          responses: { "200": { description: "Reviewed; student notified" }, "403": { description: "Not your student homework" }, "409": { description: "Nothing waiting for review" } }
        }
      },
      "/api/homework/{id}/document/file": { get: { tags: ["Homework"], summary: "Stream the curriculum homework document (access-checked)", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "File" } } } },
      "/api/homework/{id}/resources/{resourceId}/file": { get: { tags: ["Homework"], summary: "Stream a teacher attachment (access-checked)", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }, { name: "resourceId", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "File" } } } },
      "/api/homework/{id}/submissions/{submissionId}/files/{fileId}/file": { get: { tags: ["Homework"], summary: "Stream a submitted file (the student, their teacher or admin)", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }, { name: "submissionId", in: "path", required: true, schema: { type: "string", format: "uuid" } }, { name: "fileId", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "File" } } } },
      "/api/students/my": {
        get: {
          tags: ["Students"],
          summary: "My students (teacher-scoped)",
          description: "One row per student and module for the signed-in teacher: student name, course, module and that student's own current curriculum class. Students come from non-cancelled classes (or an active assignment), so a student appears as soon as a class is scheduled. Position is per student (curriculum_progress), never per teacher.",
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "My students fetched" } }
        }
      },
      "/api/students/my/{studentId}/curriculum": {
        get: {
          tags: ["Students"],
          summary: "One of my students' own curriculum progress (Open Curriculum)",
          description: "The module's classes with done / current / upcoming state for this student. Pass moduleId, or lessonId (module is derived from it, used when opening from a scheduled class). 404 if the student has no non-cancelled class with the signed-in teacher.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "studentId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "moduleId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "lessonId", in: "query", schema: { type: "string", format: "uuid" } }
          ],
          responses: { "200": { description: "Student curriculum fetched" }, "404": { description: "Student or curriculum not found for this teacher" } }
        }
      },
      "/api/students/{id}": {
        get: {
          tags: ["Students"],
          summary: "Get student by ID",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Student fetched" },
            "404": { description: "Student not found" }
          }
        }
      },
      "/api/teacher-student-assignments": {
        get: {
          tags: ["Teacher Student Assignments"],
          summary: "List teacher-student assignments",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "status", in: "query", schema: { type: "string", enum: ["active", "inactive"] } },
            { name: "teacherId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "studentId", in: "query", schema: { type: "string", format: "uuid" } }
          ],
          responses: {
            "200": { description: "Teacher-student assignments fetched" },
            "403": { description: "Requires teacher.view" }
          }
        },
        post: {
          tags: ["Teacher Student Assignments"],
          summary: "Create teacher-student assignment",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateAssignmentRequest" }
              }
            }
          },
          responses: {
            "201": { description: "Teacher-student assignment created" },
            "409": { description: "Active assignment already exists" },
            "422": { description: "Invalid teacher or student" }
          }
        }
      },
      "/api/teacher-student-assignments/{id}/status": {
        patch: {
          tags: ["Teacher Student Assignments"],
          summary: "Update teacher-student assignment status",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateAssignmentStatusRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Teacher-student assignment status updated" },
            "404": { description: "Assignment not found" }
          }
        }
      },
      "/api/classes/check-conflicts": {
        post: {
          tags: ["Classes"],
          summary: "Check scheduling conflicts",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CheckClassConflictsRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Conflict check completed" }
          }
        }
      },
      "/api/classes/series/check-conflicts": {
        post: {
          tags: ["Classes"],
          summary: "Validate all occurrences in a recurring class schedule",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateClassSeriesRequest" } } }
          },
          responses: { "200": { description: "Recurring schedule conflict check completed" } }
        }
      },
      "/api/classes/series/available-teachers": {
        post: {
          tags: ["Classes"],
          summary: "Step 3 of the scheduling wizard: teachers free for every occurrence of this proposed series",
          description: "A teacher only appears if they have zero teacher-side conflicts across the entire series. An empty `teachers` array blocks the wizard outright (no override).",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/AvailableTeachersForSeriesRequest" } } }
          },
          responses: { "200": { description: "Available teachers, occurrences, and any student-side conflicts" } }
        }
      },
      "/api/classes/series": {
        post: {
          tags: ["Classes"],
          summary: "Create a recurring class series and its individual class occurrences",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateClassSeriesRequest" } } }
          },
          responses: {
            "201": { description: "Class series scheduled" },
            "409": { description: "One or more occurrences conflict" }
          }
        }
      },
      "/api/classes": {
        get: {
          tags: ["Classes"],
          summary: "List classes",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "teacherId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "studentId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", schema: { type: "string", format: "date-time" } }
          ],
          responses: {
            "200": { description: "Classes fetched" }
          }
        },
        post: {
          tags: ["Classes"],
          summary: "Schedule class",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateClassRequest" }
              }
            }
          },
          responses: {
            "201": { description: "Class scheduled" },
            "409": { description: "Scheduling conflicts found" }
          }
        }
      },
      "/api/classes/{id}": {
        get: {
          tags: ["Classes"],
          summary: "Get class by ID",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Class fetched" },
            "404": { description: "Class not found" }
          }
        },
        patch: {
          tags: ["Classes"],
          summary: "Update class metadata",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateClassRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Class updated" }
          }
        }
      },
      "/api/classes/{id}/cancel": {
        post: {
          tags: ["Classes"],
          summary: "Cancel class directly",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CancelClassRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Class cancelled" }
          }
        }
      },
      "/api/classes/{id}/cancel-auto": {
        post: {
          tags: ["Classes"],
          summary: "Student self-service cancellation (fully automatic, no admin review)",
          description: ">=4 hours before start: cancels immediately, same as an admin direct cancel. <4 hours: blocked with a fixed message, no request row is created.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: false,
            content: { "application/json": { schema: { type: "object", properties: { reason: { type: "string" } } } } }
          },
          responses: {
            "200": { description: "Class cancelled" },
            "422": { description: "Cancellation window has closed (less than 4 hours before start)" }
          }
        }
      },
      "/api/classes/{id}/reschedule-slots": {
        post: {
          tags: ["Classes"],
          summary: "Candidate reschedule slots for one date, same teacher only",
          description: "Day-first, then that day's slots. Window is today through the end of the current calendar month.",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["date"], properties: { date: { type: "string", format: "date" } } } } }
          },
          responses: { "200": { description: "Candidate start times (may be empty - pick another day)" } }
        }
      },
      "/api/classes/{id}/reschedule-request": {
        post: {
          tags: ["Classes"],
          summary: "Student self-service reschedule to a chosen slot",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["startTime"], properties: { startTime: { type: "string", format: "date-time" } } } } }
          },
          responses: {
            "200": { description: "Class rescheduled" },
            "409": { description: "Scheduling conflicts found" },
            "422": { description: "Outside the reschedule window" }
          }
        }
      },
      "/api/classes/{id}/cancel-requests": {
        get: {
          tags: ["Class Cancellation Requests"],
          summary: "List cancellation requests for a class",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected", "withdrawn"] } }
          ],
          responses: {
            "200": { description: "Class cancellation requests fetched" }
          }
        },
        post: {
          tags: ["Class Cancellation Requests"],
          summary: "Request class cancellation with reason",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateCancellationRequest" }
              }
            }
          },
          responses: {
            "201": { description: "Class cancellation request created" },
            "409": { description: "Pending request already exists" }
          }
        }
      },
      "/api/classes/{id}/attendance": {
        get: {
          tags: ["Attendance"],
          summary: "List attendance records for a class",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Class attendance fetched" }
          }
        }
      },
      "/api/classes/{id}/reschedule": {
        post: {
          tags: ["Classes"],
          summary: "Reschedule class",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RescheduleClassRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Class rescheduled" },
            "409": { description: "Scheduling conflicts found" }
          }
        }
      },
      "/api/classes/{id}/join": {
        post: {
          tags: ["Classes"],
          summary: "Get Daily-ready class join payload",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Class join payload fetched" }
          }
        }
      },
      "/api/classes/{id}/daily/join": {
        post: {
          tags: ["Daily"],
          summary: "Create a Daily room token for a class",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DailyJoinRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Daily join payload created" },
            "503": { description: "Daily is not configured" }
          }
        }
      },
      "/api/classes/{id}/daily/leave": {
        post: {
          tags: ["Daily"],
          summary: "Release a Daily classroom session for this user",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DailyJoinRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Classroom session released" }
          }
        }
      },
      "/api/classes/{id}/ics": {
        get: {
          tags: ["Classes"],
          summary: "Download class ICS",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "ICS calendar file" }
          }
        }
      },
      "/api/class-cancellation-requests": {
        get: {
          tags: ["Class Cancellation Requests"],
          summary: "List cancellation requests",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected", "withdrawn"] } },
            { name: "classId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "requestedByUserId", in: "query", schema: { type: "string", format: "uuid" } }
          ],
          responses: {
            "200": { description: "Class cancellation requests fetched" }
          }
        }
      },
      "/api/class-cancellation-requests/{id}/status": {
        patch: {
          tags: ["Class Cancellation Requests"],
          summary: "Review or withdraw a cancellation request",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReviewCancellationRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Class cancellation request status updated" },
            "409": { description: "Request is not pending" }
          }
        }
      },
      "/api/attendance": {
        get: {
          tags: ["Attendance"],
          summary: "List attendance records",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "classId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "teacherId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "studentId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "status", in: "query", schema: { type: "string", enum: ["pending", "present", "absent", "late", "excused"] } },
            { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", schema: { type: "string", format: "date-time" } }
          ],
          responses: {
            "200": { description: "Attendance fetched" }
          }
        }
      },
      "/api/attendance/mark": {
        post: {
          tags: ["Attendance"],
          summary: "Mark class attendance",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MarkAttendanceRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Attendance marked" },
            "404": { description: "Class participant not found" }
          }
        }
      },
      "/api/attendance/{id}": {
        patch: {
          tags: ["Attendance"],
          summary: "Update attendance record",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateAttendanceRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Attendance updated" },
            "404": { description: "Attendance record not found" }
          }
        }
      },
      "/api/daily/rooms": {
        post: {
          tags: ["Daily"],
          summary: "Create or recreate Daily room for a class",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateDailyRoomRequest" }
              }
            }
          },
          responses: {
            "201": { description: "Daily room created" },
            "502": { description: "Daily API error" }
          }
        }
      },
      "/api/daily/rooms/{id}": {
        get: {
          tags: ["Daily"],
          summary: "Get Daily room metadata by row ID or class ID",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Daily room fetched" },
            "404": { description: "Daily room not found" }
          }
        }
      },
      "/api/daily/webhook": {
        post: {
          tags: ["Daily"],
          summary: "Receive Daily webhooks",
          responses: {
            "200": { description: "Webhook received" },
            "400": { description: "Invalid webhook payload" }
          }
        }
      },
      "/api/email-templates": {
        get: {
          tags: ["Email Templates"],
          summary: "List email templates",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "isActive", in: "query", schema: { type: "boolean" } }
          ],
          responses: {
            "200": { description: "Email templates fetched" }
          }
        },
        post: {
          tags: ["Email Templates"],
          summary: "Create email template",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateEmailTemplateRequest" }
              }
            }
          },
          responses: {
            "201": { description: "Email template created" },
            "409": { description: "Template key already exists" }
          }
        }
      },
      "/api/email-templates/{id}": {
        get: {
          tags: ["Email Templates"],
          summary: "Get email template",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Email template fetched" },
            "404": { description: "Email template not found" }
          }
        },
        patch: {
          tags: ["Email Templates"],
          summary: "Update email template",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateEmailTemplateRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Email template updated" }
          }
        }
      },
      "/api/email-templates/{id}/status": {
        patch: {
          tags: ["Email Templates"],
          summary: "Enable or disable email template",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateEmailTemplateStatusRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Email template status updated" }
          }
        }
      },
      "/api/notifications": {
        get: {
          tags: ["Notifications"],
          summary: "Get current user's top notifications and unread count",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 5, maximum: 20 } }
          ],
          responses: {
            "200": { description: "Notifications fetched" }
          }
        }
      },
      "/api/notifications/mark-read": {
        post: {
          tags: ["Notifications"],
          summary: "Mark all current user's notifications as read",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": { description: "Notifications marked as read" }
          }
        }
      },
      "/api/notification-rules": {
        get: {
          tags: ["Notification Manager"],
          summary: "List notification rules",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "eventKey", in: "query", schema: { type: "string" } },
            { name: "channel", in: "query", schema: { type: "string" } },
            { name: "recipientRole", in: "query", schema: { type: "string" } },
            { name: "isEnabled", in: "query", schema: { type: "boolean" } }
          ],
          responses: {
            "200": { description: "Notification rules fetched" }
          }
        },
        post: {
          tags: ["Notification Manager"],
          summary: "Create notification rule",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateNotificationRuleRequest" }
              }
            }
          },
          responses: {
            "201": { description: "Notification rule created" },
            "409": { description: "Rule already exists" }
          }
        }
      },
      "/api/notification-rules/{id}": {
        patch: {
          tags: ["Notification Manager"],
          summary: "Update notification rule",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateNotificationRuleRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Notification rule updated" }
          }
        }
      },
      "/api/notification-rules/{id}/status": {
        patch: {
          tags: ["Notification Manager"],
          summary: "Enable or disable notification rule",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateNotificationRuleStatusRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Notification rule status updated" }
          }
        }
      },
      "/api/notification-delivery-logs": {
        get: {
          tags: ["Notification Manager"],
          summary: "List notification delivery logs",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "eventKey", in: "query", schema: { type: "string" } },
            { name: "channel", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "recipientUserId", in: "query", schema: { type: "string", format: "uuid" } }
          ],
          responses: {
            "200": { description: "Notification delivery logs fetched" }
          }
        }
      },
      "/api/learning-materials/courses": {
        get: {
          tags: ["Learning Materials"], summary: "List curriculum courses", security: [{ bearerAuth: [] }],
          parameters: [{ name: "search", in: "query", schema: { type: "string" } }, { name: "status", in: "query", schema: { type: "string", enum: ["all", "active", "inactive"] } }],
          responses: { "200": { description: "Courses fetched" } }
        },
        post: {
          tags: ["Learning Materials"], summary: "Create curriculum course", security: [{ bearerAuth: [] }],
          responses: { "201": { description: "Course created" } }
        }
      },
      "/api/learning-materials/courses/{id}": {
        get: { tags: ["Learning Materials"], summary: "Get course with modules", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Course fetched" } } },
        patch: { tags: ["Learning Materials"], summary: "Update course or its active status", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Course updated" } } }
      },
      "/api/learning-materials/modules": {
        get: { tags: ["Learning Materials"], summary: "List curriculum modules", security: [{ bearerAuth: [] }], responses: { "200": { description: "Modules fetched" } } },
        post: { tags: ["Learning Materials"], summary: "Create curriculum module", security: [{ bearerAuth: [] }], responses: { "201": { description: "Module created" } } }
      },
      "/api/learning-materials/modules/{id}": {
        get: { tags: ["Learning Materials"], summary: "Get module with teachers and classes", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Module fetched" } } },
        patch: { tags: ["Learning Materials"], summary: "Update module or its active status", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Module updated" } } }
      },
      "/api/learning-materials/modules/{id}/teachers": {
        put: { tags: ["Learning Materials"], summary: "Replace active teachers assigned to a module", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Teacher access updated" } } }
      },
      "/api/learning-materials/my/modules": {
        get: { tags: ["Learning Materials"], summary: "List modules assigned to the signed-in teacher", security: [{ bearerAuth: [] }], responses: { "200": { description: "Assigned modules fetched" } } }
      },
      "/api/learning-materials/my/classes": {
        get: { tags: ["Learning Materials"], summary: "List curriculum classes in modules assigned to the signed-in teacher", security: [{ bearerAuth: [] }], responses: { "200": { description: "Assigned curriculum classes fetched" } } }
      },
      "/api/learning-materials/my/modules/{id}": {
        get: { tags: ["Learning Materials"], summary: "View one module assigned to the signed-in teacher", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Assigned module fetched" } } }
      },
      "/api/learning-materials/my/classes/{id}": {
        get: { tags: ["Learning Materials"], summary: "View one curriculum class assigned to the signed-in teacher", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Assigned curriculum class fetched" } } }
      },
      "/api/learning-materials/my/materials/{id}/download": {
        get: { tags: ["Learning Materials"], summary: "Open a private file in a curriculum class assigned to the signed-in teacher", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Private learning material stream" } } }
      },
      "/api/learning-materials/lessons": {
        get: { tags: ["Learning Materials"], summary: "List curriculum classes", security: [{ bearerAuth: [] }], responses: { "200": { description: "Curriculum classes fetched" } } },
        post: { tags: ["Learning Materials"], summary: "Create curriculum class", security: [{ bearerAuth: [] }], responses: { "201": { description: "Curriculum class created" } } }
      },
      "/api/learning-materials/lessons/{id}": {
        get: { tags: ["Learning Materials"], summary: "Get curriculum class and material versions", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Curriculum class fetched" } } },
        patch: { tags: ["Learning Materials"], summary: "Update curriculum class", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "Curriculum class updated" } } }
      },
      "/api/learning-materials/uploads": {
        post: {
          tags: ["Learning Materials"], summary: "Upload a private curriculum file to Cloudflare R2", security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } } },
          responses: { "201": { description: "File uploaded" }, "413": { description: "File exceeds upload limit" } }
        }
      },
      "/api/learning-materials/materials": {
        post: { tags: ["Learning Materials"], summary: "Add a link or an uploaded-file record to a curriculum class", security: [{ bearerAuth: [] }], responses: { "201": { description: "Learning material created" } } }
      },
      "/api/learning-materials/materials/{id}/revisions": {
        post: { tags: ["Learning Materials"], summary: "Create an immutable new revision for a learning material", security: [{ bearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: { "201": { description: "Learning material revision created" } } }
      },
      "/api/calendar/classes": {
        get: {
          tags: ["Calendar"],
          summary: "List calendar-ready classes",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "teacherId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "studentId", in: "query", schema: { type: "string", format: "uuid" } }
          ],
          responses: {
            "200": { description: "Classes fetched" }
          }
        }
      }
    }
  },
  apis: []
});
