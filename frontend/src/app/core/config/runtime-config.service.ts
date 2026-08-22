import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export type AppDetails = {
  appName: string;
  service: string;
  environment: string;
  apiBaseUrl: string;
  docsUrl: string;
  healthUrl: string;
};

type AppDetailsResponse = {
  success: boolean;
  message: string;
  data: AppDetails;
};

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private readonly details = signal<AppDetails>({
    appName: 'SchooliEdu',
    service: 'schooliedu-backend',
    environment: environment.production ? 'production' : 'development',
    apiBaseUrl: environment.fallbackApiBaseUrl,
    docsUrl: `${environment.fallbackApiBaseUrl}/docs`,
    healthUrl: `${environment.fallbackApiBaseUrl}/health`
  });

  readonly isLoaded = signal(false);

  get appDetails(): AppDetails {
    return this.details();
  }

  get apiBaseUrl(): string {
    return this.details().apiBaseUrl.replace(/\/$/, '');
  }

  async load(): Promise<void> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(environment.apiDetailsUrl, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`App details failed with ${response.status}`);
      }

      const payload = (await response.json()) as AppDetailsResponse;
      this.details.set(payload.data);
    } catch {
      this.details.update((value) => ({
        ...value,
        apiBaseUrl: environment.fallbackApiBaseUrl
      }));
    } finally {
      window.clearTimeout(timeoutId);
      this.isLoaded.set(true);
    }
  }
}
