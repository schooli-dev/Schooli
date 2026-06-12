import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { getDefaultRoute } from '../../core/auth/auth.guard';
import { AuthTokenService } from '../../core/auth/auth-token.service';

@Component({
  selector: 'app-change-password-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './change-password-page.component.html',
  styleUrl: './change-password-page.component.scss'
})
export class ChangePasswordPageComponent {
  protected newPassword = '';
  protected confirmPassword = '';
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  constructor(
    private readonly authApi: AuthApiService,
    private readonly tokens: AuthTokenService,
    private readonly router: Router
  ) {}

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected submit(): void {
    this.error.set('');

    if (!this.isStrongPassword()) {
      this.error.set('Password must include uppercase, lowercase, number, special character, and be at least 8 characters.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.authApi
      .changePassword(this.newPassword)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(getDefaultRoute(this.tokens.getRoles(), this.tokens.getPermissions()), {
            skipLocationChange: true
          });
        },
        error: () => {
          this.error.set('Could not update password. Please try again.');
        }
      });
  }

  private isStrongPassword(): boolean {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/.test(this.newPassword);
  }
}
