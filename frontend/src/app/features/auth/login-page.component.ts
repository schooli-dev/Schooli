import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  template: `
  <main class="login-page min-vh-100">
    <div class="container-fluid min-vh-100">
      <div class="row min-vh-100">

        <!-- Left Brand / Hero Section -->
        <section class="col-lg-7 d-none d-lg-flex login-hero text-white">
          <div class="hero-content w-100 d-flex flex-column justify-content-between">

            <div>
              <div class="d-flex align-items-center gap-3 mb-5">
                <div class="brand-mark">S</div>
                <span class="fs-4 fw-bold">Schooli</span>
              </div>

              <div class="hero-copy">
                <span class="badge rounded-pill text-bg-light text-primary px-3 py-2 mb-4">
                  Learning Management Platform
                </span>

                <h1 class="display-5 fw-bold mb-3">
                  The platform built for serious learning.
                </h1>

                <p class="lead text-white-50 mb-4">
                  Live classes, homework, attendance, and progress — managed from one unified dashboard.
                </p>

                <div class="row g-3 mt-4">
                  <div class="col-md-6">
                    <div class="feature-card">
                      <div class="feature-icon">✓</div>
                      <div>
                        <h3 class="h6 mb-1">Live Classes</h3>
                        <p class="small mb-0 text-white-50">Zoom class integration</p>
                      </div>
                    </div>
                  </div>

                  <div class="col-md-6">
                    <div class="feature-card">
                      <div class="feature-icon">✓</div>
                      <div>
                        <h3 class="h6 mb-1">Progress Tracking</h3>
                        <p class="small mb-0 text-white-50">Homework and reports</p>
                      </div>
                    </div>
                  </div>

                  <div class="col-md-6">
                    <div class="feature-card">
                      <div class="feature-icon">✓</div>
                      <div>
                        <h3 class="h6 mb-1">Role Dashboards</h3>
                        <p class="small mb-0 text-white-50">Admin, teacher, student</p>
                      </div>
                    </div>
                  </div>

                  <div class="col-md-6">
                    <div class="feature-card">
                      <div class="feature-icon">✓</div>
                      <div>
                        <h3 class="h6 mb-1">Secure Access</h3>
                        <p class="small mb-0 text-white-50">Protected login system</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="hero-bottom-card mt-5">
              <div class="d-flex align-items-center justify-content-between">
                <div>
                  <p class="small text-white-50 mb-1">Today’s overview</p>
                  <h3 class="h6 mb-0">Classes, users, and progress in one place</h3>
                </div>
                <span class="badge rounded-pill bg-success-subtle text-success-emphasis">
                  Active
                </span>
              </div>
            </div>

          </div>
        </section>

        <!-- Login Section -->
        <section class="col-12 col-lg-5 login-panel d-flex align-items-center justify-content-center">
          <div class="login-wrapper w-100">

            <!-- Mobile Logo -->
            <div class="d-flex d-lg-none align-items-center justify-content-center gap-3 mb-4">
              <div class="brand-mark mobile">S</div>
              <span class="fs-4 fw-bold text-dark">Schooli</span>
            </div>

            <form
              class="card auth-card border-0 shadow-lg"
              #loginForm="ngForm"
              (ngSubmit)="submit()"
              novalidate
            >
              <div class="card-body p-4 p-sm-5">

                <div class="text-center mb-4">
                  <div class="lock-circle mx-auto mb-3">
                    <i class="bi bi-shield-lock"></i>
                  </div>

                  <h2 class="fw-bold mb-2">Welcome back</h2>
                  <p class="text-muted mb-0">
                    Sign in to continue to your dashboard
                  </p>
                </div>

                <div class="mb-3">
                  <label for="identifier" class="form-label fw-semibold">
                    Email or Username
                  </label>

                  <input
                    id="identifier"
                    type="text"
                    class="form-control form-control-lg"
                    name="identifier"
                    [(ngModel)]="identifier"
                    placeholder="Enter email or username"
                    autocomplete="username"
                    required
                  />
                </div>

                <div class="mb-2">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <label for="password" class="form-label fw-semibold mb-0">
                      Password
                    </label>

                    <a href="#" class="small text-decoration-none fw-semibold">
                      Forgot password?
                    </a>
                  </div>

                  <div class="input-group input-group-lg">
                    <input
                      id="password"
                      class="form-control"
                      name="password"
                      [(ngModel)]="password"
                      [type]="showPassword() ? 'text' : 'password'"
                      placeholder="Enter your password"
                      autocomplete="current-password"
                      required
                    />

                    <button
                      class="btn btn-outline-secondary px-3 password-toggle-btn"
                      type="button"
                      [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                      (click)="togglePassword()"
                    >
                      <i
                        class="bi"
                        [class.bi-eye]="!showPassword()"
                        [class.bi-eye-slash]="showPassword()"
                      ></i>
                    </button>
                  </div>
                </div>

                @if (error()) {
                  <div class="alert alert-danger d-flex align-items-start gap-2 mt-4 mb-0" role="alert">
                    <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
                    <span>{{ error() }}</span>
                  </div>
                }

                <button
                  class="btn btn-primary btn-lg w-100 mt-4 fw-bold"
                  type="submit"
                  [disabled]="loginForm.invalid || loading()"
                >
                  @if (loading()) {
                    <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                    Signing in…
                  } @else {
                    Sign In
                  }
                </button>

                <p class="text-center text-muted small mt-4 mb-0">
                  Secure access for all authorised users
                </p>

              </div>
            </form>

          </div>
        </section>

      </div>
    </div>
  </main>
  `,
  styles: `
  :host {
    display: block;
    --login-primary: #2563eb;
    --login-primary-dark: #1d4ed8;
    --login-bg: #f8fafc;
    --login-border: #e2e8f0;
    --login-text: #191b23;
    --login-muted: #64748b;
  }

  .login-page {
    background:
      radial-gradient(circle at top, rgba(37, 99, 235, 0.08), transparent 34%),
      var(--login-bg);
  }

  .login-hero {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 15% 20%, rgba(255, 255, 255, 0.16), transparent 28%),
      linear-gradient(135deg, #004ac6 0%, #2563eb 45%, #7c3aed 100%);
  }

  .login-hero::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.18) 1px, transparent 1px);
    background-size: 30px 30px;
    opacity: 0.45;
  }

  .hero-content {
    position: relative;
    z-index: 1;
    padding: clamp(2rem, 5vw, 4rem);
  }

  .hero-copy {
    max-width: 680px;
  }

  .hero-copy h1 {
    max-width: 620px;
    letter-spacing: -0.04em;
  }

  .hero-copy p {
    max-width: 520px;
  }

  .brand-mark {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: #ffffff;
    color: var(--login-primary);
    font-weight: 900;
    font-size: 1.25rem;
    box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
  }

  .brand-mark.mobile {
    background: var(--login-primary);
    color: #ffffff;
    box-shadow: 0 12px 30px rgba(37, 99, 235, 0.22);
  }

  .feature-card {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    min-height: 84px;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(14px);
  }

  .feature-icon {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
    color: #ffffff;
    font-weight: 800;
  }

  .hero-bottom-card {
    max-width: 560px;
    padding: 1.25rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 1.25rem;
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(16px);
  }

  .login-panel {
    min-height: 100dvh;
    padding: 2rem 1rem;
    background:
      radial-gradient(circle at top, rgba(37, 99, 235, 0.08), transparent 36%),
      #ffffff;
  }

  .login-wrapper {
    max-width: 440px;
  }

  .auth-card {
    border-radius: 1.35rem;
    overflow: hidden;
  }

  .lock-circle {
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #eff6ff;
    color: var(--login-primary);
    font-size: 1.5rem;
  }

  .form-control,
  .btn {
    border-radius: 0.75rem;
  }

  .form-control {
    border-color: var(--login-border);
  }

  .form-control:focus {
    border-color: var(--login-primary);
    box-shadow: 0 0 0 0.25rem rgba(37, 99, 235, 0.16);
  }

  .btn-primary {
    --bs-btn-bg: var(--login-primary);
    --bs-btn-border-color: var(--login-primary);
    --bs-btn-hover-bg: var(--login-primary-dark);
    --bs-btn-hover-border-color: var(--login-primary-dark);
    --bs-btn-disabled-bg: var(--login-primary);
    --bs-btn-disabled-border-color: var(--login-primary);
    min-height: 52px;
  }

  @media (max-width: 991.98px) {
    .login-panel {
      align-items: flex-start !important;
      padding-top: clamp(2rem, 8vh, 4rem);
    }
  }

  @media (max-width: 575.98px) {
    .login-panel {
      padding: 1.25rem;
    }

    .auth-card .card-body {
      padding: 1.5rem !important;
    }

    .lock-circle {
      width: 54px;
      height: 54px;
      font-size: 1.25rem;
    }

    .auth-card h2 {
      font-size: 1.5rem;
    }

    .input-group-lg > .form-control,
    .input-group-lg > .btn,
    .form-control-lg {
      min-height: 48px;
      font-size: 1rem;
    }
  }
  `
})
export class LoginPageComponent {
  protected identifier = 'admin';
  protected password = '';
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
        password: this.password
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          const roles = response.data.user.roles;

          if (roles.includes('teacher')) {
            void this.router.navigateByUrl('/teacher/dashboard');
            return;
          }

          if (roles.includes('student')) {
            void this.router.navigateByUrl('/student/dashboard');
            return;
          }

          void this.router.navigateByUrl('/admin/dashboard');
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
