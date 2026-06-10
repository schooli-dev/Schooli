# SchooliEdu Backend API Guide

Version: 0.2
Generated: 2026-06-06 10:29

## Usage Conventions

- Base URL: `http://localhost:5000`
- Swagger UI: `GET /api/docs`
- OpenAPI JSON: `GET /api/docs.json`
- Protected endpoints use `Authorization: Bearer <accessToken>`.
- Responses use `{ success, message, data, pagination? }` for success and `{ success:false, message, error }` for failures.

## Permission Matrix
- **Admin:** Full seeded permission set; can create users, schedule/cancel/reschedule classes, override conflicts, mark/override attendance, manage settings.
- **Teacher:** View assigned students/classes, join class, mark attendance, create/review homework later, view reports.
- **Student:** View own classes, join class, view own attendance, submit homework later, create tickets, view certificates/reports.
- **Support:** Operational view of users/classes/attendance/credits/tickets/reports; can resolve tickets and assist rescheduling.

## Table Impact Map

- **Identity and RBAC:** users, roles, permissions, user_roles, role_permissions, refresh_tokens, password_reset_tokens, otp_tokens
- **People and scheduling prerequisites:** teacher_student_assignments, teacher_availability, teacher_unavailable_dates
- **Class execution:** classes, class_participants, class_attendance
- **Zoom evidence:** zoom_meetings, zoom_attendance_events
- **Cancellation workflow:** class_cancellation_requests
- **Notification configuration:** email_templates, notification_rules, notification_delivery_logs
- **Planned API schemas:** homework, homework_resources, homework_submissions, homework_submission_files, credits_ledger, tickets, ticket_messages, ticket_attachments, ticket_status_history, certificates, reports, system_settings, audit_logs

## Platform Entry Points

Use these endpoints to confirm the service is available and to access the interactive API explorer.

### GET `/api/health`

- Purpose: Backend liveness check.
- Auth/permission: Public
- Response: Returns service name, environment, and timestamp.
- Table impact: No table impact.

Request:

```json
No payload.
```

### GET `/api/docs`

- Purpose: Swagger UI for manual testing.
- Auth/permission: Public
- Response: HTML Swagger UI.
- Table impact: No table impact.
- Notes: Use Authorize with a bearer token after login.

Request:

```json
No payload.
```

### GET `/api/docs.json`

- Purpose: Raw OpenAPI specification.
- Auth/permission: Public
- Response: OpenAPI JSON.
- Table impact: No table impact.

Request:

```json
No payload.
```


## Authentication

Authenticate users and manage access/refresh token lifecycle.

### POST `/api/auth/login`

- Purpose: Login with username/email and password.
- Auth/permission: Public
- Response: Returns accessToken, refreshToken, and user profile.
- Table impact: Reads users, roles, permissions. Inserts refresh_tokens.
- Notes: Use identifier as either username or email.

Request:

```json
{"identifier":"admin","password":"Schooli@2025"}
```

### POST `/api/auth/refresh`

- Purpose: Issue a fresh access token from a refresh token.
- Auth/permission: Public
- Response: Returns a new access token payload.
- Table impact: Reads refresh_tokens and users.

Request:

```json
{"refreshToken":"<refresh token>"}
```

### POST `/api/auth/logout`

- Purpose: Revoke a refresh token.
- Auth/permission: Public
- Response: Returns logout confirmation.
- Table impact: Updates refresh_tokens.

Request:

```json
{"refreshToken":"<refresh token>"}
```

### GET `/api/auth/me`

- Purpose: Fetch current authenticated user context.
- Auth/permission: Bearer token
- Response: Returns profile, roles, and permissions.
- Table impact: Reads users, roles, permissions.

Request:

```json
No payload.
```


## RBAC

Inspect roles and permissions used by route guards.

### GET `/api/roles`

- Purpose: List all platform roles.
- Auth/permission: role.view
- Response: Returns roles.
- Table impact: Reads roles.

Request:

```json
No payload.
```

### GET `/api/permissions`

- Purpose: List all permission keys.
- Auth/permission: permission.view
- Response: Returns permissions.
- Table impact: Reads permissions.

Request:

```json
No payload.
```


## User Administration

Create and manage base accounts for admins, teachers, students, and support users.

### GET `/api/users`

- Purpose: List users with filters.
- Auth/permission: user.view
- Response: Paginated user list.
- Table impact: Reads users, user_roles, roles.

Request:

```json
Query: page, limit, search, role, status.
```

### POST `/api/users`

- Purpose: Create user and optional roles.
- Auth/permission: user.create
- Response: Created user profile.
- Table impact: Inserts users and user_roles.
- Notes: Passwords are hashed before storage.

Request:

```json
{"firstName":"Demo","lastName":"Teacher","username":"demo_teacher","email":"demo.teacher@schooliedu.local","phone":"+919999999999","password":"Schooli@2025","roles":["teacher"]}
```

### GET `/api/users/{id}`

- Purpose: Get a user by ID.
- Auth/permission: user.view
- Response: User profile.
- Table impact: Reads users, user_roles, roles.

Request:

```json
Path: id UUID.
```

### PATCH `/api/users/{id}`

- Purpose: Update profile fields.
- Auth/permission: user.update
- Response: Updated user profile.
- Table impact: Updates users.

Request:

```json
{"firstName":"Demo","lastName":"Teacher","phone":"+919999999999","avatarUrl":null}
```

### PATCH `/api/users/{id}/status`

- Purpose: Activate, deactivate, or suspend a user.
- Auth/permission: user.deactivate
- Response: Updated user profile.
- Table impact: Updates users.status and users.is_active.

Request:

```json
{"status":"active","isActive":true}
```

### POST `/api/users/{id}/roles`

- Purpose: Replace assigned roles.
- Auth/permission: user.update
- Response: Updated user roles.
- Table impact: Deletes/inserts user_roles.

Request:

```json
{"roles":["teacher"]}
```


## People, Availability, And Assignments

Manage teacher/student profile views, weekly teacher availability, blocked dates, and teacher-student assignment prerequisites for scheduling.

### GET `/api/teachers`

- Purpose: List teacher users.
- Auth/permission: teacher.view
- Response: Paginated teachers.
- Table impact: Reads users and roles.

Request:

```json
Query: page, limit, search, status.
```

### GET `/api/teachers/{id}`

- Purpose: Get teacher profile.
- Auth/permission: teacher.view
- Response: Teacher profile.
- Table impact: Reads users and roles.

Request:

```json
Path: id UUID.
```

### GET `/api/students`

- Purpose: List student users.
- Auth/permission: student.view
- Response: Paginated students.
- Table impact: Reads users and roles.

Request:

```json
Query: page, limit, search, status.
```

### GET `/api/students/{id}`

- Purpose: Get student profile.
- Auth/permission: student.view
- Response: Student profile.
- Table impact: Reads users and roles.

Request:

```json
Path: id UUID.
```

### GET `/api/teacher-student-assignments`

- Purpose: List teacher-student links.
- Auth/permission: teacher.view/student.view scope
- Response: Paginated assignments.
- Table impact: Reads teacher_student_assignments and users.

Request:

```json
Query: page, limit, teacherId, studentId, status.
```

### POST `/api/teacher-student-assignments`

- Purpose: Create an active teacher-student link.
- Auth/permission: assignment create permission
- Response: Created assignment.
- Table impact: Inserts teacher_student_assignments.
- Notes: Class scheduling requires this active link.

Request:

```json
{"teacherId":"<teacher uuid>","studentId":"<student uuid>","notes":"Initial assignment"}
```

### PATCH `/api/teacher-student-assignments/{id}/status`

- Purpose: Activate/deactivate a link.
- Auth/permission: assignment update permission
- Response: Updated assignment.
- Table impact: Updates teacher_student_assignments.

Request:

```json
{"status":"active"}
```

### GET `/api/teachers/{id}/availability`

- Purpose: List weekly slots and blocked dates.
- Auth/permission: teacher.view
- Response: Availability bundle.
- Table impact: Reads teacher_availability and teacher_unavailable_dates.

Request:

```json
Path: id UUID.
```

### POST `/api/teachers/{id}/availability`

- Purpose: Create/update a weekly availability slot.
- Auth/permission: teacher.update
- Response: Availability record.
- Table impact: Inserts/updates teacher_availability.

Request:

```json
{"dayOfWeek":"monday","startTime":"16:00","endTime":"20:00","timezone":"Asia/Kolkata","isActive":true}
```

### POST `/api/teachers/{id}/unavailable-dates`

- Purpose: Block a date/time window.
- Auth/permission: teacher.update
- Response: Blocked-date record.
- Table impact: Inserts teacher_unavailable_dates.

Request:

```json
{"unavailableDate":"2026-06-10","startTime":"16:00","endTime":"18:00","reason":"Personal leave"}
```

### DELETE `/api/teachers/{id}/unavailable-dates/{dateId}`

- Purpose: Remove a blocked date.
- Auth/permission: teacher.update
- Response: Delete confirmation.
- Table impact: Deletes teacher_unavailable_dates.

Request:

```json
Path: id UUID, dateId UUID.
```


## Class Scheduling And Cancellation

Schedule teacher-student classes, create Zoom metadata, expose calendar data, and manage cancellation requests.

### POST `/api/classes/check-conflicts`

- Purpose: Validate a proposed class time before creation.
- Auth/permission: class.create
- Response: hasConflicts plus conflict list.
- Table impact: Reads assignments, availability, blocked dates, classes, class_participants.

Request:

```json
{"teacherId":"<teacher uuid>","studentId":"<student uuid>","startTime":"2026-06-10T10:00:00.000Z","durationMinutes":60,"timezone":"Asia/Kolkata"}
```

### GET `/api/classes`

- Purpose: List classes scoped to current user.
- Auth/permission: class.view
- Response: Paginated class list.
- Table impact: Reads classes, class_participants, users, zoom_meetings.

Request:

```json
Query: page, limit, status, teacherId, studentId, from, to.
```

### POST `/api/classes`

- Purpose: Schedule a class for one teacher and one student.
- Auth/permission: class.create
- Response: Created class with participant and Zoom metadata.
- Table impact: Inserts classes, class_participants, class_attendance, zoom_meetings.
- Notes: Auto-creates Zoom when Zoom config is present.

Request:

```json
{"teacherId":"<teacher uuid>","studentId":"<student uuid>","title":"Math class","startTime":"2026-06-10T10:00:00.000Z","durationMinutes":60,"timezone":"Asia/Kolkata","notes":"Optional note","overrideConflicts":false}
```

### GET `/api/classes/{id}`

- Purpose: Get class details.
- Auth/permission: class.view
- Response: Class detail.
- Table impact: Reads classes, participants, users, zoom_meetings.

Request:

```json
Path: id UUID.
```

### PATCH `/api/classes/{id}`

- Purpose: Update title/notes.
- Auth/permission: class.update
- Response: Updated class.
- Table impact: Updates classes.

Request:

```json
{"title":"Updated title","notes":"Updated note"}
```

### POST `/api/classes/{id}/cancel`

- Purpose: Directly cancel a class.
- Auth/permission: class.cancel
- Response: Cancelled class.
- Table impact: Updates classes.status, cancelled_at, cancellation_reason.

Request:

```json
{"reason":"Operational cancellation reason"}
```

### POST `/api/classes/{id}/reschedule`

- Purpose: Move class to a new time after conflict checks.
- Auth/permission: class.reschedule
- Response: Rescheduled class.
- Table impact: Updates classes start/end/duration/timezone/status.

Request:

```json
{"startTime":"2026-06-11T10:00:00.000Z","durationMinutes":60,"timezone":"Asia/Kolkata","overrideConflicts":false}
```

### POST `/api/classes/{id}/join`

- Purpose: Return Zoom join/start payload.
- Auth/permission: class.join
- Response: Meeting provider payload.
- Table impact: Reads classes and zoom_meetings.
- Notes: Teacher/admin can receive startUrl; student receives joinUrl.

Request:

```json
Path: id UUID.
```

### GET `/api/calendar/classes`

- Purpose: Calendar-oriented class list.
- Auth/permission: class.view
- Response: Class list.
- Table impact: Reads same tables as /api/classes.

Request:

```json
Query: from, to, teacherId, studentId.
```

### GET `/api/classes/{id}/ics`

- Purpose: Download ICS event file.
- Auth/permission: class.view
- Response: text/calendar response.
- Table impact: Reads classes.

Request:

```json
Path: id UUID.
```

### GET `/api/classes/{id}/cancel-requests`

- Purpose: List cancellation requests for one class.
- Auth/permission: class.view
- Response: Paginated requests.
- Table impact: Reads class_cancellation_requests, classes, users.

Request:

```json
Path id. Query: page, limit, status.
```

### POST `/api/classes/{id}/cancel-requests`

- Purpose: Student/teacher cancellation request with reason.
- Auth/permission: class.view
- Response: Created request.
- Table impact: Inserts class_cancellation_requests.

Request:

```json
{"reason":"Student has an exam at the same time"}
```

### GET `/api/class-cancellation-requests`

- Purpose: Admin/support cancellation queue.
- Auth/permission: class.view
- Response: Paginated requests.
- Table impact: Reads class_cancellation_requests, classes, users.

Request:

```json
Query: page, limit, status, classId, requestedByUserId.
```

### PATCH `/api/class-cancellation-requests/{id}/status`

- Purpose: Approve, reject, or withdraw request.
- Auth/permission: class.cancel for approve/reject
- Response: Updated request.
- Table impact: Updates class_cancellation_requests. If approved, updates classes to cancelled.

Request:

```json
{"status":"approved","adminNote":"Approved by admin"}
```


## Attendance

Mark official attendance while preserving Zoom join/leave evidence.

### GET `/api/attendance`

- Purpose: List attendance records.
- Auth/permission: attendance.view
- Response: Paginated attendance records with Zoom evidence summary.
- Table impact: Reads class_attendance, classes, users, zoom_attendance_events.

Request:

```json
Query: page, limit, classId, teacherId, studentId, status, from, to.
```

### GET `/api/classes/{id}/attendance`

- Purpose: List attendance for one class.
- Auth/permission: attendance.view
- Response: Attendance records.
- Table impact: Reads class_attendance, classes, users, zoom_attendance_events.

Request:

```json
Path: id UUID.
```

### POST `/api/attendance/mark`

- Purpose: Mark attendance.
- Auth/permission: attendance.mark
- Response: Marked attendance record.
- Table impact: Upserts class_attendance and updates class_participants.attendance_status.

Request:

```json
{"classId":"<class uuid>","studentId":"<student uuid>","status":"present","teacherNotes":"Joined on time","zoomJoinTime":"2026-06-10T10:00:00.000Z","zoomLeaveTime":"2026-06-10T10:57:00.000Z","totalZoomMinutes":57}
```

### PATCH `/api/attendance/{id}`

- Purpose: Update attendance.
- Auth/permission: attendance.mark; override users use attendance.override
- Response: Updated attendance record.
- Table impact: Updates class_attendance and class_participants.

Request:

```json
{"status":"late","teacherNotes":"Joined late","totalZoomMinutes":42}
```


## Zoom

Create and inspect Zoom meetings, handle Zoom webhooks, and prepare embedded meeting signatures.

### POST `/api/zoom/meetings`

- Purpose: Create or recreate Zoom meeting for class.
- Auth/permission: class.create/Zoom route guard
- Response: Zoom meeting metadata.
- Table impact: Reads classes. Inserts/updates zoom_meetings.
- Notes: Requires Zoom Server-to-Server OAuth env vars.

Request:

```json
{"classId":"<class uuid>"}
```

### GET `/api/zoom/meetings/{id}`

- Purpose: Get local Zoom metadata.
- Auth/permission: class.view
- Response: Zoom meeting record.
- Table impact: Reads zoom_meetings and classes.

Request:

```json
Path: id UUID.
```

### POST `/api/zoom/webhook`

- Purpose: Receive Zoom url_validation and join/leave events.
- Auth/permission: Zoom signature verification
- Response: Webhook acknowledgement.
- Table impact: Inserts zoom_attendance_events; may update zoom_meetings.

Request:

```json
Zoom webhook payload.
```

### POST `/api/classes/{id}/zoom/signature`

- Purpose: Generate Meeting SDK signature.
- Auth/permission: class.join
- Response: Meeting SDK signature payload.
- Table impact: Reads classes and zoom_meetings.
- Notes: Requires ZOOM_MEETING_SDK_KEY and ZOOM_MEETING_SDK_SECRET.

Request:

```json
{"role":0}
```


## Email Templates And Notification Manager

Configure reusable HTML mail templates and rules for when notifications should be sent.

### GET `/api/email-templates`

- Purpose: List email templates.
- Auth/permission: settings.view
- Response: Paginated templates.
- Table impact: Reads email_templates.

Request:

```json
Query: page, limit, search, isActive.
```

### POST `/api/email-templates`

- Purpose: Create HTML email template.
- Auth/permission: settings.update
- Response: Created template.
- Table impact: Inserts email_templates.

Request:

```json
{"key":"class.scheduled.default","name":"Class Scheduled","subject":"Your class is scheduled","htmlBody":"<h1>Hello {{studentName}}</h1>","textBody":"Hello {{studentName}}","availableVariables":["studentName","teacherName","startTime","joinUrl"],"isActive":true}
```

### GET `/api/email-templates/{id}`

- Purpose: Get one template.
- Auth/permission: settings.view
- Response: Template detail.
- Table impact: Reads email_templates.

Request:

```json
Path: id UUID.
```

### PATCH `/api/email-templates/{id}`

- Purpose: Update template fields.
- Auth/permission: settings.update
- Response: Updated template.
- Table impact: Updates email_templates.

Request:

```json
{"subject":"Updated subject","htmlBody":"<p>Updated HTML</p>"}
```

### PATCH `/api/email-templates/{id}/status`

- Purpose: Enable/disable template.
- Auth/permission: settings.update
- Response: Updated template status.
- Table impact: Updates email_templates.is_active.

Request:

```json
{"isActive":true}
```

### GET `/api/notification-rules`

- Purpose: List notification rules.
- Auth/permission: settings.view
- Response: Paginated rules.
- Table impact: Reads notification_rules and email_templates.

Request:

```json
Query: page, limit, eventKey, channel, recipientRole, isEnabled.
```

### POST `/api/notification-rules`

- Purpose: Create notification rule.
- Auth/permission: settings.update
- Response: Created rule.
- Table impact: Inserts notification_rules.

Request:

```json
{"eventKey":"class.scheduled","channel":"email","recipientRole":"student","emailTemplateId":"<template uuid>","isEnabled":true,"conditions":{}}
```

### PATCH `/api/notification-rules/{id}`

- Purpose: Update notification rule.
- Auth/permission: settings.update
- Response: Updated rule.
- Table impact: Updates notification_rules.

Request:

```json
{"eventKey":"class.cancelled","emailTemplateId":"<template uuid>","conditions":{}}
```

### PATCH `/api/notification-rules/{id}/status`

- Purpose: Enable/disable notification rule.
- Auth/permission: settings.update
- Response: Updated rule status.
- Table impact: Updates notification_rules.is_enabled.

Request:

```json
{"isEnabled":false}
```

### GET `/api/notification-delivery-logs`

- Purpose: List delivery logs.
- Auth/permission: settings.view
- Response: Paginated delivery logs.
- Table impact: Reads notification_delivery_logs.
- Notes: Actual SMTP/provider sending is future work.

Request:

```json
Query: page, limit, eventKey, channel, status, recipientUserId.
```
