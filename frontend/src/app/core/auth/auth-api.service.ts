import { Injectable } from '@angular/core';
import { Observable, catchError, finalize, of, tap } from 'rxjs';
import { ApiClientService } from '../api/api-client.service';
import { AuthTokenService } from './auth-token.service';

export type LoginRequest = {
  identifier: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string | null;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    permissions: string[];
  };
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
        this.tokens.setSession(response.data.accessToken, response.data.refreshToken, response.data.user);
      })
    );
  }

  forgotPassword(identifier: string) {
    return this.api.post<ForgotPasswordResponse>('/auth/forgot-password', { identifier });
  }

  resetPassword(token: string, password: string) {
    return this.api.post<null>('/auth/reset-password', { token, password });
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
