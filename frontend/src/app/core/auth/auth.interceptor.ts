import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthTokenService } from './auth-token.service';

let refreshRequest$: Observable<string | null> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(AuthTokenService);
  const authApi = inject(AuthApiService);
  const router = inject(Router);
  const token = tokens.getAccessToken();

  if (!token || !isApiRequest(req.url)) {
    return next(req);
  }

  const authenticatedRequest = shouldAttachAccessToken(req)
    ? withAccessToken(req, token)
    : req;

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!shouldRefreshAccessToken(error, req, tokens)) {
        return throwError(() => error);
      }

      refreshRequest$ ??= authApi.refreshSession().pipe(
        catchError((refreshError: HttpErrorResponse) => {
          tokens.clear();
          void router.navigate(['/login'], { skipLocationChange: true });
          return throwError(() => refreshError);
        }),
        finalize(() => {
          refreshRequest$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );

      return refreshRequest$.pipe(
        switchMap((newToken) => {
          if (!newToken) {
            tokens.clear();
            void router.navigate(['/login'], { skipLocationChange: true });
            return throwError(() => error);
          }

          return next(withAccessToken(req, newToken));
        })
      );
    })
  );
};

function isApiRequest(url: string): boolean {
  return url.startsWith('/api') || url.includes('/api/');
}

function shouldAttachAccessToken(req: HttpRequest<unknown>): boolean {
  return !isPublicAuthRequest(req.url);
}

function shouldRefreshAccessToken(error: HttpErrorResponse, req: HttpRequest<unknown>, tokens: AuthTokenService): boolean {
  return (
    error.status === 401 &&
    isApiRequest(req.url) &&
    !isPublicAuthRequest(req.url) &&
    Boolean(tokens.getRefreshToken())
  );
}

function isPublicAuthRequest(url: string): boolean {
  return [
    '/auth/login',
    '/auth/refresh',
    '/auth/logout',
    '/auth/forgot-password',
    '/auth/reset-password'
  ].some((path) => url.includes(path));
}

function withAccessToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}
