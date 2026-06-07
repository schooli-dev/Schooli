import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthTokenService } from './auth-token.service';

const defaultRouteByRole: Record<string, string> = {
  admin: '/admin/dashboard',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard'
};

export const authGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const tokens = inject(AuthTokenService);
  const router = inject(Router);

  if (!tokens.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  const allowedRoles = route.data['roles'] as string[] | undefined;
  const requiredPermission = route.data['permission'] as string | undefined;

  if (allowedRoles?.length && !allowedRoles.some((role) => tokens.getRoles().includes(role))) {
    return router.createUrlTree([getDefaultRoute(tokens.getRoles())]);
  }

  if (requiredPermission && !tokens.getPermissions().includes(requiredPermission)) {
    return router.createUrlTree([getDefaultRoute(tokens.getRoles())]);
  }

  return true;
};

export const loginRedirectGuard: CanActivateFn = (): boolean | UrlTree => {
  const tokens = inject(AuthTokenService);
  const router = inject(Router);

  if (!tokens.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([getDefaultRoute(tokens.getRoles())]);
};

function getDefaultRoute(roles: string[]): string {
  for (const role of roles) {
    if (defaultRouteByRole[role]) {
      return defaultRouteByRole[role];
    }
  }

  return '/login';
}
