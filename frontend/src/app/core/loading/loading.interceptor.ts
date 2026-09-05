import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from './loading.service';

/** Marks background API calls that must not interrupt the user with the global loader. */
export const SKIP_GLOBAL_LOADER = new HttpContextToken<boolean>(() => false);

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loader = inject(LoadingService);

  if (!isApiRequest(req.url) || req.context.get(SKIP_GLOBAL_LOADER)) {
    return next(req);
  }

  loader.start();

  return next(req).pipe(finalize(() => loader.stop()));
};

function isApiRequest(url: string): boolean {
  return url.startsWith('/api') || url.includes('/api/');
}
