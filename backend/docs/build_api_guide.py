from __future__ import annotations

from datetime import datetime
from pathlib import Path
from textwrap import wrap


ROOT = Path(__file__).resolve().parent
PDF_OUT = ROOT / "SchooliEdu_API_Guide.pdf"
MD_OUT = ROOT / "SchooliEdu_API_Guide.md"

DOC_VERSION = "0.2"
GENERATED_AT = datetime.now().strftime("%Y-%m-%d %H:%M")


def ep(method, path, permission, purpose, request, response, tables, notes=""):
    return {
        "method": method,
        "path": path,
        "permission": permission,
        "purpose": purpose,
        "request": request,
        "response": response,
        "tables": tables,
        "notes": notes,
    }


SECTIONS = [
    {
        "title": "Platform Entry Points",
        "intent": "Use these endpoints to confirm the service is available and to access the interactive API explorer.",
        "endpoints": [
            ep("GET", "/api/health", "Public", "Backend liveness check.", "No payload.", "Returns service name, environment, and timestamp.", "No table impact."),
            ep("GET", "/api/docs", "Public", "Swagger UI for manual testing.", "No payload.", "HTML Swagger UI.", "No table impact.", "Use Authorize with a bearer token after login."),
            ep("GET", "/api/docs.json", "Public", "Raw OpenAPI specification.", "No payload.", "OpenAPI JSON.", "No table impact."),
        ],
    },
    {
        "title": "Authentication",
        "intent": "Authenticate users and manage access/refresh token lifecycle.",
        "endpoints": [
            ep("POST", "/api/auth/login", "Public", "Login with username/email and password.", '{"identifier":"admin","password":"Schooli@2025"}', "Returns accessToken, refreshToken, and user profile.", "Reads users, roles, permissions. Inserts refresh_tokens.", "Use identifier as either username or email."),
            ep("POST", "/api/auth/refresh", "Public", "Issue a fresh access token from a refresh token.", '{"refreshToken":"<refresh token>"}', "Returns a new access token payload.", "Reads refresh_tokens and users."),
            ep("POST", "/api/auth/logout", "Public", "Revoke a refresh token.", '{"refreshToken":"<refresh token>"}', "Returns logout confirmation.", "Updates refresh_tokens."),
            ep("GET", "/api/auth/me", "Bearer token", "Fetch current authenticated user context.", "No payload.", "Returns profile, roles, and permissions.", "Reads users, roles, permissions."),
        ],
    },
    {
        "title": "RBAC",
        "intent": "Inspect roles and permissions used by route guards.",
        "endpoints": [
            ep("GET", "/api/roles", "role.view", "List all platform roles.", "No payload.", "Returns roles.", "Reads roles."),
            ep("GET", "/api/permissions", "permission.view", "List all permission keys.", "No payload.", "Returns permissions.", "Reads permissions."),
        ],
    },
    {
        "title": "User Administration",
        "intent": "Create and manage base accounts for admins, teachers, students, and support users.",
        "endpoints": [
            ep("GET", "/api/users", "user.view", "List users with filters.", "Query: page, limit, search, role, status.", "Paginated user list.", "Reads users, user_roles, roles."),
            ep("POST", "/api/users", "user.create", "Create user and optional roles.", '{"firstName":"Demo","lastName":"Teacher","username":"demo_teacher","email":"demo.teacher@schooliedu.local","phone":"+919999999999","password":"Schooli@2025","roles":["teacher"]}', "Created user profile.", "Inserts users and user_roles.", "Passwords are hashed before storage."),
            ep("GET", "/api/users/{id}", "user.view", "Get a user by ID.", "Path: id UUID.", "User profile.", "Reads users, user_roles, roles."),
            ep("PATCH", "/api/users/{id}", "user.update", "Update profile fields.", '{"firstName":"Demo","lastName":"Teacher","phone":"+919999999999","avatarUrl":null}', "Updated user profile.", "Updates users."),
            ep("PATCH", "/api/users/{id}/status", "user.deactivate", "Activate, deactivate, or suspend a user.", '{"status":"active","isActive":true}', "Updated user profile.", "Updates users.status and users.is_active."),
            ep("POST", "/api/users/{id}/roles", "user.update", "Replace assigned roles.", '{"roles":["teacher"]}', "Updated user roles.", "Deletes/inserts user_roles."),
        ],
    },
    {
        "title": "People, Availability, And Assignments",
        "intent": "Manage teacher/student profile views, weekly teacher availability, blocked dates, and teacher-student assignment prerequisites for scheduling.",
        "endpoints": [
            ep("GET", "/api/teachers", "teacher.view", "List teacher users.", "Query: page, limit, search, status.", "Paginated teachers.", "Reads users and roles."),
            ep("GET", "/api/teachers/{id}", "teacher.view", "Get teacher profile.", "Path: id UUID.", "Teacher profile.", "Reads users and roles."),
            ep("GET", "/api/students", "student.view", "List student users.", "Query: page, limit, search, status.", "Paginated students.", "Reads users and roles."),
            ep("GET", "/api/students/{id}", "student.view", "Get student profile.", "Path: id UUID.", "Student profile.", "Reads users and roles."),
            ep("GET", "/api/teacher-student-assignments", "teacher.view/student.view scope", "List teacher-student links.", "Query: page, limit, teacherId, studentId, status.", "Paginated assignments.", "Reads teacher_student_assignments and users."),
            ep("POST", "/api/teacher-student-assignments", "assignment create permission", "Create an active teacher-student link.", '{"teacherId":"<teacher uuid>","studentId":"<student uuid>","notes":"Initial assignment"}', "Created assignment.", "Inserts teacher_student_assignments.", "Class scheduling requires this active link."),
            ep("PATCH", "/api/teacher-student-assignments/{id}/status", "assignment update permission", "Activate/deactivate a link.", '{"status":"active"}', "Updated assignment.", "Updates teacher_student_assignments."),
            ep("GET", "/api/teachers/{id}/availability", "teacher.view", "List weekly slots and blocked dates.", "Path: id UUID.", "Availability bundle.", "Reads teacher_availability and teacher_unavailable_dates."),
            ep("POST", "/api/teachers/{id}/availability", "teacher.update", "Create/update a weekly availability slot.", '{"dayOfWeek":"monday","startTime":"16:00","endTime":"20:00","timezone":"Asia/Kolkata","isActive":true}', "Availability record.", "Inserts/updates teacher_availability."),
            ep("POST", "/api/teachers/{id}/unavailable-dates", "teacher.update", "Block a date/time window.", '{"unavailableDate":"2026-06-10","startTime":"16:00","endTime":"18:00","reason":"Personal leave"}', "Blocked-date record.", "Inserts teacher_unavailable_dates."),
            ep("DELETE", "/api/teachers/{id}/unavailable-dates/{dateId}", "teacher.update", "Remove a blocked date.", "Path: id UUID, dateId UUID.", "Delete confirmation.", "Deletes teacher_unavailable_dates."),
        ],
    },
    {
        "title": "Class Scheduling And Cancellation",
        "intent": "Schedule teacher-student classes, create Zoom metadata, expose calendar data, and manage cancellation requests.",
        "endpoints": [
            ep("POST", "/api/classes/check-conflicts", "class.create", "Validate a proposed class time before creation.", '{"teacherId":"<teacher uuid>","studentId":"<student uuid>","startTime":"2026-06-10T10:00:00.000Z","durationMinutes":60,"timezone":"Asia/Kolkata"}', "hasConflicts plus conflict list.", "Reads assignments, availability, blocked dates, classes, class_participants."),
            ep("GET", "/api/classes", "class.view", "List classes scoped to current user.", "Query: page, limit, status, teacherId, studentId, from, to.", "Paginated class list.", "Reads classes, class_participants, users, zoom_meetings."),
            ep("POST", "/api/classes", "class.create", "Schedule a class for one teacher and one student.", '{"teacherId":"<teacher uuid>","studentId":"<student uuid>","title":"Math class","startTime":"2026-06-10T10:00:00.000Z","durationMinutes":60,"timezone":"Asia/Kolkata","notes":"Optional note","overrideConflicts":false}', "Created class with participant and Zoom metadata.", "Inserts classes, class_participants, class_attendance, zoom_meetings.", "Auto-creates Zoom when Zoom config is present."),
            ep("GET", "/api/classes/{id}", "class.view", "Get class details.", "Path: id UUID.", "Class detail.", "Reads classes, participants, users, zoom_meetings."),
            ep("PATCH", "/api/classes/{id}", "class.update", "Update title/notes.", '{"title":"Updated title","notes":"Updated note"}', "Updated class.", "Updates classes."),
            ep("POST", "/api/classes/{id}/cancel", "class.cancel", "Directly cancel a class.", '{"reason":"Operational cancellation reason"}', "Cancelled class.", "Updates classes.status, cancelled_at, cancellation_reason."),
            ep("POST", "/api/classes/{id}/reschedule", "class.reschedule", "Move class to a new time after conflict checks.", '{"startTime":"2026-06-11T10:00:00.000Z","durationMinutes":60,"timezone":"Asia/Kolkata","overrideConflicts":false}', "Rescheduled class.", "Updates classes start/end/duration/timezone/status."),
            ep("POST", "/api/classes/{id}/join", "class.join", "Return Zoom join/start payload.", "Path: id UUID.", "Meeting provider payload.", "Reads classes and zoom_meetings.", "Teacher/admin can receive startUrl; student receives joinUrl."),
            ep("GET", "/api/calendar/classes", "class.view", "Calendar-oriented class list.", "Query: from, to, teacherId, studentId.", "Class list.", "Reads same tables as /api/classes."),
            ep("GET", "/api/classes/{id}/ics", "class.view", "Download ICS event file.", "Path: id UUID.", "text/calendar response.", "Reads classes."),
            ep("GET", "/api/classes/{id}/cancel-requests", "class.view", "List cancellation requests for one class.", "Path id. Query: page, limit, status.", "Paginated requests.", "Reads class_cancellation_requests, classes, users."),
            ep("POST", "/api/classes/{id}/cancel-requests", "class.view", "Student/teacher cancellation request with reason.", '{"reason":"Student has an exam at the same time"}', "Created request.", "Inserts class_cancellation_requests."),
            ep("GET", "/api/class-cancellation-requests", "class.view", "Admin/support cancellation queue.", "Query: page, limit, status, classId, requestedByUserId.", "Paginated requests.", "Reads class_cancellation_requests, classes, users."),
            ep("PATCH", "/api/class-cancellation-requests/{id}/status", "class.cancel for approve/reject", "Approve, reject, or withdraw request.", '{"status":"approved","adminNote":"Approved by admin"}', "Updated request.", "Updates class_cancellation_requests. If approved, updates classes to cancelled."),
        ],
    },
    {
        "title": "Attendance",
        "intent": "Mark official attendance while preserving Zoom join/leave evidence.",
        "endpoints": [
            ep("GET", "/api/attendance", "attendance.view", "List attendance records.", "Query: page, limit, classId, teacherId, studentId, status, from, to.", "Paginated attendance records with Zoom evidence summary.", "Reads class_attendance, classes, users, zoom_attendance_events."),
            ep("GET", "/api/classes/{id}/attendance", "attendance.view", "List attendance for one class.", "Path: id UUID.", "Attendance records.", "Reads class_attendance, classes, users, zoom_attendance_events."),
            ep("POST", "/api/attendance/mark", "attendance.mark", "Mark attendance.", '{"classId":"<class uuid>","studentId":"<student uuid>","status":"present","teacherNotes":"Joined on time","zoomJoinTime":"2026-06-10T10:00:00.000Z","zoomLeaveTime":"2026-06-10T10:57:00.000Z","totalZoomMinutes":57}', "Marked attendance record.", "Upserts class_attendance and updates class_participants.attendance_status."),
            ep("PATCH", "/api/attendance/{id}", "attendance.mark; override users use attendance.override", "Update attendance.", '{"status":"late","teacherNotes":"Joined late","totalZoomMinutes":42}', "Updated attendance record.", "Updates class_attendance and class_participants."),
        ],
    },
    {
        "title": "Zoom",
        "intent": "Create and inspect Zoom meetings, handle Zoom webhooks, and prepare embedded meeting signatures.",
        "endpoints": [
            ep("POST", "/api/zoom/meetings", "class.create/Zoom route guard", "Create or recreate Zoom meeting for class.", '{"classId":"<class uuid>"}', "Zoom meeting metadata.", "Reads classes. Inserts/updates zoom_meetings.", "Requires Zoom Server-to-Server OAuth env vars."),
            ep("GET", "/api/zoom/meetings/{id}", "class.view", "Get local Zoom metadata.", "Path: id UUID.", "Zoom meeting record.", "Reads zoom_meetings and classes."),
            ep("POST", "/api/zoom/webhook", "Zoom signature verification", "Receive Zoom url_validation and join/leave events.", "Zoom webhook payload.", "Webhook acknowledgement.", "Inserts zoom_attendance_events; may update zoom_meetings."),
            ep("POST", "/api/classes/{id}/zoom/signature", "class.join", "Generate Meeting SDK signature.", '{"role":0}', "Meeting SDK signature payload.", "Reads classes and zoom_meetings.", "Requires ZOOM_MEETING_SDK_KEY and ZOOM_MEETING_SDK_SECRET."),
        ],
    },
    {
        "title": "Email Templates And Notification Manager",
        "intent": "Configure reusable HTML mail templates and rules for when notifications should be sent.",
        "endpoints": [
            ep("GET", "/api/email-templates", "settings.view", "List email templates.", "Query: page, limit, search, isActive.", "Paginated templates.", "Reads email_templates."),
            ep("POST", "/api/email-templates", "settings.update", "Create HTML email template.", '{"key":"class.scheduled.default","name":"Class Scheduled","subject":"Your class is scheduled","htmlBody":"<h1>Hello {{studentName}}</h1>","textBody":"Hello {{studentName}}","availableVariables":["studentName","teacherName","startTime","joinUrl"],"isActive":true}', "Created template.", "Inserts email_templates."),
            ep("GET", "/api/email-templates/{id}", "settings.view", "Get one template.", "Path: id UUID.", "Template detail.", "Reads email_templates."),
            ep("PATCH", "/api/email-templates/{id}", "settings.update", "Update template fields.", '{"subject":"Updated subject","htmlBody":"<p>Updated HTML</p>"}', "Updated template.", "Updates email_templates."),
            ep("PATCH", "/api/email-templates/{id}/status", "settings.update", "Enable/disable template.", '{"isActive":true}', "Updated template status.", "Updates email_templates.is_active."),
            ep("GET", "/api/notification-rules", "settings.view", "List notification rules.", "Query: page, limit, eventKey, channel, recipientRole, isEnabled.", "Paginated rules.", "Reads notification_rules and email_templates."),
            ep("POST", "/api/notification-rules", "settings.update", "Create notification rule.", '{"eventKey":"class.scheduled","channel":"email","recipientRole":"student","emailTemplateId":"<template uuid>","isEnabled":true,"conditions":{}}', "Created rule.", "Inserts notification_rules."),
            ep("PATCH", "/api/notification-rules/{id}", "settings.update", "Update notification rule.", '{"eventKey":"class.cancelled","emailTemplateId":"<template uuid>","conditions":{}}', "Updated rule.", "Updates notification_rules."),
            ep("PATCH", "/api/notification-rules/{id}/status", "settings.update", "Enable/disable notification rule.", '{"isEnabled":false}', "Updated rule status.", "Updates notification_rules.is_enabled."),
            ep("GET", "/api/notification-delivery-logs", "settings.view", "List delivery logs.", "Query: page, limit, eventKey, channel, status, recipientUserId.", "Paginated delivery logs.", "Reads notification_delivery_logs.", "Actual SMTP/provider sending is future work."),
        ],
    },
]

PERMISSION_MATRIX = [
    ("Admin", "Full seeded permission set; can create users, schedule/cancel/reschedule classes, override conflicts, mark/override attendance, manage settings."),
    ("Teacher", "View assigned students/classes, join class, mark attendance, create/review homework later, view reports."),
    ("Student", "View own classes, join class, view own attendance, submit homework later, create tickets, view certificates/reports."),
    ("Support", "Operational view of users/classes/attendance/credits/tickets/reports; can resolve tickets and assist rescheduling."),
]

TABLE_MAP = [
    ("Identity and RBAC", "users, roles, permissions, user_roles, role_permissions, refresh_tokens, password_reset_tokens, otp_tokens"),
    ("People and scheduling prerequisites", "teacher_student_assignments, teacher_availability, teacher_unavailable_dates"),
    ("Class execution", "classes, class_participants, class_attendance"),
    ("Zoom evidence", "zoom_meetings, zoom_attendance_events"),
    ("Cancellation workflow", "class_cancellation_requests"),
    ("Notification configuration", "email_templates, notification_rules, notification_delivery_logs"),
    ("Planned API schemas", "homework, homework_resources, homework_submissions, homework_submission_files, credits_ledger, tickets, ticket_messages, ticket_attachments, ticket_status_history, certificates, reports, system_settings, audit_logs"),
]


class PDF:
    def __init__(self):
        self.pages: list[str] = []
        self.ops: list[str] = []
        self.page_no = 0
        self.y = 742
        self.margin = 48
        self.width = 612
        self.content_width = 516
        self.bottom = 58

    def _esc(self, text):
        return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    def op(self, command):
        self.ops.append(command)

    def rgb(self, color):
        return " ".join(f"{c / 255:.3f}" for c in color)

    def new_page(self, title=None):
        if self.ops:
            self.pages.append("\n".join(self.ops))
        self.page_no += 1
        self.ops = []
        self.y = 736
        if self.page_no > 1:
            self.text(48, 766, "SchooliEdu Backend API Guide", 8.5, "F2", (78, 93, 108), track_y=False)
            self.text(520, 766, f"Page {self.page_no}", 8.5, "F1", (78, 93, 108), track_y=False)
            self.line(48, 756, 564, 756, (226, 232, 240), 0.75)
        if title:
            self.h1(title)

    def ensure(self, height):
        if self.y - height < self.bottom:
            self.new_page()

    def text(self, x, y, text, size=10, font="F1", color=(15, 23, 42), track_y=True):
        self.op(f"BT {self.rgb(color)} rg /{font} {size:.2f} Tf {x:.2f} {y:.2f} Td ({self._esc(text)}) Tj ET")
        if track_y:
            self.y = y

    def line(self, x1, y1, x2, y2, color=(203, 213, 225), width=1):
        self.op(f"{self.rgb(color)} RG {width:.2f} w {x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S")

    def rect(self, x, y, w, h, fill=(248, 250, 252), stroke=(226, 232, 240), stroke_width=0.75):
        self.op(f"{self.rgb(fill)} rg {x:.2f} {y:.2f} {w:.2f} {h:.2f} re f")
        if stroke:
            self.op(f"{self.rgb(stroke)} RG {stroke_width:.2f} w {x:.2f} {y:.2f} {w:.2f} {h:.2f} re S")

    def h1(self, text):
        self.ensure(50)
        self.y -= 8
        self.text(48, self.y, text, 17, "F2", (30, 64, 175))
        self.y -= 18
        self.line(48, self.y, 564, self.y, (191, 219, 254), 1.2)
        self.y -= 14

    def h2(self, text):
        self.ensure(34)
        self.text(48, self.y, text, 12.5, "F2", (15, 23, 42))
        self.y -= 17

    def h3(self, text):
        self.ensure(28)
        self.text(48, self.y, text, 10.5, "F2", (30, 64, 175))
        self.y -= 14

    def para(self, text, size=9.4, color=(30, 41, 59), indent=0, width_chars=104, leading=12.5):
        lines = wrap(str(text), width=max(28, width_chars - int(indent / 5)), break_long_words=False)
        for line in lines or [""]:
            self.ensure(leading)
            self.text(48 + indent, self.y, line, size, "F1", color)
            self.y -= leading
        self.y -= 2

    def bullet(self, text):
        lines = wrap(text, width=96, break_long_words=False)
        self.ensure(15 * max(1, len(lines)))
        self.text(56, self.y, "-", 9.5, "F2", (30, 64, 175))
        self.text(70, self.y, lines[0], 9.4, "F1", (30, 41, 59))
        self.y -= 12.5
        for line in lines[1:]:
            self.text(70, self.y, line, 9.4, "F1", (30, 41, 59))
            self.y -= 12.5
        self.y -= 2

    def code_box(self, text):
        lines = []
        for raw in str(text).split("\n"):
            lines.extend(wrap(raw, width=82, break_long_words=False) or [""])
        height = 18 + 11 * len(lines)
        self.ensure(height + 4)
        self.rect(58, self.y - height + 8, 496, height, (248, 250, 252), (203, 213, 225))
        yy = self.y - 8
        for line in lines:
            self.text(68, yy, line, 8.1, "F3", (15, 23, 42), track_y=False)
            yy -= 11
        self.y -= height + 8

    def kv(self, label, value):
        self.ensure(22)
        self.text(58, self.y, label, 8.8, "F2", (71, 85, 105))
        self.para(value, size=9.0, indent=116, width_chars=78, leading=11.6)

    def endpoint_card(self, item):
        self.ensure(130)
        top = self.y + 4
        method_colors = {
            "GET": (22, 101, 52),
            "POST": (30, 64, 175),
            "PATCH": (146, 64, 14),
            "DELETE": (153, 27, 27),
        }
        self.rect(48, top - 30, 516, 30, (241, 245, 249), (203, 213, 225))
        self.rect(58, top - 23, 50, 16, method_colors.get(item["method"], (71, 85, 105)), None)
        self.text(69, top - 19, item["method"], 8.0, "F2", (255, 255, 255), track_y=False)
        self.text(118, top - 19, item["path"], 9.8, "F3", (15, 23, 42), track_y=False)
        self.y = top - 42
        self.kv("Purpose", item["purpose"])
        self.kv("Auth", item["permission"])
        self.kv("Response", item["response"])
        self.kv("Tables", item["tables"])
        if item["notes"]:
            self.kv("Notes", item["notes"])
        self.text(58, self.y, "Request", 8.8, "F2", (71, 85, 105))
        self.y -= 10
        self.code_box(item["request"])
        self.y -= 4

    def simple_table(self, headers, rows, widths):
        row_h = 34
        self.ensure(row_h * (len(rows) + 1) + 10)
        x = 48
        self.rect(x, self.y - 22, sum(widths), 22, (226, 232, 240), (203, 213, 225))
        xx = x
        for idx, header in enumerate(headers):
            self.text(xx + 6, self.y - 14, header, 8.4, "F2", (15, 23, 42), track_y=False)
            xx += widths[idx]
        self.y -= 22
        for row in rows:
            lines_per_cell = []
            max_lines = 1
            for idx, cell in enumerate(row):
                lines = wrap(cell, width=max(12, int(widths[idx] / 5.2)), break_long_words=False) or [""]
                lines_per_cell.append(lines)
                max_lines = max(max_lines, len(lines))
            h = 14 + max_lines * 10
            self.ensure(h + 6)
            self.rect(x, self.y - h, sum(widths), h, (255, 255, 255), (226, 232, 240), 0.5)
            xx = x
            for idx, lines in enumerate(lines_per_cell):
                yy = self.y - 12
                for line in lines:
                    self.text(xx + 6, yy, line, 7.7, "F1", (30, 41, 59), track_y=False)
                    yy -= 10
                xx += widths[idx]
            self.y -= h
        self.y -= 10

    def finish(self):
        if self.ops:
            self.pages.append("\n".join(self.ops))
        objects: list[tuple[int, bytes]] = []
        catalog_id, pages_id, font1_id, font2_id, font3_id = 1, 2, 3, 4, 5
        next_id = 6
        page_ids = []
        for page_ops in self.pages:
            page_id = next_id
            content_id = next_id + 1
            next_id += 2
            page_ids.append(page_id)
            stream = page_ops.encode("latin-1", "replace")
            objects.append((content_id, f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream"))
            objects.append((page_id, (
                f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 612 792] "
                f"/Resources << /Font << /F1 {font1_id} 0 R /F2 {font2_id} 0 R /F3 {font3_id} 0 R >> >> "
                f"/Contents {content_id} 0 R >>"
            ).encode()))

        base = [
            (catalog_id, f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode()),
            (pages_id, f"<< /Type /Pages /Kids [{' '.join(f'{p} 0 R' for p in page_ids)}] /Count {len(page_ids)} >>".encode()),
            (font1_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
            (font2_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"),
            (font3_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"),
        ]
        all_objects = sorted(base + objects, key=lambda item: item[0])
        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for obj_id, body in all_objects:
            offsets.append(len(out))
            out.extend(f"{obj_id} 0 obj\n".encode())
            out.extend(body)
            out.extend(b"\nendobj\n")
        xref = len(out)
        out.extend(f"xref\n0 {len(all_objects) + 1}\n".encode())
        out.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            out.extend(f"{offset:010d} 00000 n \n".encode())
        out.extend(f"trailer\n<< /Size {len(all_objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
        PDF_OUT.write_bytes(out)


def build_markdown():
    lines = [
        "# SchooliEdu Backend API Guide",
        "",
        f"Version: {DOC_VERSION}",
        f"Generated: {GENERATED_AT}",
        "",
        "## Usage Conventions",
        "",
        "- Base URL: `http://localhost:5000`",
        "- Swagger UI: `GET /api/docs`",
        "- OpenAPI JSON: `GET /api/docs.json`",
        "- Protected endpoints use `Authorization: Bearer <accessToken>`.",
        "- Responses use `{ success, message, data, pagination? }` for success and `{ success:false, message, error }` for failures.",
        "",
        "## Permission Matrix",
    ]
    for role, desc in PERMISSION_MATRIX:
        lines.append(f"- **{role}:** {desc}")
    lines += ["", "## Table Impact Map", ""]
    for label, tables in TABLE_MAP:
        lines.append(f"- **{label}:** {tables}")
    for section in SECTIONS:
        lines += ["", f"## {section['title']}", "", section["intent"], ""]
        for item in section["endpoints"]:
            lines += [
                f"### {item['method']} `{item['path']}`",
                "",
                f"- Purpose: {item['purpose']}",
                f"- Auth/permission: {item['permission']}",
                f"- Response: {item['response']}",
                f"- Table impact: {item['tables']}",
            ]
            if item["notes"]:
                lines.append(f"- Notes: {item['notes']}")
            lines += ["", "Request:", "", "```json", item["request"], "```", ""]
    MD_OUT.write_text("\n".join(lines), encoding="utf-8")


def build_pdf():
    pdf = PDF()
    pdf.new_page()
    pdf.rect(0, 0, 612, 792, (248, 250, 252), None)
    pdf.rect(0, 680, 612, 112, (30, 64, 175), None)
    pdf.text(48, 728, "SchooliEdu", 18, "F2", (219, 234, 254), track_y=False)
    pdf.text(48, 698, "Backend API Guide", 27, "F2", (255, 255, 255), track_y=False)
    pdf.text(48, 650, "Industry-style reference for API testing, payloads, permissions, and database impact.", 12, "F1", (51, 65, 85), track_y=False)
    pdf.text(48, 622, f"Version {DOC_VERSION}  |  Generated {GENERATED_AT}", 9.5, "F1", (71, 85, 105), track_y=False)
    pdf.y = 570
    pdf.h2("Document Scope")
    for item in [
        "Documents all APIs currently implemented in the backend.",
        "Covers endpoint purpose, permission, request payload or query parameters, expected response, and affected tables.",
        "Separates implemented APIs from schema-only roadmap areas.",
        "Designed to be used alongside Swagger UI while manually testing the backend.",
    ]:
        pdf.bullet(item)
    pdf.h2("Quick Start")
    for item in [
        "Run the backend, then open http://localhost:5000/api/docs.",
        "Call POST /api/auth/login using admin credentials.",
        "Copy data.accessToken into Swagger Authorize as a bearer token.",
        "Create teachers/students, assign them, add teacher availability, then schedule classes.",
    ]:
        pdf.bullet(item)

    pdf.new_page("Usage Conventions")
    pdf.para("Base URL: http://localhost:5000")
    pdf.para("Authentication: protected APIs require Authorization: Bearer <accessToken>.")
    pdf.para("Response envelope: successful JSON responses use success, message, data, and optional pagination. Errors use success=false with error.code and optional error.details.")
    pdf.para("Dates: use ISO 8601 date-time strings for timestamps. The project default timezone for scheduling is Asia/Kolkata.")
    pdf.h2("Permission Matrix")
    pdf.simple_table(["Role", "Operational scope"], PERMISSION_MATRIX, [90, 426])
    pdf.h2("Database Impact Map")
    pdf.simple_table(["Area", "Tables"], TABLE_MAP, [160, 356])

    pdf.new_page("Recommended Manual Testing Sequence")
    for idx, step in enumerate([
        "Login and authorize Swagger.",
        "Create or verify a teacher user and a student user.",
        "Create an active teacher-student assignment.",
        "Add teacher weekly availability.",
        "Run class conflict check.",
        "Schedule class and confirm Zoom metadata.",
        "Use join endpoint to fetch student/teacher meeting links.",
        "Create and review a cancellation request.",
        "Mark attendance and verify participant attendance status sync.",
        "Create email templates and notification rules.",
    ], start=1):
        pdf.bullet(f"{idx}. {step}")

    for section in SECTIONS:
        pdf.new_page(section["title"])
        pdf.para(section["intent"], size=10.2, color=(51, 65, 85), width_chars=96)
        pdf.h2("Endpoint Catalogue")
        catalogue = [(item["method"], item["path"], item["permission"]) for item in section["endpoints"]]
        pdf.simple_table(["Method", "Path", "Permission"], catalogue, [58, 306, 152])
        pdf.h2("Detailed Endpoint Specs")
        for item in section["endpoints"]:
            pdf.endpoint_card(item)

    pdf.new_page("Roadmap Boundaries")
    pdf.para("The following database schemas already exist but public API modules are still pending: homework, credits ledger, support tickets, certificates, reports, settings, and audit logs. They should be documented in this guide as soon as each API slice is implemented.", width_chars=96)
    pdf.h2("Current Phase 1 Boundaries")
    for item in [
        "Parent role is excluded from Phase 1.",
        "Payments are excluded from Phase 1.",
        "Real frontend Zoom SDK integration waits on Meeting SDK key/secret.",
        "Real SMTP/provider email sending is not yet implemented.",
        "Cloudinary/media upload integration is deferred.",
    ]:
        pdf.bullet(item)
    pdf.finish()


def main():
    build_markdown()
    build_pdf()
    print(PDF_OUT)
    print(MD_OUT)


if __name__ == "__main__":
    main()
