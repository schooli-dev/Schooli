import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthTokenService } from './auth-token.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthTokenService).getAccessToken();

  if (!token || !isApiRequest(req.url)) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    })
  );
};

function isApiRequest(url: string): boolean {
  return url.startsWith('/api') || url.includes('/api/');
}
