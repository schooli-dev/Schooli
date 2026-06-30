import { Injectable } from '@angular/core';

const ACCESS_TOKEN_KEY = 'schooliedu.accessToken';
const REFRESH_TOKEN_KEY = 'schooliedu.refreshToken';
const USER_KEY = 'schooliedu.user';
const MUST_CHANGE_PASSWORD_KEY = 'schooliedu.mustChangePassword';

export type AuthUser = {
  id: string;
  username: string | null;
  email: string;
  phone?: string | null;
  timezone?: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
};

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  getAccessToken(): string | null {
    return this.read(ACCESS_TOKEN_KEY);
  }

  setSession(accessToken: string, refreshToken: string, user: AuthUser, remember = true, mustChangePassword = false): void {
    this.clear();
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    storage.setItem(USER_KEY, JSON.stringify(user));
    storage.setItem(MUST_CHANGE_PASSWORD_KEY, String(mustChangePassword));
  }

  setTokens(accessToken: string, refreshToken: string): void {
    const storage = this.activeStorage();
    storage.setItem(ACCESS_TOKEN_KEY, accessToken);
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  getUser(): AuthUser | null {
    const raw = this.read(USER_KEY);

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
    return this.read(REFRESH_TOKEN_KEY);
  }

  mustChangePassword(): boolean {
    return this.read(MUST_CHANGE_PASSWORD_KEY) === 'true';
  }

  setMustChangePassword(value: boolean): void {
    this.activeStorage().setItem(MUST_CHANGE_PASSWORD_KEY, String(value));
  }

  clear(): void {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(ACCESS_TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
      storage.removeItem(USER_KEY);
      storage.removeItem(MUST_CHANGE_PASSWORD_KEY);
    }
  }

  private read(key: string): string | null {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  }

  private activeStorage(): Storage {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY) ? localStorage : sessionStorage;
  }
}
