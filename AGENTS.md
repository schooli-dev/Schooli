# SchooliEdu - AGENTS.md

Read this file before making any changes to the project. Then read `backend/AGENTS.md` and/or `frontend/AGENTS.md` for the layer you touch (see "Documentation Map" at the end).

## Project Overview

SchooliEdu is a role-based Learning Management System (LMS) for online tutoring.
It supports three portals: Admin, Teacher, and Student.
Core features include class scheduling, live video sessions (Daily.co), attendance tracking, cancellation requests, notifications, and role-permission management.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20, TypeScript, SCSS, Bootstrap 5, Bootstrap Icons |
| Backend | Node.js, Express 4, TypeScript (ESM), Zod |
| Database | PostgreSQL (raw SQL, manual migrations via pg) |
| Video | Daily.co (@daily-co/daily-js) |
| File storage | Cloudflare R2 (S3 API via @aws-sdk/client-s3) for private learning-material uploads |
| Auth | JWT (access + refresh tokens), bcrypt |
| API Docs | Swagger (swagger-jsdoc + swagger-ui-express) |
| Package Manager | npm (both frontend and backend) |
| Deployment | Render (Backend: Web Service, Frontend: Static Site, DB: PostgreSQL) |

## Folder Structure

    SchooliEdu_Project/
    backend/                  Express + TypeScript API
      src/
        app.ts                Express app setup (CORS, middleware, routes)
        server.ts             Entry point - DB check + listen
        config/               Env validation (Zod), runtime config
        db/                   pool.ts, migrate.ts, seedAdmin.ts, status.ts
        middlewares/          auth, permission, validate, error
        modules/              Feature modules (auth, users, classes, attendance, etc.)
        types/                Shared TypeScript types
        utils/                API response helpers, async handler, etc.
      migrations/             Numbered SQL migration files (001-023; next is 024)
      docs/                   API guide (PDF + Markdown)
      package.json

    frontend/                 Angular 20 SPA
      src/
        main.ts               Angular bootstrap entry
        styles.scss           Global styles + CSS design tokens
        index.html            HTML shell
        environments/         environment.ts (written at build time for prod)
        app/
          app.config.ts       provideRouter, provideHttpClient, interceptors
          app.routes.ts       All SPA routes with auth guards + permissions
          core/               Services, guards, interceptors, models
            auth/             authGuard, authInterceptor, token service
            api/              Shared API client service
            config/           RuntimeConfigService (loads /api/app/details)
            permissions/      Permission checking service
            toast/            Toast interceptor + service
            loading/          Loading interceptor
          features/           Page components (auth, dashboards, classes, etc.)
          shared/             AppShellComponent, ToastContainerComponent
      scripts/
        write-render-env.cjs  Generates environment.ts from BACKEND_PUBLIC_URL at build
      proxy.conf.json         Dev proxy: /api to http://localhost:5000
      angular.json            Angular CLI config (SCSS default, Bootstrap styles)
      package.json

    docs/
      RENDER_DEPLOYMENT_GUIDE.md  Full Render deployment instructions
    ui_Designs/               UI design assets/references
    project_doc               Project documentation file
    AGENTS.md                 This file

## Common Commands

### Frontend (cd frontend)

| Action | Command |
|---|---|
| Install | npm install |
| Dev server | npm start (runs ng serve --proxy-config proxy.conf.json) |
| Build | npm run build |
| Watch build | npm run watch |
| Test | npm test |
| Render production build | npm ci --include=dev && npm run render:env && npm run build |

- Dev server runs on http://localhost:4200
- All /api calls proxy to http://localhost:5000 in dev

### Backend (cd backend)

| Action | Command |
|---|---|
| Install | npm install |
| Dev server | npm run dev (tsx watch) |
| Build | npm run build (tsc) |
| Start production | npm start (node dist/server.js) |
| Type check | npm run typecheck |
| Run migrations | npm run migrate |
| Check DB status | npm run db:status |
| Seed admin | npm run seed:admin |

- Backend dev runs on http://localhost:5000
- Swagger UI: http://localhost:5000/api/docs
- Health check: http://localhost:5000/api/health

### Lint / E2E
- Lint: Not found in repo
- E2E tests: Not found in repo

## Coding Rules for AI Agents

- Make minimal, targeted changes. Do not rewrite working sections unless asked.
- Preserve all existing functionality, routes, guards, and middleware.
- Reuse existing services, components, and utilities before creating new ones.
- For a feature page available to Admin, Teacher, or Student, build one shared page/component by default. Scope its data and show or hide its actions from the authenticated user's permissions; do not create portal-specific duplicate pages merely to make a read-only or restricted variant. Create a separate page only when the user workflow or information architecture is materially different, and document why.
- Do NOT remove or alter: auth guards, JWT interceptor, role-permission checks, migration files, Swagger annotations.
- Do NOT invent new API routes, database tables, or environment variables without being asked.
- Do NOT touch .env files or any file containing real secrets.
- Keep all UI mobile responsive. Bootstrap grid and responsive classes are already in use.
- Avoid adding new npm dependencies unless explicitly instructed.
- Do not remove the render:env / write-render-env.cjs build step. It is required for Render deployment.
- All backend schema changes must go through a new numbered SQL migration file in backend/migrations/, not inline SQL.
- Do not modify existing migration files. They may already have run in production.
- Ask when blocked; otherwise make the safest reasonable assumption.

## Styling Rules

- Global styles: frontend/src/styles.scss imports Bootstrap, Bootstrap Icons, and defines all CSS custom properties (design tokens).
- CSS tokens defined in :root: --color-bg, --color-primary, --color-secondary, --color-danger, --color-success, --radius-*, --shadow-*, --font-sans, --font-display.
- Component styles: each Angular component uses its own .scss file (inline style language = SCSS).
- Icons: Bootstrap Icons only (bi-* CSS classes).
- No Tailwind. Do not introduce Tailwind.
- Font stack: Bahnschrift, Aptos, Segoe UI Variable, system-ui fallback. Do not change this.
- Use existing token variables (e.g. var(--color-primary)) rather than hardcoded colors.
- Bootstrap utility classes and component classes are acceptable for layout and spacing.
- Component style budget: Angular enforces a 20kB error limit per component style file. Keep SCSS lean.

## Deployment Notes

Deployed on Render:

| Resource | Type | Root Dir | Notes |
|---|---|---|---|
| schooliedu-backend | Web Service | backend | Node, npm start |
| schooliedu-frontend | Static Site | frontend | Publish: dist/frontend/browser |
| schooliedu-postgres | PostgreSQL | - | Internal URL in backend DATABASE_URL |

Key deployment facts:
- Frontend build on Render requires BACKEND_PUBLIC_URL env var set in the Render Static Site settings.
- npm run render:env generates src/environments/environment.ts at build time from BACKEND_PUBLIC_URL.
- Angular SPA requires a Render rewrite rule: /* to /index.html (Action: Rewrite, not Redirect).
- Backend CORS_ORIGIN must exactly match the frontend Render URL (no trailing slash, no path).
- JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must remain stable after launch. Changing them logs all users out.
- Database uses Internal Database URL on Render (append ?sslmode=require if not present).
- Full deployment order: see docs/RENDER_DEPLOYMENT_GUIDE.md.

## Important Files

| File | Purpose |
|---|---|
| frontend/src/styles.scss | Global CSS design tokens and Bootstrap imports |
| frontend/src/app/app.routes.ts | All SPA routes, guards, permission data |
| frontend/src/app/app.config.ts | Angular providers, interceptors |
| frontend/src/app/core/auth/auth.guard.ts | Route guards (authGuard, loginRedirectGuard) |
| frontend/src/app/core/auth/auth.interceptor.ts | Attaches JWT Bearer token to all API requests |
| frontend/src/app/core/config/runtime-config.service.ts | Loads /api/app/details before app startup |
| frontend/scripts/write-render-env.cjs | Writes environment.ts from BACKEND_PUBLIC_URL at build |
| frontend/proxy.conf.json | Dev proxy: /api to localhost:5000 (dev environment.ts already uses the absolute http://localhost:5000/api, so the browser calls the backend directly) |
| backend/src/app.ts | Express setup, middleware registration, route mounting |
| backend/src/server.ts | Entry: DB verification + server listen |
| backend/src/middlewares/auth.middleware.ts | JWT verification middleware |
| backend/src/middlewares/permission.middleware.ts | RBAC permission enforcement |
| backend/src/db/pool.ts | PostgreSQL connection pool |
| backend/migrations/ | Numbered SQL migration files - do not modify existing ones |
| backend/BACKEND_CHECKLIST.md | Completed backend features reference |
| frontend/FRONTEND_CHECKLIST.md | Completed frontend features reference |
| docs/RENDER_DEPLOYMENT_GUIDE.md | Full Render deployment instructions |

## Known Pitfalls

- environment.ts is generated at build time by write-render-env.cjs. Do not commit a hardcoded production URL into it. The dev file in git should have local dev defaults.
- Migrations are sequential and irreversible in production. Never edit an existing migration. Always add a new numbered file.
- Angular SPA routing: Direct URL loads (e.g. /admin/classes) return 404 on Render without the /* to /index.html rewrite rule.
- CORS: The backend CORS_ORIGIN must exactly match the frontend origin - protocol + host, no path, no trailing slash.
- JWT secrets: Must be stable in production. Changing them invalidates all active sessions.
- Daily.co API key is backend-only and must never be exposed in the frontend or committed to git.
- Backend ESM: package.json has type module. All imports must use .js extension in compiled output.
- Auth guard reads role from token claims to redirect users; roles are admin, teacher, student.
- Timezone: All class timestamps are stored in UTC. Display conversion to user timezone must happen in the frontend using the users.timezone field.
- Build budgets: Angular enforces 500kB initial warning / 1.1MB error and 4kB / 20kB per component style. Monitor bundle size.
- Render free tier can cold-start slowly. Backend should use a paid instance for production.

## Agent Workflow

Before editing, follow this checklist:

1. Read this AGENTS.md fully.
2. Identify the affected layer (frontend, backend, or both).
3. Inspect the relevant feature folder under src/app/features/ or backend/src/modules/.
4. Check existing services in core/ (frontend) or utils/ (backend) before creating new ones.
5. Make the smallest working change that fulfills the requirement.
6. For backend schema changes: add a new migration file; never modify existing ones.
7. Validate with the appropriate command:
   - Frontend: npm run build (inside frontend/)
   - Backend: npm run typecheck (inside backend/)
8. Report: which files were changed and why.

## Domain Summary (read this instead of re-exploring)

- **Roles**: `admin`, `teacher`, `student`, `support` (seeded) plus custom roles. Access is decided by **permission keys** (backend `requirePermission`, frontend `data.permission` + guard), not role names. Role names only scope data (teacher sees own classes, student sees own).
- **Live classes** (`classes` table): admin schedules single or recurring (series) classes for one teacher + one student, with conflict checks; a Daily.co room is created per class; join opens 5 min before start; teacher marks attendance (Daily join/leave evidence assists); students can request cancellation; notifications are in-app (email not connected).
- **Learning Materials** (`curriculum_*` tables): Course > Module > "Curriculum Class" (lesson) > Materials (files in private R2, or links; versioned). Admin-only UI today; teacher module access is stored but not yet consumed. Do not confuse "Curriculum Classes" with live "Classes".
- **Not yet built (schema/nav placeholders only)**: homework, credits, tickets, certificates, reports, settings/audit APIs, email delivery, admin attendance page, teacher/student learning-material views.
- **Current API surface**: see `backend/AGENTS.md` (endpoint + permission table). **Routes/pages**: see `frontend/AGENTS.md`. **Schema**: `backend/migrations/AGENT_CONTEXT.md`.

## Documentation Map

Tracked in git (visible to everyone): `AGENTS.md` (this), `CLAUDE.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`.

Local-only, git-ignored by design (`**/AGENT_CONTEXT.md`, `docs/`, `backend/docs/`, `ui_Designs/`, checklists, `project_doc`):

| File | Covers |
|---|---|
| `backend/migrations/AGENT_CONTEXT.md` | Every table/enum/migration, migration rules and numbering quirks |
| `backend/src/modules/learningMaterials/AGENT_CONTEXT.md` | Curriculum feature end to end (API, R2, frontend) |
| `backend/src/modules/notifications/AGENT_CONTEXT.md` | In-app notifications, email templates/rules, cancellation requests |
| `backend/src/modules/daily/AGENT_CONTEXT.md` | Daily.co lifecycle, join rules, webhook |
| `frontend/src/app/features/classes/AGENT_CONTEXT.md` | Live class scheduling rules, timezones, APIs |
| `frontend/src/app/features/users/AGENT_CONTEXT.md` | Admin user management |
| `frontend/src/app/features/roles/AGENT_CONTEXT.md` | Roles & permissions matrix |
| `frontend/src/app/features/attendance/AGENT_CONTEXT.md` | Teacher attendance verification |
| `frontend/src/app/features/learning-materials/AGENT_CONTEXT.md` | Frontend pointer for curriculum pages |
| `docs/RENDER_DEPLOYMENT_GUIDE.md`, `docs/CLOUDFLARE_R2_SETUP_GUIDE.md` | Deployment and R2 setup |
| `backend/docs/SchooliEdu_API_Guide.md`, `backend/docs/DAILY_CO_SETUP_AND_MIGRATION.md` | Older API guide / Daily notes (partly stale) |
| `backend/BACKEND_CHECKLIST.md`, `frontend/FRONTEND_CHECKLIST.md` | Historical progress checklists (outdated) |

Keep docs current: when you change behaviour described in one of these files, update it in the same change. Trust code over docs if they disagree, then fix the doc. Because `AGENT_CONTEXT.md` files are not committed, a fresh clone will not have them.
