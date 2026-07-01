import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthTokenService } from '../../../core/auth/auth-token.service';
import { getDefaultRoute } from '../../../core/auth/auth.guard';

type ErrorPageData = {
  code: string;
  eyebrow: string;
  title: string;
  message: string;
  icon: string;
  tone: 'primary' | 'warning' | 'danger' | 'info';
};

const fallbackPage: ErrorPageData = {
  code: '500',
  eyebrow: 'Something went wrong',
  title: 'We could not complete that request',
  message: 'Please try again in a moment. If the issue continues, contact support with the page you were trying to open.',
  icon: 'bi-exclamation-octagon',
  tone: 'danger'
};

@Component({
  selector: 'app-error-page',
  standalone: true,
  templateUrl: './error-page.component.html',
  styleUrl: './error-page.component.scss'
})
export class ErrorPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tokens = inject(AuthTokenService);

  protected readonly page = computed<ErrorPageData>(() => ({
    ...fallbackPage,
    ...(this.route.snapshot.data['errorPage'] as Partial<ErrorPageData> | undefined)
  }));

  protected readonly isAuthenticated = computed(() => this.tokens.isAuthenticated());
  protected readonly returnUrl = computed(() => this.route.snapshot.queryParamMap.get('returnUrl') ?? '');

  protected goHome(): void {
    const route = this.tokens.isAuthenticated()
      ? getDefaultRoute(this.tokens.getRoles(), this.tokens.getPermissions())
      : '/login';

    void this.router.navigateByUrl(route);
  }
}
