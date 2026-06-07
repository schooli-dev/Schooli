import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from './loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loader = inject(LoadingService);

  if (!isApiRequest(req.url)) {
    return next(req);
  }

  loader.start();

  return next(req).pipe(finalize(() => loader.stop()));
};

function isApiRequest(url: string): boolean {
  return url.startsWith('/api') || url.includes('/api/');
}
