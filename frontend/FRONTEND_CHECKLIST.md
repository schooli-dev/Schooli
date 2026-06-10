# SchooliEdu Frontend Checklist

## Current Access

- Local frontend dev URL: `http://localhost:4200`
- Backend API through Angular proxy: `/api`
- Backend Swagger UI through proxy: `http://localhost:4200/api/docs`

## Completed

- [x] Angular project scaffolded in separate `frontend` folder
- [x] Routing enabled
- [x] SCSS styling enabled
- [x] Angular HTTP client configured
- [x] Bearer token HTTP interceptor added
- [x] Auth token local storage service added
- [x] Shared API response models added
- [x] Shared API client service added
- [x] Local API proxy config added
- [x] Starter Phase 1 shell route added
- [x] Production build verified
- [x] Shared Academic Precision theme tokens added
- [x] Responsive role-based app shell added
- [x] Login page UI added
- [x] Admin dashboard UI added
- [x] Admin classes table UI added with horizontal mobile scrolling
- [x] Responsive schedule class wizard UI added
- [x] Student dashboard UI added
- [x] Student my classes UI added
- [x] Teacher dashboard UI added
- [x] Teacher my classes UI added
- [x] Teacher meeting detail drawer UI added
- [x] Angular backend proxy config created at `proxy.conf.json`
- [x] Login page wired to `POST /api/auth/login`
- [x] Admin classes table wired to `GET /api/classes`
- [x] Schedule class modal wired to `GET /api/teachers`, `GET /api/students`, and `POST /api/classes`
- [x] Admin classes API fallback state added for backend/DB downtime
- [x] Sidebar icon rendering fixed
- [x] Login hero overlap/responsiveness fixed
- [x] Bootstrap installed and imported globally
- [x] Runtime app details loader added before Angular startup
- [x] API client now uses backend-provided absolute API base URL
- [x] Auth guard added
- [x] Role-based login redirect added
- [x] Sidebar pages loaded from `GET /api/navigation/pages`
- [x] Frontend API Docs link removed
- [x] Student sidebar duplicate pages fixed through role-scoped navigation
- [x] Student dashboard layout tightened for desktop, tablet, and mobile
- [x] Shared logout action wired for all portals
- [x] Header Add button removed from shared shell
- [x] SVG sidebar icons added for navigation items
- [x] Global centered API loader added through HTTP interceptor
- [x] Admin class status tabs wired to filter records
- [x] Global loader simplified to icon-only responsive spinner
- [x] Login password show/hide eye toggle added
- [x] Teacher classes page wired to backend classes API
- [x] Student classes page wired to backend classes API
- [x] Teacher/student Zoom join buttons wired to class join API
- [x] Topbar search icon added
- [x] Mobile topbar brand and hamburger icon added
- [x] Profile dropdown added with name, role, email, phone, view more, and logout
- [x] Teacher next-class text contrast fixed
- [x] Admin schedule class overlay moved away from Bootstrap backdrop class
- [x] Bootstrap pagination added to admin, teacher, and student class lists
- [x] Admin dashboard wired to real backend stats API
- [x] Admin user management page added
- [x] User management filters wired to `/api/users`
- [x] User details and role assignment dialog wired to user and roles APIs
- [x] User deactivation confirmation wired to status API
- [x] User dialog roles shown in two-column checkbox layout
- [x] Teacher availability and support ticket stats shown in user dialog when relevant
- [x] Create User flow added without admin role option
- [x] Current admin self-management actions disabled in user management
- [x] Create User required-field, email, phone, and strong-password validation added
- [x] Auto-generate password option added to Create User
- [x] Teacher availability fields added to Create User role-specific flow
- [x] Roles tab simplified to checkbox plus role name layout
- [x] Login lock icon and password visibility icon behavior fixed
- [x] Create User name and username validation added
- [x] Teacher working-days selector simplified to normal checkboxes
- [x] Admin roles and permissions page added
- [x] Create/edit/view role drawer added with permission grouping
- [x] Role creation requires at least one selected permission

## To Do Next

- [x] Add provided Phase 1 UI screens/assets
- [x] Wire login page to backend auth API
- [ ] Wire dashboards to backend API data
- [x] Build user management UI
- [ ] Build teacher/student assignment UI
- [ ] Build teacher availability UI
- [x] Wire schedule class form submit to backend APIs
- [ ] Wire student class list and Zoom join UI to backend APIs
- [ ] Build attendance marking UI
- [ ] Build cancellation request UI
- [ ] Build email template and notification manager UI

## Phase 1 Boundaries

- [x] Keep frontend focused on backend APIs already implemented
- [x] Defer parent role UI
- [x] Defer payments UI
- [x] Defer full Zoom embedded SDK UI until Meeting SDK keys are configured
