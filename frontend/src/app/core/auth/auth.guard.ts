import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthTokenService } from './auth-token.service';

export const authGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const tokens = inject(AuthTokenService);
  const router = inject(Router);

  if (!tokens.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (tokens.mustChangePassword() && state.url !== '/change-password') {
    return router.createUrlTree(['/change-password']);
  }

  const allowedRoles = route.data['roles'] as string[] | undefined;
  const requiredPermission = route.data['permission'] as string | undefined;
  const hasRequiredPermission = !requiredPermission || tokens.getPermissions().includes(requiredPermission);
  const canUseAdminPermissionRoute = state.url.startsWith('/admin/') && Boolean(requiredPermission) && hasRequiredPermission;

  if (allowedRoles?.length && !allowedRoles.some((role) => tokens.getRoles().includes(role)) && !canUseAdminPermissionRoute) {
    return router.createUrlTree([getDefaultRoute(tokens.getRoles(), tokens.getPermissions())]);
  }

  if (!hasRequiredPermission) {
    return router.createUrlTree([getDefaultRoute(tokens.getRoles(), tokens.getPermissions())]);
  }

  return true;
};

export const loginRedirectGuard: CanActivateFn = (): boolean | UrlTree => {
  const tokens = inject(AuthTokenService);
  const router = inject(Router);

  if (!tokens.isAuthenticated()) {
    return true;
  }

  if (tokens.mustChangePassword()) {
    return router.createUrlTree(['/change-password']);
  }

  return router.createUrlTree([getDefaultRoute(tokens.getRoles(), tokens.getPermissions())]);
};

export function getDefaultRoute(roles: string[], permissions: string[] = []): string {
  if (roles.includes('admin')) {
    return '/admin/dashboard';
  }

  if (roles.includes('teacher')) {
    return '/teacher/dashboard';
  }

  if (roles.includes('student')) {
    return '/student/dashboard';
  }

  if (permissions.includes('report.view')) {
    return '/admin/dashboard';
  }

  if (permissions.includes('user.view')) {
    return '/admin/users';
  }

  if (permissions.includes('role.view') || permissions.includes('permission.view') || permissions.includes('settings.update')) {
    return '/admin/roles';
  }

  if (permissions.includes('class.view')) {
    return '/admin/classes';
  }

  return '/login';
}
