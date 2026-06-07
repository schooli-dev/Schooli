import { Injectable } from '@angular/core';

const ACCESS_TOKEN_KEY = 'schooliedu.accessToken';
const REFRESH_TOKEN_KEY = 'schooliedu.refreshToken';
const USER_KEY = 'schooliedu.user';

export type AuthUser = {
  id: string;
  username: string | null;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
};

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  setSession(accessToken: string, refreshToken: string, user: AuthUser): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  getUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      this.clear();
      return null;
    }
  }

  getRoles(): string[] {
    return this.getUser()?.roles ?? [];
  }

  getPermissions(): string[] {
    return this.getUser()?.permissions ?? [];
  }

  isAuthenticated(): boolean {
    return Boolean(this.getAccessToken());
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
