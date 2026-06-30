import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, takeUntil } from 'rxjs';
import { AdminDashboardApiService, AdminDashboardStats } from '../../core/admin/admin-dashboard-api.service';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { RoleListItem, RolesApiService } from '../../core/roles/roles-api.service';
import { TeacherAvailabilityApiService } from '../../core/teachers/teacher-availability-api.service';
import { UserListItem, UsersApiService } from '../../core/users/users-api.service';

type DialogMode = 'view' | 'edit';
type UserDialogTab = 'details' | 'roles';

type CreateUserForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  isdCode: string;
  phoneNumber: string;
  password: string;
  autoGeneratePassword: boolean;
  role: string;
  availabilityDays: string[];
  availabilityStartTime: string;
  availabilityEndTime: string;
  timezone: string;
};

const WORKING_DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' }
];

const emptyStats: AdminDashboardStats['users'] = {
  total: 0,
  active: 0,
  inactive: 0,
  teachers: 0,
  students: 0,
  support: 0
};

const iconPaths: Record<string, string> = {
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87',
  active: 'M20 6 9 17l-5-5',
  teacher: 'M22 10 12 4 2 10l10 6 10-6z M6 12v5c3 2 9 2 12 0v-5',
  student: 'M12 14l9-5-9-5-9 5 9 5z M5 11v5c2 2 12 2 14 0v-5',
  support: 'M18 10a6 6 0 0 0-12 0v4a3 3 0 0 0 3 3h1v-5H7v-2a5 5 0 0 1 10 0v2h-3v5h1a3 3 0 0 0 3-3z',
  inactive: 'M18 6 6 18 M6 6l12 12',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  ban: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M4.9 4.9l14.2 14.2',
  filter: 'M4 6h16 M7 12h10 M10 18h4',
  plus: 'M12 5v14 M5 12h14',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  mail: 'M4 4h16v16H4z M4 7l8 6 8-6',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72'
};

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  protected readonly users = signal<UserListItem[]>([]);
  protected readonly roles = signal<RoleListItem[]>([]);
  protected readonly stats = signal(emptyStats);
  protected readonly pagination = signal({ page: 1, limit: 10, total: 0, totalPages: 1 });
  protected readonly selectedUser = signal<UserListItem | null>(null);
  protected readonly confirmUser = signal<UserListItem | null>(null);
  protected readonly dialogOpen = signal(false);
  protected readonly createDialogOpen = signal(false);
  protected readonly dialogMode = signal<DialogMode>('view');
  protected readonly dialogTab = signal<UserDialogTab>('details');
  protected readonly selectedRole = signal('');
  protected readonly saving = signal(false);
  protected readonly createError = signal('');
  protected searchText = '';
  protected roleFilter = '';
  protected statusFilter = '';
  protected dateFilter = '30';
  protected readonly workingDays = WORKING_DAYS;
  protected createForm: CreateUserForm = this.getEmptyCreateForm();
  private readonly searchChanges = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  protected readonly pageNumbers = computed(() => {
    const totalPages = this.pagination().totalPages || 1;
    const current = this.pagination().page;
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  });
  protected readonly assignableRoles = computed(() => this.roles().filter((role) => role.name !== 'admin'));

  constructor(
    private readonly usersApi: UsersApiService,
    private readonly rolesApi: RolesApiService,
    private readonly dashboardApi: AdminDashboardApiService,
    private readonly tokens: AuthTokenService,
    private readonly teacherAvailabilityApi: TeacherAvailabilityApiService
  ) {}

  ngOnInit(): void {
    this.loadRoles();
    this.loadStats();
    this.loadUsers(1);

    this.searchChanges
      .pipe(debounceTime(450), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.loadUsers(1));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected metricCards() {
    const stats = this.stats();
    return [
      { label: 'Total Users', value: stats.total, icon: 'users', tone: '' },
      { label: 'Active Users', value: stats.active, icon: 'active', tone: 'green' },
      { label: 'Teachers', value: stats.teachers, icon: 'teacher', tone: 'purple' },
      { label: 'Students', value: stats.students, icon: 'student', tone: '' },
      { label: 'Support', value: stats.support, icon: 'support', tone: 'purple' },
      { label: 'Inactive', value: stats.inactive, icon: 'inactive', tone: 'red' }
    ];
  }

  protected loadUsers(page: number): void {
    const safePage = Math.max(1, page);
    const range = this.dateRange();

    this.usersApi
      .listUsers({
        page: safePage,
        limit: 10,
        search: this.searchText,
        role: this.roleFilter,
        status: this.statusFilter,
        createdFrom: range.createdFrom,
        createdTo: range.createdTo
      })
      .subscribe((response) => {
        this.users.set(response.data);
        this.pagination.set(response.pagination ?? { page: safePage, limit: 10, total: response.data.length, totalPages: 1 });
      });
  }

  protected handleSearchChange(value: string): void {
    this.searchChanges.next(value.trim());
  }

  protected openUser(user: UserListItem, mode: DialogMode): void {
    this.dialogMode.set(mode);
    this.dialogTab.set('details');
    this.dialogOpen.set(true);
    this.usersApi.getUser(user.id).subscribe((response) => {
      this.selectedUser.set(response.data);
      this.selectedRole.set(response.data.roles[0] ?? '');
    });
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
    this.selectedUser.set(null);
  }

  protected selectRole(role: string): void {
    if (this.dialogMode() === 'edit' && role !== 'admin') {
      this.selectedRole.set(role);
    }
  }

  protected saveRole(): void {
    const user = this.selectedUser();
    const role = this.selectedRole();

    if (!user || !role) {
      return;
    }

    this.saving.set(true);
    this.usersApi.updateRoles(user.id, [role]).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.loadUsers(this.pagination().page);
        this.loadStats();
      },
      error: () => this.saving.set(false)
    });
  }

  protected openCreateDialog(): void {
    this.createForm = this.getEmptyCreateForm();
    this.generatePassword();
    this.createError.set('');
    this.createDialogOpen.set(true);
  }

  protected closeCreateDialog(): void {
    this.createDialogOpen.set(false);
  }

  protected createUser(): void {
    this.createError.set('');

    if (!this.isCreateFormValid()) {
      this.createError.set('Complete all required fields with valid values.');
      return;
    }

    this.saving.set(true);
    this.usersApi
      .createUser({
        firstName: this.createForm.firstName,
        lastName: this.createForm.lastName,
        username: this.createForm.username || undefined,
        email: this.createForm.email,
        phone: `${this.createForm.isdCode}${this.createForm.phoneNumber}`,
        timezone: this.createForm.timezone,
        password: this.createForm.password,
        roles: [this.createForm.role]
      })
      .subscribe({
        next: (response) => {
          if (this.createForm.role !== 'teacher') {
            this.finishCreateUser();
            return;
          }

          forkJoin(
            this.createForm.availabilityDays.map((dayOfWeek) =>
              this.teacherAvailabilityApi.createAvailability(response.data.id, {
                dayOfWeek,
                startTime: this.createForm.availabilityStartTime,
                endTime: this.createForm.availabilityEndTime,
                timezone: this.createForm.timezone,
                isActive: true
              })
            )
          ).subscribe({
            next: () => this.finishCreateUser(),
            error: () => {
              this.saving.set(false);
              this.createError.set('User was created, but teacher availability could not be saved.');
            }
          });
        },
        error: () => {
          this.saving.set(false);
          this.createError.set('Could not create user. Check required fields and duplicate email/username/phone.');
        }
      });
  }

  protected handleAutoPasswordChange(): void {
    if (this.createForm.autoGeneratePassword) {
      this.generatePassword();
    } else {
      this.createForm.password = '';
    }
  }

  protected generatePassword(): void {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const special = '@#$%&*!?';
    const all = `${upper}${lower}${numbers}${special}`;
    const pick = (source: string) => source[Math.floor(Math.random() * source.length)];
    const chars = [pick(upper), pick(lower), pick(numbers), pick(special)];

    while (chars.length < 14) {
      chars.push(pick(all));
    }

    this.createForm.password = chars.sort(() => Math.random() - 0.5).join('');
  }

  protected handleCreateRoleChange(): void {
    if (this.createForm.role === 'teacher' && !this.createForm.availabilityDays.length) {
      this.createForm.availabilityDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    }
  }

  protected toggleAvailabilityDay(day: string): void {
    this.createForm.availabilityDays = this.createForm.availabilityDays.includes(day)
      ? this.createForm.availabilityDays.filter((item) => item !== day)
      : [...this.createForm.availabilityDays, day];
  }

  protected isStrongPassword(): boolean {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,72}$/.test(this.createForm.password);
  }

  protected isCreateFormValid(): boolean {
    const hasBaseFields =
      this.createForm.firstName.trim().length > 0 &&
      this.createForm.lastName.trim().length > 0 &&
      /^[A-Za-z][A-Za-z\s'-]*$/.test(this.createForm.firstName) &&
      /^[A-Za-z][A-Za-z\s'-]*$/.test(this.createForm.lastName) &&
      (!this.createForm.username || /^[A-Za-z0-9._-]{3,50}$/.test(this.createForm.username)) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.createForm.email) &&
      /^\+\d{1,4}$/.test(this.createForm.isdCode) &&
      /^\d{6,15}$/.test(this.createForm.phoneNumber) &&
      this.createForm.role !== '' &&
      this.createForm.role !== 'admin' &&
      Boolean(this.createForm.timezone) &&
      this.isStrongPassword();

    if (!hasBaseFields) {
      return false;
    }

    if (this.createForm.role === 'teacher') {
      return (
        this.createForm.availabilityDays.length > 0 &&
        Boolean(this.createForm.availabilityStartTime) &&
        Boolean(this.createForm.availabilityEndTime) &&
        this.createForm.availabilityStartTime < this.createForm.availabilityEndTime &&
        Boolean(this.createForm.timezone)
      );
    }

    return true;
  }

  protected askDeactivate(user: UserListItem): void {
    this.confirmUser.set(user);
  }

  protected deactivateUser(): void {
    const user = this.confirmUser();

    if (!user) {
      return;
    }

    this.saving.set(true);
    this.usersApi.updateStatus(user.id, 'inactive', false).subscribe({
      next: () => {
        this.saving.set(false);
        this.confirmUser.set(null);
        this.loadUsers(this.pagination().page);
        this.loadStats();
      },
      error: () => this.saving.set(false)
    });
  }

  protected fullName(user: UserListItem): string {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  protected initials(user: UserListItem): string {
    return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() || 'U';
  }

  protected primaryRole(user: UserListItem): string {
    return user.roles[0] ? this.titleCase(user.roles[0]) : 'No Role';
  }

  protected isCurrentUser(user: UserListItem): boolean {
    return this.tokens.getUser()?.id === user.id;
  }

  protected titleCase(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  protected icon(key: string): string {
    return iconPaths[key] ?? iconPaths['users'];
  }

  private loadRoles(): void {
    this.rolesApi.listRoles().subscribe((response) => this.roles.set(response.data));
  }

  private loadStats(): void {
    this.dashboardApi.getStats().subscribe((response) => this.stats.set(response.data.users));
  }

  private dateRange(): { createdFrom?: string; createdTo?: string } {
    if (!this.dateFilter) {
      return {};
    }

    const days = Number(this.dateFilter);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return {
      createdFrom: from.toISOString(),
      createdTo: new Date().toISOString()
    };
  }

  private getEmptyCreateForm(): CreateUserForm {
    return {
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      isdCode: '+91',
      phoneNumber: '',
      password: '',
      autoGeneratePassword: true,
      role: '',
      availabilityDays: [],
      availabilityStartTime: '09:00',
      availabilityEndTime: '18:00',
      timezone: 'Asia/Kolkata'
    };
  }

  private finishCreateUser(): void {
    this.saving.set(false);
    this.closeCreateDialog();
    this.loadUsers(1);
    this.loadStats();
  }
}
