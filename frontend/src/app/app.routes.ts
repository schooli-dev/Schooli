import { Routes } from '@angular/router';
import { AdminClassesComponent } from './features/classes/admin-classes.component';
import { StudentClassesComponent } from './features/classes/student-classes.component';
import { TeacherClassesComponent } from './features/classes/teacher-classes.component';
import { AdminUsersComponent } from './features/users/admin-users.component';
import { AdminRolesComponent } from './features/roles/admin-roles.component';
import { LoginPageComponent } from './features/auth/login-page.component';
import { ChangePasswordPageComponent } from './features/auth/change-password-page.component';
import { AdminDashboardComponent } from './features/dashboards/admin-dashboard.component';
import { StudentDashboardComponent } from './features/dashboards/student-dashboard.component';
import { TeacherDashboardComponent } from './features/dashboards/teacher-dashboard.component';
import { AppShellComponent } from './shared/app-shell.component';
import { authGuard, loginRedirectGuard } from './core/auth/auth.guard';
import { RoleRedirectComponent } from './core/auth/role-redirect.component';
import { ErrorPageComponent } from './features/errors/error-page/error-page.component';

export const routes: Routes = [
  {
    path: '401',
    component: ErrorPageComponent,
    title: 'Unauthorized | SchooliEdu',
    data: {
      errorPage: {
        code: '401',
        eyebrow: 'Unauthorized',
        title: 'Sign in to continue',
        message: 'Your session is missing or has expired. Sign in again to access your SchooliEdu workspace.',
        icon: 'bi-shield-lock',
        tone: 'warning'
      }
    }
  },
  {
    path: '403',
    component: ErrorPageComponent,
    title: 'Access Denied | SchooliEdu',
    data: {
      errorPage: {
        code: '403',
        eyebrow: 'Access denied',
        title: 'This area is not available for your role',
        message: 'Your account does not have permission to open this page. Use your dashboard or ask an admin to update your access.',
        icon: 'bi-person-lock',
        tone: 'danger'
      }
    }
  },
  {
    path: '404',
    component: ErrorPageComponent,
    title: 'Page Not Found | SchooliEdu',
    data: {
      errorPage: {
        code: '404',
        eyebrow: 'Page not found',
        title: 'That page is not in this workspace',
        message: 'The link may be outdated, mistyped, or moved. Head back to your dashboard and continue from there.',
        icon: 'bi-compass',
        tone: 'info'
      }
    }
  },
  {
    path: 'error',
    component: ErrorPageComponent,
    title: 'Error | SchooliEdu',
    data: {
      errorPage: {
        code: '500',
        eyebrow: 'Unexpected error',
        title: 'Something did not load correctly',
        message: 'Please retry the action. If it still fails, contact support with the page and time of the issue.',
        icon: 'bi-exclamation-octagon',
        tone: 'danger'
      }
    }
  },
  {
    path: 'login',
    component: LoginPageComponent,
    canActivate: [loginRedirectGuard],
    title: 'Sign in | SchooliEdu'
  },
  {
    path: 'change-password',
    component: ChangePasswordPageComponent,
    canActivate: [authGuard],
    title: 'Change Password | SchooliEdu'
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', component: RoleRedirectComponent },
      {
        path: 'admin/dashboard',
        component: AdminDashboardComponent,
        canActivate: [authGuard],
        data: { permission: 'report.view' },
        title: 'Admin Dashboard | SchooliEdu'
      },
      {
        path: 'admin/classes',
        component: AdminClassesComponent,
        canActivate: [authGuard],
        data: { permission: 'class.view' },
        title: 'Classes | SchooliEdu'
      },
      {
        path: 'admin/users',
        component: AdminUsersComponent,
        canActivate: [authGuard],
        data: { permission: 'user.view' },
        title: 'User Management | SchooliEdu'
      },
      {
        path: 'admin/roles',
        component: AdminRolesComponent,
        canActivate: [authGuard],
        data: { permission: 'role.view' },
        title: 'Roles & Permissions | SchooliEdu'
      },
      {
        path: 'teacher/dashboard',
        component: TeacherDashboardComponent,
        canActivate: [authGuard],
        data: { roles: ['teacher'], permission: 'class.view' },
        title: 'Teacher Dashboard | SchooliEdu'
      },
      {
        path: 'teacher/classes',
        component: TeacherClassesComponent,
        canActivate: [authGuard],
        data: { roles: ['teacher'], permission: 'class.view' },
        title: 'My Classes | SchooliEdu'
      },
      {
        path: 'teacher/attendance',
        loadComponent: () =>
          import('./features/attendance/teacher-attendance/teacher-attendance.component').then(
            (module) => module.TeacherAttendanceComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['teacher'], permission: 'attendance.view' },
        title: 'Attendance | SchooliEdu'
      },
      {
        path: 'teacher/classes/:id/room',
        loadComponent: () =>
          import('./features/classes/classroom/classroom.component').then((module) => module.ClassroomComponent),
        canActivate: [authGuard],
        data: { roles: ['teacher'], permission: 'class.join' },
        title: 'Live Classroom | SchooliEdu'
      },
      {
        path: 'student/dashboard',
        component: StudentDashboardComponent,
        canActivate: [authGuard],
        data: { roles: ['student'], permission: 'class.view' },
        title: 'Student Dashboard | SchooliEdu'
      },
      {
        path: 'student/classes',
        component: StudentClassesComponent,
        canActivate: [authGuard],
        data: { roles: ['student'], permission: 'class.view' },
        title: 'My Classes | SchooliEdu'
      },
      {
        path: 'student/classes/:id/room',
        loadComponent: () =>
          import('./features/classes/classroom/classroom.component').then((module) => module.ClassroomComponent),
        canActivate: [authGuard],
        data: { roles: ['student'], permission: 'class.join' },
        title: 'Live Classroom | SchooliEdu'
      }
    ]
  },
  { path: '**', redirectTo: '404' }
];
