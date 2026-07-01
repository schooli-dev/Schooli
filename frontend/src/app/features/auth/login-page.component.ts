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
  protected identifier = '';
  protected password = '';
  protected rememberMe = true;
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
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
          void this.router.navigateByUrl(nextRoute, { skipLocationChange: true });
        },
        error: () => {
          this.error.set('Login failed. Check your credentials and ensure the backend is running.');
        }
      });
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }
}
