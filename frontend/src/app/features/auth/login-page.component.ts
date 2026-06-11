import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { getDefaultRoute } from '../../core/auth/auth.guard';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  protected identifier = 'admin';
  protected password = '';
  protected rememberMe = true;
  protected resetIdentifier = '';
  protected resetToken = '';
  protected newPassword = '';
  protected confirmNewPassword = '';
  protected readonly showPassword = signal(false);
  protected readonly showResetPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly resetLoading = signal(false);
  protected readonly resetDialogOpen = signal(false);
  protected readonly resetStep = signal<'request' | 'reset'>('request');
  protected readonly resetTokenFromApi = signal('');
  protected readonly resetMessage = signal('');
  protected readonly resetError = signal('');
  protected readonly error = signal('');

  constructor(
    private readonly auth: AuthApiService,
    private readonly router: Router
  ) {}

  protected submit(): void {
    this.error.set('');
    this.loading.set(true);

    this.auth
      .login({
        identifier: this.identifier,
        password: this.password,
        remember: this.rememberMe
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          const nextRoute = response.data.mustChangePassword
            ? '/change-password'
            : getDefaultRoute(response.data.user.roles, response.data.user.permissions);
          void this.router.navigateByUrl(nextRoute);
        },
        error: () => {
          this.error.set('Login failed. Check your credentials and ensure the backend is running.');
        }
      });
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected toggleResetPassword(): void {
    this.showResetPassword.update((visible) => !visible);
  }

  protected openForgotPassword(): void {
    this.resetIdentifier = this.identifier || '';
    this.resetToken = '';
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.resetStep.set('request');
    this.resetTokenFromApi.set('');
    this.resetMessage.set('');
    this.resetError.set('');
    this.resetDialogOpen.set(true);
  }

  protected closeResetDialog(): void {
    if (this.resetLoading()) {
      return;
    }

    this.resetDialogOpen.set(false);
  }

  protected requestPasswordReset(): void {
    const identifier = this.resetIdentifier.trim();

    if (!identifier) {
      this.resetError.set('Enter your email, username, or phone.');
      return;
    }

    this.resetLoading.set(true);
    this.resetError.set('');
    this.resetMessage.set('');
    this.auth
      .forgotPassword(identifier)
      .pipe(finalize(() => this.resetLoading.set(false)))
      .subscribe({
        next: (response) => {
          const token = response.data.resetToken ?? '';
          this.resetTokenFromApi.set(token);
          this.resetToken = token;
          this.resetStep.set('reset');
          this.resetMessage.set('Reset token generated. Enter a new password to continue.');
        },
        error: () => {
          this.resetError.set('Could not start password reset. Please try again.');
        }
      });
  }

  protected submitPasswordReset(): void {
    this.resetError.set('');
    this.resetMessage.set('');

    if (!this.resetToken.trim()) {
      this.resetError.set('Reset token is required.');
      return;
    }

    if (!this.isStrongResetPassword()) {
      this.resetError.set('Password must include uppercase, lowercase, number, special character, and be at least 8 characters.');
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.resetError.set('Passwords do not match.');
      return;
    }

    this.resetLoading.set(true);
    this.auth
      .resetPassword(this.resetToken.trim(), this.newPassword)
      .pipe(finalize(() => this.resetLoading.set(false)))
      .subscribe({
        next: () => {
          this.password = '';
          this.resetMessage.set('Password reset successful. You can now sign in with the new password.');
          window.setTimeout(() => this.resetDialogOpen.set(false), 1400);
        },
        error: () => {
          this.resetError.set('Password reset failed. Check the token and password rules.');
        }
      });
  }

  private isStrongResetPassword(): boolean {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/.test(this.newPassword);
  }
}
