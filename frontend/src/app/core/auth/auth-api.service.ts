import { Injectable } from '@angular/core';
import { Observable, catchError, finalize, map, of, tap } from 'rxjs';
import { ApiClientService } from '../api/api-client.service';
import { AuthTokenService } from './auth-token.service';

export type LoginRequest = {
  identifier: string;
  password: string;
  remember?: boolean;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string | null;
    email: string;
    timezone?: string;
    firstName: string;
    lastName: string;
    roles: string[];
    permissions: string[];
  };
  mustChangePassword: boolean;
};

export type ForgotPasswordResponse = {
  resetToken?: string;
  expiresAt?: string;
};

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  constructor(
    private readonly api: ApiClientService,
    private readonly tokens: AuthTokenService
  ) {}

  login(payload: LoginRequest) {
    return this.api.post<LoginResponse>('/auth/login', payload).pipe(
      tap((response) => {
        this.tokens.setSession(
          response.data.accessToken,
          response.data.refreshToken,
          response.data.user,
          payload.remember ?? true,
          response.data.mustChangePassword
        );
      })
    );
  }

  forgotPassword(identifier: string) {
    return this.api.post<ForgotPasswordResponse>('/auth/forgot-password', { identifier });
  }

  resetPassword(token: string, password: string) {
    return this.api.post<null>('/auth/reset-password', { token, password });
  }

  refreshSession(): Observable<string | null> {
    const refreshToken = this.tokens.getRefreshToken();

    if (!refreshToken) {
      return of(null);
    }

    return this.api.post<LoginResponse>('/auth/refresh', { refreshToken }).pipe(
      tap((response) => this.tokens.setTokens(response.data.accessToken, response.data.refreshToken)),
      map((response) => response.data.accessToken)
    );
  }

  changePassword(password: string) {
    return this.api.post<null>('/auth/change-password', { password }).pipe(
      tap(() => this.tokens.setMustChangePassword(false))
    );
  }

  logout() {
    const refreshToken = this.tokens.getRefreshToken();
    const request$: Observable<unknown> = refreshToken ? this.api.post<null>('/auth/logout', { refreshToken }) : of(null);

    return request$.pipe(
      catchError(() => of(null)),
      finalize(() => this.tokens.clear())
    );
  }
}
