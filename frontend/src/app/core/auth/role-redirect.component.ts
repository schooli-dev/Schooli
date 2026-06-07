import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthTokenService } from './auth-token.service';

@Component({
  selector: 'app-role-redirect',
  standalone: true,
  template: ''
})
export class RoleRedirectComponent implements OnInit {
  constructor(
    private readonly tokens: AuthTokenService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const roles = this.tokens.getRoles();

    if (roles.includes('admin')) {
      void this.router.navigateByUrl('/admin/dashboard');
      return;
    }

    if (roles.includes('teacher')) {
      void this.router.navigateByUrl('/teacher/dashboard');
      return;
    }

    if (roles.includes('student')) {
      void this.router.navigateByUrl('/student/dashboard');
      return;
    }

    void this.router.navigateByUrl('/login');
  }
}
