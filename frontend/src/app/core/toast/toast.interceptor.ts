import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { ToastService } from './toast.service';

type MaybeApiResponse = {
  success?: boolean;
  message?: string;
};

export const toastInterceptor: HttpInterceptorFn = (req, next) => {
  const toasts = inject(ToastService);

  if (!isApiRequest(req.url) || isSilentRequest(req.url)) {
    return next(req);
  }

  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        const body = event.body as MaybeApiResponse | null;
        if (body?.message) {
          toasts.show(body.message, body.success === false ? 'error' : successTone(req.method));
        }
      }
    }),
    catchError((error: HttpErrorResponse) => {
      const message = error.error?.message || error.error?.error?.message || error.message || 'Request failed';
      toasts.error(message);
      return throwError(() => error);
    })
  );
};

function successTone(method: string) {
  return method.toUpperCase() === 'GET' ? 'info' : 'success';
}

function isApiRequest(url: string): boolean {
  return url.startsWith('/api') || url.includes('/api/');
}

function isSilentRequest(url: string): boolean {
  return url.includes('/auth/refresh');
}
