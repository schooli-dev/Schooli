import { Routes } from '@angular/router';
import { AdminClassesComponent } from './features/classes/admin-classes.component';
import { ClassroomComponent } from './features/classes/classroom.component';
import { StudentClassesComponent } from './features/classes/student-classes.component';
import { TeacherClassesComponent } from './features/classes/teacher-classes.component';
import { AdminUsersComponent } from './features/users/admin-users.component';
import { AdminRolesComponent } from './features/roles/admin-roles.component';
import { LoginPageComponent } from './features/auth/login-page.component';
import { AdminDashboardComponent } from './features/dashboards/admin-dashboard.component';
import { StudentDashboardComponent } from './features/dashboards/student-dashboard.component';
import { TeacherDashboardComponent } from './features/dashboards/teacher-dashboard.component';
import { AppShellComponent } from './shared/app-shell.component';
import { authGuard, loginRedirectGuard } from './core/auth/auth.guard';
import { RoleRedirectComponent } from './core/auth/role-redirect.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPageComponent,
    canActivate: [loginRedirectGuard],
    title: 'Sign in | SchooliEdu'
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
        data: { roles: ['admin'], permission: 'report.view' },
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
        data: { roles: ['admin'], permission: 'user.view' },
        title: 'User Management | SchooliEdu'
      },
      {
        path: 'admin/roles',
        component: AdminRolesComponent,
        canActivate: [authGuard],
        data: { roles: ['admin'], permission: 'role.view' },
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
        path: 'teacher/classes/:id/room',
        component: ClassroomComponent,
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
        component: ClassroomComponent,
        canActivate: [authGuard],
        data: { roles: ['student'], permission: 'class.join' },
        title: 'Live Classroom | SchooliEdu'
      }
    ]
  }
];
