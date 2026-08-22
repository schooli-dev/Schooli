import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { RuntimeConfigService } from './core/config/runtime-config.service';
import { loadingInterceptor } from './core/loading/loading.interceptor';
import { toastInterceptor } from './core/toast/toast.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAppInitializer(() => {
      // The generated fallback API URL is immediately usable; refresh details without blocking first paint.
      void inject(RuntimeConfigService).load();
    }),
    provideHttpClient(withInterceptors([loadingInterceptor, toastInterceptor, authInterceptor])),
    provideRouter(routes)
  ]
};
