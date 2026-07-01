import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthTokenService } from './auth-token.service';

export const authGuard: CanActivateFn = (route, state): boolean => {
  const tokens = inject(AuthTokenService);
  const router = inject(Router);

  if (!tokens.isAuthenticated()) {
    void router.navigate(['/login'], { queryParams: { returnUrl: state.url }, skipLocationChange: true });
    return false;
  }

  if (tokens.mustChangePassword() && state.url !== '/change-password') {
    void router.navigate(['/change-password'], { skipLocationChange: true });
    return false;
  }

  const allowedRoles = route.data['roles'] as string[] | undefined;
  const requiredPermission = route.data['permission'] as string | undefined;
  const hasRequiredPermission = !requiredPermission || tokens.getPermissions().includes(requiredPermission);
  const canUseAdminPermissionRoute = state.url.startsWith('/admin/') && Boolean(requiredPermission) && hasRequiredPermission;

  if (allowedRoles?.length && !allowedRoles.some((role) => tokens.getRoles().includes(role)) && !canUseAdminPermissionRoute) {
    void router.navigate(['/403'], { queryParams: { returnUrl: state.url }, skipLocationChange: true });
    return false;
  }

  if (!hasRequiredPermission) {
    void router.navigate(['/403'], { queryParams: { returnUrl: state.url }, skipLocationChange: true });
    return false;
  }

  return true;
};

export const loginRedirectGuard: CanActivateFn = (): boolean => {
  const tokens = inject(AuthTokenService);
  const router = inject(Router);

  if (!tokens.isAuthenticated()) {
    return true;
  }

  if (tokens.mustChangePassword()) {
    void router.navigate(['/change-password'], { skipLocationChange: true });
    return false;
  }

  void router.navigateByUrl(getDefaultRoute(tokens.getRoles(), tokens.getPermissions()), { skipLocationChange: true });
  return false;
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
