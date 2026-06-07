import swaggerJSDoc from "swagger-jsdoc";

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
        url: "http://localhost:5000",
        description: "Local development"
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
      { name: "Zoom" },
      { name: "Email Templates" },
      { name: "Notification Manager" }
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
            totalZoomMinutes: { type: "integer", nullable: true, example: 57 }
          }
        },
        UpdateAttendanceRequest: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["present", "absent", "late", "excused"] },
            teacherNotes: { type: "string", nullable: true },
            zoomJoinTime: { type: "string", format: "date-time", nullable: true },
            zoomLeaveTime: { type: "string", format: "date-time", nullable: true },
            totalZoomMinutes: { type: "integer", nullable: true }
          }
        },
        CreateZoomMeetingRequest: {
          type: "object",
          required: ["classId"],
          properties: {
            classId: { type: "string", format: "uuid" }
          }
        },
        ZoomSignatureRequest: {
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
          summary: "Get Zoom-ready class join placeholder",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Class join payload fetched" }
          }
        }
      },
      "/api/classes/{id}/zoom/signature": {
        post: {
          tags: ["Zoom"],
          summary: "Create Zoom Meeting SDK signature for a class",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ZoomSignatureRequest" }
              }
            }
          },
          responses: {
            "200": { description: "Zoom Meeting SDK signature created" },
            "503": { description: "Zoom Meeting SDK is not configured" }
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
      "/api/zoom/meetings": {
        post: {
          tags: ["Zoom"],
          summary: "Create or recreate Zoom meeting for a class",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateZoomMeetingRequest" }
              }
            }
          },
          responses: {
            "201": { description: "Zoom meeting created" },
            "502": { description: "Zoom API error" }
          }
        }
      },
      "/api/zoom/meetings/{id}": {
        get: {
          tags: ["Zoom"],
          summary: "Get Zoom meeting metadata by Zoom row ID or class ID",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Zoom meeting fetched" },
            "404": { description: "Zoom meeting not found" }
          }
        }
      },
      "/api/zoom/webhook": {
        post: {
          tags: ["Zoom"],
          summary: "Receive Zoom webhooks",
          responses: {
            "200": { description: "Webhook received" },
            "401": { description: "Invalid Zoom webhook signature" }
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
