import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter, interval } from 'rxjs';
import { AuthApiService } from '../core/auth/auth-api.service';
import { AuthTokenService } from '../core/auth/auth-token.service';
import { NavigationApiService, NavigationPage } from '../core/navigation/navigation-api.service';
import { NotificationsApiService, UserNotification } from '../core/notifications/notifications-api.service';
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
  '/teacher/attendance',
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
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent implements OnDestroy {
  protected readonly menuOpen = signal(false);
  protected readonly profileOpen = signal(false);
  protected readonly notificationOpen = signal(false);
  protected readonly notifications = signal<UserNotification[]>([]);
  protected readonly unreadCount = signal(0);
  private readonly currentUrl = signal('');
  private readonly policyPages = signal<NavigationPage[]>([]);
  private readonly user = signal<ReturnType<AuthTokenService['getUser']>>(null);
  private readonly subscriptions = new Subscription();
  private readonly notificationAudio = typeof Audio !== 'undefined' ? new Audio('/audio/notification.mp3') : null;
  private lastUnreadCount = 0;

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
    private readonly notificationsApi: NotificationsApiService,
    private readonly authApi: AuthApiService,
    private readonly tokens: AuthTokenService,
    private readonly toasts: ToastService
  ) {
    this.user.set(this.tokens.getUser());
    this.currentUrl.set(this.router.url);

    this.subscriptions.add(
      this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        this.closeMenu();
        this.profileOpen.set(false);
        this.notificationOpen.set(false);
      })
    );

    this.loadNavigationPolicy();
    this.loadNotifications(false);
    this.subscriptions.add(interval(60000).subscribe(() => this.loadNotifications(true)));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected openProfile(): void {
    this.profileOpen.set(true);
  }

  protected closeProfile(): void {
    this.profileOpen.set(false);
  }

  protected toggleProfile(): void {
    this.profileOpen.update((open) => !open);
    this.notificationOpen.set(false);
  }

  protected openNotifications(): void {
    this.notificationOpen.set(true);
  }

  protected closeNotifications(): void {
    this.notificationOpen.set(false);
  }

  protected toggleNotifications(): void {
    this.notificationOpen.update((open) => !open);
  }

  protected closeNotificationsOnFocusOut(event: FocusEvent): void {
    const currentTarget = event.currentTarget as Node | null;
    const nextTarget = event.relatedTarget as Node | null;

    if (currentTarget && nextTarget && currentTarget.contains(nextTarget)) {
      return;
    }

    this.closeNotifications();
  }

  protected closeProfileOnFocusOut(event: FocusEvent): void {
    const currentTarget = event.currentTarget as Node | null;
    const nextTarget = event.relatedTarget as Node | null;

    if (currentTarget && nextTarget && currentTarget.contains(nextTarget)) {
      return;
    }

    this.closeProfile();
  }

  protected logout(): void {
    this.authApi.logout().subscribe(() => {
      this.policyPages.set([]);
      this.notifications.set([]);
      this.unreadCount.set(0);
      this.closeMenu();
      this.profileOpen.set(false);
      this.notificationOpen.set(false);
      void this.router.navigate(['/login'], { skipLocationChange: true });
    });
  }

  protected handleSidebarNavigation(event: Event, item: NavigationPage): void {
    event.preventDefault();

    if (!implementedSidebarPaths.has(item.path)) {
      this.showComingSoon(item.label);
      return;
    }

    this.closeMenu();
    void this.router.navigateByUrl(item.path, { skipLocationChange: true });
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

  protected markNotificationsRead(): void {
    this.notificationsApi.markAllRead().subscribe({
      next: () => {
        this.unreadCount.set(0);
        this.lastUnreadCount = 0;
        this.notifications.update((items) => items.map((item) => ({ ...item, isRead: true, readAt: new Date().toISOString() })));
      },
      error: () => this.toasts.error('Could not mark notifications as read.')
    });
  }

  protected notificationTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
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

  private loadNotifications(playSoundOnIncrease: boolean): void {
    this.notificationsApi.getMine(5).subscribe({
      next: (response) => {
        const nextUnreadCount = response.data.unreadCount;
        this.notifications.set(response.data.notifications);
        this.unreadCount.set(nextUnreadCount);

        if (nextUnreadCount > 0 && (!playSoundOnIncrease || nextUnreadCount > this.lastUnreadCount)) {
          this.playNotificationSound();
        }

        this.lastUnreadCount = nextUnreadCount;
      },
      error: () => {
        this.notifications.set([]);
      }
    });
  }

  private playNotificationSound(): void {
    if (!this.notificationAudio) {
      return;
    }

    this.notificationAudio.currentTime = 0;
    void this.notificationAudio.play().catch(() => undefined);
  }
}

