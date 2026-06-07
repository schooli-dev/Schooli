import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthApiService } from '../core/auth/auth-api.service';
import { AuthTokenService } from '../core/auth/auth-token.service';
import { NavigationApiService, NavigationPage } from '../core/navigation/navigation-api.service';
import { ToastService } from '../core/toast/toast.service';

type ShellRole = 'admin' | 'teacher' | 'student';

const fallbackNavByRole: Record<ShellRole, NavigationPage[]> = {
  admin: [
    page('admin.dashboard', 'Dashboard', '/admin/dashboard', 'grid', 'main', ['report.view']),
    page('classes', 'Classes', '/admin/classes', 'calendar', 'main', ['class.view'])
  ],
  teacher: [
    page('teacher.dashboard', 'Dashboard', '/teacher/dashboard', 'grid', 'main', ['class.view']),
    page('teacher.classes', 'My Classes', '/teacher/classes', 'calendar', 'teaching', ['class.view'])
  ],
  student: [
    page('student.dashboard', 'Dashboard', '/student/dashboard', 'grid', 'main', ['class.view']),
    page('student.classes', 'My Classes', '/student/classes', 'calendar', 'main', ['class.view'])
  ]
};

const sidebarIconClasses: Record<string, string> = {
  grid: 'bi-grid-1x2',
  users: 'bi-people',
  shield: 'bi-shield-check',
  link: 'bi-link-45deg',
  calendar: 'bi-calendar-event',
  date: 'bi-calendar-date',
  check: 'bi-check2-circle',
  credit: 'bi-credit-card',
  ticket: 'bi-ticket-detailed',
  bell: 'bi-bell',
  search: 'bi-search',
  menu: 'bi-list',
  user: 'bi-person',
  mail: 'bi-envelope',
  phone: 'bi-telephone',
  doc: 'bi-file-earmark-text',
  award: 'bi-award',
  chart: 'bi-bar-chart',
  gear: 'bi-gear',
  exit: 'bi-box-arrow-right'
};

const implementedSidebarPaths = new Set([
  '/admin/dashboard',
  '/admin/classes',
  '/admin/users',
  '/admin/roles',
  '/teacher/dashboard',
  '/teacher/classes',
  '/student/dashboard',
  '/student/classes'
]);

function page(
  key: string,
  label: string,
  path: string,
  icon: string,
  section: NavigationPage['section'],
  anyPermissions: string[]
): NavigationPage {
  return { key, label, path, icon, section, anyPermissions, actions: [] };
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="shell-layout">

      <!-- Sidebar -->
      <aside class="app-sidebar" [class.sidebar-open]="menuOpen()">
        <div class="sidebar-brand">
          <div class="brand-mark">S</div>

          <div class="min-w-0">
            <strong class="d-block text-truncate">Schooli</strong>
            <span class="d-block text-uppercase">{{ roleLabel() }}</span>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Primary navigation">
          @for (item of navItems(); track item.path) {
            <a
              class="sidebar-link"
              [href]="item.path"
              [class.is-active]="isActivePath(item.path)"
              (click)="handleSidebarNavigation($event, item)"
            >
              <span class="nav-icon" aria-hidden="true">
                <i class="bi" [ngClass]="iconClass(item.icon)"></i>
              </span>

              <span class="link-label text-truncate">{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <button class="sidebar-link" type="button" (click)="showComingSoon('Settings')">
            <span class="nav-icon" aria-hidden="true">
              <i class="bi bi-gear"></i>
            </span>
            <span class="link-label">Settings</span>
          </button>

          <button class="sidebar-link logout-link" type="button" (click)="logout()">
            <span class="nav-icon" aria-hidden="true">
              <i class="bi bi-box-arrow-right"></i>
            </span>
            <span class="link-label">Logout</span>
          </button>
        </div>
      </aside>

      @if (menuOpen()) {
        <button class="sidebar-scrim" type="button" aria-label="Close menu" (click)="closeMenu()"></button>
      }

      <!-- Main Area -->
      <main class="shell-main">

        <!-- Topbar -->
        <header class="app-topbar">

          <div class="mobile-brand">
            <button class="btn icon-only-btn" type="button" aria-label="Open menu" (click)="toggleMenu()">
              <i class="bi bi-list"></i>
            </button>

            <div class="brand-mark mobile">S</div>

            <strong class="text-truncate">Schooli</strong>
          </div>

          <label class="top-search">
            <i class="bi bi-search"></i>
            <input [placeholder]="searchPlaceholder()" />
          </label>

          <div class="topbar-actions">
            <button class="avatar-btn" type="button" aria-label="Open profile menu" (click)="toggleProfile()">
              {{ userInitials() }}
            </button>

            @if (profileOpen()) {
              <section class="profile-menu shadow-lg">

                <div class="profile-main">
                  <span class="profile-avatar">{{ userInitials() }}</span>

                  <div class="min-w-0">
                    <strong class="d-block text-truncate" [title]="fullName()">{{ fullName() }}</strong>
                    <span class="role-pill">{{ roleLabelShort() }}</span>
                  </div>
                </div>

                <div class="profile-info-row">
                  <span class="profile-info-icon">
                    <i class="bi bi-envelope"></i>
                  </span>
                  <span class="text-truncate" [title]="userEmail()">{{ userEmail() }}</span>
                </div>

                <div class="profile-info-row">
                  <span class="profile-info-icon">
                    <i class="bi bi-telephone"></i>
                  </span>
                  <span class="text-truncate">{{ userPhone() }}</span>
                </div>

                <button class="btn btn-outline-primary btn-sm fw-bold w-100" type="button">
                  <i class="bi bi-person-lines-fill me-1"></i>
                  View More
                </button>

                <button class="profile-logout" type="button" (click)="logout()">
                  <i class="bi bi-box-arrow-right"></i>
                  Logout
                </button>
              </section>
            }
          </div>
        </header>

        <section class="page-frame">
          <router-outlet />
        </section>

      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100dvh;
      max-width: 100%;
      overflow: hidden;
    }

    .shell-layout {
      width: 100%;
      height: 100dvh;
      display: grid;
      grid-template-columns: 270px minmax(0, 1fr);
      background: var(--color-bg);
      overflow: hidden;
    }

    .min-w-0 {
      min-width: 0;
    }

    .app-sidebar {
      position: sticky;
      top: 0;
      z-index: 1040;
      height: 100dvh;
      max-height: 100dvh;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--color-border);
      background:
        linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
      padding: 18px 16px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .app-sidebar::-webkit-scrollbar {
      width: 6px;
    }

    .app-sidebar::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: rgba(100, 116, 139, 0.28);
    }

    .sidebar-brand {
      min-height: 54px;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 22px;
      padding: 6px;
      flex-shrink: 0;
    }

    .brand-mark {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      flex: 0 0 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
      color: #ffffff;
      font-weight: 900;
      font-size: 18px;
      box-shadow: 0 12px 28px rgba(37, 99, 235, 0.24);
    }

    .brand-mark.mobile {
      width: 36px;
      height: 36px;
      flex-basis: 36px;
      border-radius: 11px;
      font-size: 15px;
    }

    .sidebar-brand strong {
      color: var(--color-text);
      font-size: 18px;
      line-height: 1.1;
    }

    .sidebar-brand span {
      margin-top: 3px;
      color: var(--color-muted);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
    }

    .sidebar-nav {
      display: grid;
      gap: 6px;
      min-height: 0;
    }

    .sidebar-link {
      min-height: 46px;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 0;
      border-radius: 14px;
      background: transparent;
      color: var(--color-text-soft);
      padding: 0 12px;
      font-weight: 800;
      text-align: left;
      text-decoration: none;
      transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
    }

    .sidebar-link:hover {
      background: rgba(37, 99, 235, 0.08);
      color: var(--color-primary);
      transform: translateX(2px);
    }

    .sidebar-link.is-active {
      background: var(--color-primary);
      color: #ffffff;
      box-shadow: 0 14px 32px rgba(37, 99, 235, 0.22);
    }

    .nav-icon {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      flex: 0 0 32px;
      border-radius: 11px;
      background: color-mix(in srgb, currentColor 10%, transparent);
      color: currentColor;
      font-size: 17px;
    }

    .link-label {
      min-width: 0;
    }

    .sidebar-footer {
      display: grid;
      gap: 6px;
      margin-top: auto;
      border-top: 1px solid var(--color-border-soft);
      padding-top: 16px;
      flex-shrink: 0;
    }

    .logout-link {
      width: 100%;
      cursor: pointer;
    }

    .logout-link:hover {
      color: var(--color-danger);
      background: #fee2e2;
    }

    .shell-main {
      min-width: 0;
      width: 100%;
      height: 100dvh;
      max-height: 100dvh;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      overflow: hidden;
    }

    .app-topbar {
      position: relative;
      z-index: 1030;
      min-height: 72px;
      display: flex;
      align-items: center;
      gap: 18px;
      border-bottom: 1px solid var(--color-border);
      background: rgba(248, 250, 252, 0.94);
      backdrop-filter: blur(16px);
      padding: 0 clamp(18px, 2.2vw, 32px);
      flex-shrink: 0;
    }

    .mobile-brand {
      display: none;
      align-items: center;
      gap: 10px;
      min-width: 0;
      color: var(--color-text);
      font-weight: 900;
    }

    .icon-only-btn {
      width: 40px;
      height: 40px;
      display: inline-grid;
      place-items: center;
      flex: 0 0 40px;
      border: 1px solid var(--color-border);
      border-radius: 12px;
      background: #ffffff;
      color: var(--color-text);
      padding: 0;
      font-size: 22px;
    }

    .top-search {
      width: min(540px, 42vw);
      min-width: 260px;
      height: 44px;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid transparent;
      border-radius: 999px;
      background: #eef1fb;
      color: var(--color-muted);
      padding: 0 16px;
      transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
    }

    .top-search:focus-within {
      border-color: rgba(37, 99, 235, 0.35);
      background: #ffffff;
      box-shadow: 0 0 0 0.22rem rgba(37, 99, 235, 0.12);
    }

    .top-search i {
      flex: 0 0 auto;
      font-size: 16px;
    }

    .top-search input {
      min-width: 0;
      flex: 1;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--color-text);
      font-weight: 600;
    }

    .top-search input::placeholder {
      color: var(--color-muted);
      font-weight: 500;
    }

    .topbar-actions {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: auto;
    }

    .avatar-btn {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: #ffffff;
      color: var(--color-primary);
      font-weight: 900;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
    }

    .avatar-btn:hover {
      border-color: rgba(37, 99, 235, 0.35);
      background: #eef4ff;
    }

    .profile-menu {
      position: absolute;
      top: calc(100% + 12px);
      right: 0;
      z-index: 1060;
      width: min(320px, calc(100vw - 32px));
      display: grid;
      gap: 12px;
      border: 1px solid var(--color-border);
      border-radius: 18px;
      background: #ffffff;
      padding: 16px;
    }

    .profile-main {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-width: 0;
      border-bottom: 1px solid var(--color-border-soft);
      padding-bottom: 12px;
    }

    .profile-avatar {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      flex: 0 0 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
      color: #ffffff;
      font-weight: 900;
    }

    .role-pill {
      width: fit-content;
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border-radius: 999px;
      background: #eef4ff;
      color: var(--color-primary);
      padding: 0 9px;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
    }

    .profile-info-row {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--color-muted);
      font-size: 14px;
    }

    .profile-info-icon {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      flex: 0 0 30px;
      border-radius: 10px;
      background: #eef4ff;
      color: var(--color-primary);
    }

    .profile-logout {
      min-height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 0;
      border-top: 1px solid var(--color-border-soft);
      background: transparent;
      color: var(--color-danger);
      padding-top: 12px;
      font-weight: 800;
    }

    .page-frame {
      width: 100%;
      max-width: 100%;
      min-height: 0;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      padding: clamp(18px, 2.2vw, 32px);
      scroll-behavior: smooth;
    }

    .page-frame::-webkit-scrollbar {
      width: 8px;
    }

    .page-frame::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: rgba(100, 116, 139, 0.32);
    }

    .page-frame::-webkit-scrollbar-track {
      background: transparent;
    }

    .sidebar-scrim {
      display: none;
    }

    @media (max-width: 991.98px) {
      .shell-layout {
        grid-template-columns: minmax(0, 1fr);
      }

      .app-sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        width: min(310px, 86vw);
        transform: translateX(-104%);
        box-shadow: 24px 0 70px rgba(15, 23, 42, 0.18);
        transition: transform 180ms ease;
      }

      .app-sidebar.sidebar-open {
        transform: translateX(0);
      }

      .sidebar-scrim {
        position: fixed;
        inset: 0;
        z-index: 1035;
        display: block;
        border: 0;
        background: rgba(15, 23, 42, 0.38);
        backdrop-filter: blur(4px);
      }

      .mobile-brand {
        display: flex;
      }

      .top-search {
        width: min(100%, 420px);
        min-width: 0;
      }
    }

    @media (max-width: 640px) {
      .app-topbar {
        min-height: auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        padding: 12px 16px;
      }

      .mobile-brand {
        grid-column: 1;
        grid-row: 1;
      }

      .topbar-actions {
        grid-column: 2;
        grid-row: 1;
      }

      .top-search {
        grid-column: 1 / -1;
        grid-row: 2;
        width: 100%;
        height: 42px;
      }

      .page-frame {
        padding: 16px;
      }

      .profile-menu {
        right: -4px;
        width: min(320px, calc(100vw - 24px));
      }
    }

    @media (max-width: 360px) {
      .app-sidebar {
        width: min(292px, 88vw);
        padding: 16px 12px;
      }

      .sidebar-link {
        min-height: 44px;
        padding: 0 10px;
      }

      .nav-icon {
        width: 30px;
        height: 30px;
        flex-basis: 30px;
      }

      .page-frame {
        padding: 12px;
      }
    }
  `
})
export class AppShellComponent {
  protected readonly menuOpen = signal(false);
  protected readonly profileOpen = signal(false);
  private readonly currentUrl = signal('');
  private readonly policyPages = signal<NavigationPage[]>([]);
  private readonly user = signal<ReturnType<AuthTokenService['getUser']>>(null);

  protected readonly role = computed<ShellRole>(() => {
    const url = this.currentUrl();

    if (url.startsWith('/teacher')) {
      return 'teacher';
    }

    if (url.startsWith('/student')) {
      return 'student';
    }

    return 'admin';
  });

  protected readonly navItems = computed(() => {
    const pages = this.policyPages();
    return pages.length ? pages : fallbackNavByRole[this.role()];
  });

  protected readonly roleLabel = computed(() => `${this.role()} portal`);

  protected readonly userInitials = computed(() => {
    const user = this.user();
    const first = user?.firstName?.[0] ?? 'A';
    const last = user?.lastName?.[0] ?? '';
    return `${first}${last}`.toUpperCase();
  });

  protected readonly searchPlaceholder = computed(() => {
    if (this.role() === 'teacher') {
      return 'Search students, classes, or resources...';
    }

    if (this.role() === 'student') {
      return 'Search classes, homework, or help...';
    }

    return 'Search anything...';
  });

  constructor(
    private readonly router: Router,
    private readonly navigationApi: NavigationApiService,
    private readonly authApi: AuthApiService,
    private readonly tokens: AuthTokenService,
    private readonly toasts: ToastService
  ) {
    this.user.set(this.tokens.getUser());
    this.currentUrl.set(this.router.url);

    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
      this.closeMenu();
      this.profileOpen.set(false);
    });

    this.loadNavigationPolicy();
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected toggleProfile(): void {
    this.profileOpen.update((open) => !open);
  }

  protected logout(): void {
    this.authApi.logout().subscribe(() => {
      this.policyPages.set([]);
      this.closeMenu();
      this.profileOpen.set(false);
      void this.router.navigate(['/login']);
    });
  }

  protected handleSidebarNavigation(event: Event, item: NavigationPage): void {
    event.preventDefault();

    if (!implementedSidebarPaths.has(item.path)) {
      this.showComingSoon(item.label);
      return;
    }

    this.closeMenu();
    void this.router.navigateByUrl(item.path);
  }

  protected showComingSoon(label: string): void {
    this.closeMenu();
    this.toasts.info(`${label} will be available shortly.`);
  }

  protected isActivePath(path: string): boolean {
    return this.currentUrl() === path;
  }

  protected iconClass(icon: string): string {
    return sidebarIconClasses[icon] ?? sidebarIconClasses['grid'];
  }

  protected fullName(): string {
    const user = this.user();
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Schooli User';
  }

  protected userEmail(): string {
    return this.user()?.email ?? 'No email available';
  }

  protected userPhone(): string {
    return this.user()?.phone ?? 'No phone available';
  }

  protected roleLabelShort(): string {
    return this.role().replace(/^./, (char) => char.toUpperCase());
  }

  private loadNavigationPolicy(): void {
    this.navigationApi.getPages().subscribe({
      next: (response) => this.policyPages.set(response.data.pages),
      error: () => this.policyPages.set(fallbackNavByRole[this.role()])
    });
  }
}