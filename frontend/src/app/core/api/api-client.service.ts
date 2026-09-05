import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { RuntimeConfigService } from '../config/runtime-config.service';
import type { ApiResponse } from './api-response.model';
import { SKIP_GLOBAL_LOADER } from '../loading/loading.interceptor';

export type ApiRequestOptions = {
  background?: boolean;
};

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  constructor(
    private readonly http: HttpClient,
    private readonly runtimeConfig: RuntimeConfigService
  ) {}

  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
    options?: ApiRequestOptions
  ) {
    return this.http.get<ApiResponse<T>>(this.url(path), {
      params: this.cleanParams(params),
      context: this.requestContext(options)
    });
  }

  post<T>(path: string, body: unknown, options?: ApiRequestOptions) {
    return this.http.post<ApiResponse<T>>(this.url(path), body, { context: this.requestContext(options) });
  }

  patch<T>(path: string, body: unknown, options?: ApiRequestOptions) {
    return this.http.patch<ApiResponse<T>>(this.url(path), body, { context: this.requestContext(options) });
  }

  delete<T>(path: string, options?: ApiRequestOptions) {
    return this.http.delete<ApiResponse<T>>(this.url(path), { context: this.requestContext(options) });
  }

  private url(path: string): string {
    return `${this.runtimeConfig.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private cleanParams(params?: Record<string, string | number | boolean | undefined | null>) {
    if (!params) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, String(value)])
    );
  }

  private requestContext(options?: ApiRequestOptions): HttpContext {
    return options?.background
      ? new HttpContext().set(SKIP_GLOBAL_LOADER, true)
      : new HttpContext();
  }
}
