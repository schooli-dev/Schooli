import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { RuntimeConfigService } from '../config/runtime-config.service';
import type { ApiResponse } from './api-response.model';

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  constructor(
    private readonly http: HttpClient,
    private readonly runtimeConfig: RuntimeConfigService
  ) {}

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>) {
    return this.http.get<ApiResponse<T>>(this.url(path), { params: this.cleanParams(params) });
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<ApiResponse<T>>(this.url(path), body);
  }

  patch<T>(path: string, body: unknown) {
    return this.http.patch<ApiResponse<T>>(this.url(path), body);
  }

  delete<T>(path: string) {
    return this.http.delete<ApiResponse<T>>(this.url(path));
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
}
