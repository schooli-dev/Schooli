# SchooliEdu Backend Checklist

## Current Access

- Swagger UI: `http://localhost:5000/api/docs`
- OpenAPI JSON: `http://localhost:5000/api/docs.json`
- Health check: `http://localhost:5000/api/health`
- API guide PDF: `backend/docs/SchooliEdu_API_Guide.pdf`
- API guide source: `backend/docs/SchooliEdu_API_Guide.md`
- Default admin username: `admin`
- Default admin password: `Schooli@2025`

## Completed

- [x] Backend project setup with Node.js, Express, and TypeScript
- [x] Environment config loader with Zod
- [x] PostgreSQL pool connection using `pg`
- [x] Health endpoint
- [x] Public app details endpoint for frontend runtime configuration
- [x] Central error middleware
- [x] Validation middleware
- [x] Async handler utility
- [x] API response helper
- [x] Manual SQL migration runner
- [x] Auth/RBAC schema migration
- [x] Roles and permissions seed migration
- [x] Teacher/student availability schema migration
- [x] Classes, Zoom placeholder, and attendance schema migration
- [x] Homework schema migration
- [x] Credits ledger schema migration
- [x] Tickets schema migration
- [x] Certificates, reports, settings, and audit schema migration
- [x] Username support migration
- [x] Default admin seed script
- [x] Password hashing utility
- [x] JWT access and refresh token utilities
- [x] Auth middleware
- [x] Permission middleware
- [x] `POST /api/auth/login`
- [x] `POST /api/auth/refresh`
- [x] `POST /api/auth/logout`
- [x] `GET /api/auth/me`
- [x] `GET /api/admin/dashboard`
- [x] `GET /api/roles`
- [x] `POST /api/roles`
- [x] `PATCH /api/roles/:id`
- [x] `GET /api/permissions`
- [x] `GET /api/navigation/pages`
- [x] Role-scoped navigation policy for admin, teacher, and student portals
- [x] `GET /api/users`
- [x] `/api/users` date range filters for user management
- [x] Backend blocks creating or assigning admin role through user management
- [x] Backend blocks self profile, role, and status changes through user management
- [x] Backend validates strong password and mandatory ISD phone for user creation
- [x] Backend validates user names and role names against unsafe characters
- [x] Backend requires permissions when creating or updating roles
- [x] `POST /api/users`
- [x] `GET /api/users/:id`
- [x] `PATCH /api/users/:id`
- [x] `PATCH /api/users/:id/status`
- [x] `POST /api/users/:id/roles`
- [x] Swagger UI setup
- [x] OpenAPI documentation for current APIs
- [x] `GET /api/teachers`
- [x] `GET /api/teachers/:id`
- [x] `GET /api/teachers/:id/availability`
- [x] `POST /api/teachers/:id/availability`
- [x] `POST /api/teachers/:id/unavailable-dates`
- [x] `DELETE /api/teachers/:id/unavailable-dates/:dateId`
- [x] `GET /api/students`
- [x] `GET /api/students/:id`
- [x] `GET /api/teacher-student-assignments`
- [x] `POST /api/teacher-student-assignments`
- [x] `PATCH /api/teacher-student-assignments/:id/status`
- [x] Schema planned for student class cancellation requests
- [x] Schema planned for admin-managed email templates
- [x] Schema planned for notification manager rules
- [x] Schema planned for notification delivery logs
- [x] Applied cancellation/notification migration
- [x] `POST /api/classes/check-conflicts`
- [x] `GET /api/classes`
- [x] `POST /api/classes`
- [x] `GET /api/classes/:id`
- [x] `PATCH /api/classes/:id`
- [x] `POST /api/classes/:id/cancel`
- [x] `POST /api/classes/:id/reschedule`
- [x] `POST /api/classes/:id/join`
- [x] `GET /api/calendar/classes`
- [x] `GET /api/classes/:id/ics`
- [x] `GET /api/class-cancellation-requests`
- [x] `POST /api/classes/:id/cancel-requests`
- [x] `GET /api/classes/:id/cancel-requests`
- [x] `PATCH /api/class-cancellation-requests/:id/status`
- [x] Zoom Server-to-Server OAuth config support
- [x] Real Zoom meeting creation service
- [x] Auto-create Zoom meeting during class scheduling when configured
- [x] `POST /api/zoom/meetings`
- [x] `GET /api/zoom/meetings/:id`
- [x] `POST /api/zoom/webhook`
- [x] `POST /api/classes/:id/zoom/signature`
- [x] Store Zoom join/leave webhook evidence
- [x] `GET /api/email-templates`
- [x] `POST /api/email-templates`
- [x] `GET /api/email-templates/:id`
- [x] `PATCH /api/email-templates/:id`
- [x] `PATCH /api/email-templates/:id/status`
- [x] `GET /api/notification-rules`
- [x] `POST /api/notification-rules`
- [x] `PATCH /api/notification-rules/:id`
- [x] `PATCH /api/notification-rules/:id/status`
- [x] `GET /api/notification-delivery-logs`
- [x] `GET /api/attendance`
- [x] `GET /api/classes/:id/attendance`
- [x] `POST /api/attendance/mark`
- [x] `PATCH /api/attendance/:id`
- [x] Complete backend API guide PDF generated

## In Progress

- [ ] Keep Swagger documentation updated as each API module is added
- [ ] Add Zoom Meeting SDK key/secret for embedded meeting join

## To Do Next

- [ ] Homework APIs
- [ ] Credits ledger APIs
- [ ] Support ticket APIs
- [ ] Certificates APIs
- [ ] Reports APIs
- [ ] Settings APIs
- [ ] Audit log APIs
- [ ] Broader automated tests
- [ ] Angular frontend integration after backend foundation is ready

## Phase 1 Boundaries

- [x] Parent role excluded from Phase 1 implementation
- [x] Payments excluded from Phase 1 implementation
- [x] Real Zoom SDK/frontend integration deferred
- [x] Real Cloudinary upload deferred
