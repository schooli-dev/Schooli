import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthTokenService } from './auth-token.service';
import { getDefaultRoute } from './auth.guard';

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
    void this.router.navigateByUrl(getDefaultRoute(this.tokens.getRoles(), this.tokens.getPermissions()), {
      skipLocationChange: true
    });
  }
}
