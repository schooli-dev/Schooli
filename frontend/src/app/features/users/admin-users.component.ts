import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
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
  template: `
    <div class="admin-users-page">

      <!-- Header -->
      <div class="page-heading row align-items-start mb-4">
        <div>
          <span class="section-kicker">ADMIN PANEL</span>
          <h1>User Management</h1>
          <p>Manage users, roles, access, availability, and account status from one place.</p>
        </div>

        <div class="heading-actions mt-3 mt-lg-0">
          <button class="btn btn-outline-secondary admin-btn" type="button">
            <i class="bi bi-download"></i>
            <span>Export</span>
          </button>

          <button class="btn btn-primary admin-btn" type="button" (click)="openCreateDialog()">
            <i class="bi bi-person-plus"></i>
            <span>Create User</span>
          </button>
        </div>
      </div>

      <!-- Metric Cards -->
      <section class="row g-3 mb-4">
        <div class="col-6 col-md-4 col-xl-2" *ngFor="let card of metricCards()">
          <article class="user-metric h-100">
            <div class="metric-top">
              <span class="metric-icon" [class]="card.tone">
                @if (card.icon === 'users') {
                  <i class="bi bi-people"></i>
                } @else if (card.icon === 'active') {
                  <i class="bi bi-person-check"></i>
                } @else if (card.icon === 'teacher') {
                  <i class="bi bi-mortarboard"></i>
                } @else if (card.icon === 'student') {
                  <i class="bi bi-backpack"></i>
                } @else if (card.icon === 'support') {
                  <i class="bi bi-headset"></i>
                } @else {
                  <i class="bi bi-person-x"></i>
                }
              </span>
            </div>

            <span class="metric-label">{{ card.label }}</span>
            <strong>{{ card.value | number }}</strong>
          </article>
        </div>
      </section>

      <!-- Filters -->
      <section class="panel filter-panel mb-4">
        <div class="row g-3 align-items-center">
          <div class="col-12 col-md-6 col-xl-3">
            <label class="filter-label">Role</label>
            <div class="input-group">
              <span class="input-group-text">
                <i class="bi bi-funnel"></i>
              </span>
              <select class="form-select" [(ngModel)]="roleFilter" (ngModelChange)="loadUsers(1)">
                <option value="">All Roles</option>
                @for (role of roles(); track role.id) {
                  <option [value]="role.name">{{ titleCase(role.name) }}</option>
                }
              </select>
            </div>
          </div>

          <div class="col-12 col-md-6 col-xl-3">
            <label class="filter-label">Status</label>
            <select class="form-select" [(ngModel)]="statusFilter" (ngModelChange)="loadUsers(1)">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div class="col-12 col-md-6 col-xl-3">
            <label class="filter-label">Created Date</label>
            <select class="form-select" [(ngModel)]="dateFilter" (ngModelChange)="loadUsers(1)">
              <option value="">All Dates</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>

          <div class="col-12 col-md-6 col-xl-3">
            <label class="filter-label">Search</label>
            <div class="input-group">
              <span class="input-group-text">
                <i class="bi bi-search"></i>
              </span>
              <input
                class="form-control"
                placeholder="Search users..."
                [(ngModel)]="searchText"
                (ngModelChange)="loadUsers(1)"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Desktop Table -->
      <section class="panel user-table-panel d-none d-lg-block">
        <div class="table-responsive">
          <table class="table align-middle mb-0 admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th class="text-end">Actions</th>
              </tr>
            </thead>

            <tbody>
              @for (user of users(); track user.id) {
                <tr>
                  <td>
                    <div class="d-flex align-items-center gap-3">
                      <span class="user-avatar">{{ initials(user) }}</span>
                      <div class="min-w-0">
                        <strong class="d-block text-truncate">{{ fullName(user) }}</strong>
                        <span class="d-block text-truncate text-muted small">
                          <i class="bi bi-envelope me-1"></i>
                          {{ user.email }}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span class="role-chip">
                      <i class="bi bi-shield-check"></i>
                      {{ primaryRole(user) }}
                    </span>
                  </td>

                  <td>
                    <span
                      class="status-chip"
                      [class.status-active]="user.status === 'active'"
                      [class.status-inactive]="user.status !== 'active'"
                    >
                      <span class="status-dot"></span>
                      {{ titleCase(user.status) }}
                    </span>
                  </td>

                  <td>
                    <span class="text-muted">
                      {{ user.lastLoginAt ? (user.lastLoginAt | date: 'MMM d, hh:mm a') : 'Never' }}
                    </span>
                  </td>

                  <td class="text-end">
                    <div class="action-group">
                      <button
                        class="btn btn-light action-btn"
                        type="button"
                        title="View user"
                        aria-label="View user"
                        (click)="openUser(user, 'view')"
                      >
                        <i class="bi bi-eye"></i>
                      </button>

                      <button
                        class="btn btn-light action-btn"
                        type="button"
                        title="Edit user role"
                        aria-label="Edit user role"
                        [disabled]="isCurrentUser(user)"
                        (click)="openUser(user, 'edit')"
                      >
                        <i class="bi bi-pencil-square"></i>
                      </button>

                      <button
                        class="btn btn-light action-btn text-danger"
                        type="button"
                        title="Deactivate user"
                        aria-label="Deactivate user"
                        [disabled]="user.status !== 'active' || isCurrentUser(user)"
                        (click)="askDeactivate(user)"
                      >
                        <i class="bi bi-person-slash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    <div class="empty-state">
                      <i class="bi bi-people"></i>
                      <strong>No users found</strong>
                      <span>Try changing your filters or search keyword.</span>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Mobile Cards -->
      <section class="d-lg-none mobile-user-list">
        @for (user of users(); track user.id) {
          <article class="mobile-user-card">
            <div class="d-flex align-items-start gap-3">
              <span class="user-avatar">{{ initials(user) }}</span>

              <div class="min-w-0 flex-grow-1">
                <strong class="d-block text-truncate">{{ fullName(user) }}</strong>
                <span class="d-block text-truncate text-muted small">{{ user.email }}</span>

                <div class="d-flex flex-wrap gap-2 mt-3">
                  <span class="role-chip">
                    <i class="bi bi-shield-check"></i>
                    {{ primaryRole(user) }}
                  </span>

                  <span
                    class="status-chip"
                    [class.status-active]="user.status === 'active'"
                    [class.status-inactive]="user.status !== 'active'"
                  >
                    <span class="status-dot"></span>
                    {{ titleCase(user.status) }}
                  </span>
                </div>

                <div class="mobile-meta mt-3">
                  <i class="bi bi-clock-history"></i>
                  <span>
                    Last login:
                    {{ user.lastLoginAt ? (user.lastLoginAt | date: 'MMM d, hh:mm a') : 'Never' }}
                  </span>
                </div>
              </div>
            </div>

            <div class="mobile-actions mt-3">
              <button class="btn btn-outline-primary btn-sm" type="button" (click)="openUser(user, 'view')">
                <i class="bi bi-eye"></i>
                View
              </button>

              <button
                class="btn btn-outline-secondary btn-sm"
                type="button"
                [disabled]="isCurrentUser(user)"
                (click)="openUser(user, 'edit')"
              >
                <i class="bi bi-pencil-square"></i>
                Edit
              </button>

              <button
                class="btn btn-outline-danger btn-sm"
                type="button"
                [disabled]="user.status !== 'active' || isCurrentUser(user)"
                (click)="askDeactivate(user)"
              >
                <i class="bi bi-person-slash"></i>
                Deactivate
              </button>
            </div>
          </article>
        } @empty {
          <div class="empty-state mobile-empty">
            <i class="bi bi-people"></i>
            <strong>No users found</strong>
            <span>Try changing your filters or search keyword.</span>
          </div>
        }
      </section>

      <!-- Pagination -->
      <section class="panel pagination-panel mt-3">
        <div class="d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between">
          <span class="text-muted small">
            Showing page {{ pagination().page }} of {{ pagination().totalPages || 1 }}
            · {{ pagination().total | number }} users
          </span>

          <nav aria-label="Users pagination">
            <ul class="pagination pagination-sm mb-0 flex-wrap">
              <li class="page-item" [class.disabled]="pagination().page <= 1">
                <button class="page-link" type="button" (click)="loadUsers(pagination().page - 1)">
                  Previous
                </button>
              </li>

              @for (page of pageNumbers(); track page) {
                <li class="page-item" [class.active]="page === pagination().page">
                  <button class="page-link" type="button" (click)="loadUsers(page)">
                    {{ page }}
                  </button>
                </li>
              }

              <li class="page-item" [class.disabled]="pagination().page >= pagination().totalPages">
                <button class="page-link" type="button" (click)="loadUsers(pagination().page + 1)">
                  Next
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </section>
    </div>

    <!-- View/Edit Dialog -->
    @if (dialogOpen() && selectedUser()) {
      <section class="dialog-backdrop">
        <div class="user-dialog shadow-lg">

          <header class="dialog-header">
            <div class="d-flex align-items-center gap-3 min-w-0">
              <span class="user-avatar dialog-avatar">{{ initials(selectedUser()!) }}</span>
              <div class="min-w-0">
                <h2 class="h4 mb-1">
                  {{ dialogMode() === 'edit' ? 'Edit User Role' : 'User Details' }}
                </h2>
                <p class="text-muted mb-0 text-truncate">{{ fullName(selectedUser()!) }}</p>
              </div>
            </div>

            <button class="btn-close" type="button" aria-label="Close" (click)="closeDialog()"></button>
          </header>

          <ul class="nav nav-pills dialog-tabs mt-3">
            <li class="nav-item">
              <button
                class="nav-link"
                [class.active]="dialogTab() === 'details'"
                type="button"
                (click)="dialogTab.set('details')"
              >
                <i class="bi bi-person-lines-fill"></i>
                Details
              </button>
            </li>

            <li class="nav-item">
              <button
                class="nav-link"
                [class.active]="dialogTab() === 'roles'"
                type="button"
                (click)="dialogTab.set('roles')"
              >
                <i class="bi bi-shield-lock"></i>
                Roles
              </button>
            </li>
          </ul>

          <div class="dialog-body">
            @if (dialogTab() === 'details') {
              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <div class="detail-card">
                    <span>Full Name</span>
                    <strong>{{ fullName(selectedUser()!) }}</strong>
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <div class="detail-card">
                    <span>Username</span>
                    <strong>{{ selectedUser()!.username ?? 'Not set' }}</strong>
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <div class="detail-card">
                    <span>Email</span>
                    <strong class="text-truncate">
                      <i class="bi bi-envelope me-1"></i>
                      {{ selectedUser()!.email }}
                    </strong>
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <div class="detail-card">
                    <span>Phone</span>
                    <strong>
                      <i class="bi bi-telephone me-1"></i>
                      {{ selectedUser()!.phone ?? 'Not set' }}
                    </strong>
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <div class="detail-card">
                    <span>Status</span>
                    <strong>{{ titleCase(selectedUser()!.status) }}</strong>
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <div class="detail-card">
                    <span>Created</span>
                    <strong>{{ selectedUser()!.createdAt | date: 'MMM d, y' }}</strong>
                  </div>
                </div>

                @if (selectedUser()!.teacherAvailability) {
                  <div class="col-12">
                    <div class="detail-card">
                      <span>Teacher Availability</span>

                      <div class="availability-grid mt-2">
                        @for (slot of selectedUser()!.teacherAvailability!.availability; track slot.id) {
                          <span>
                            <i class="bi bi-calendar-check"></i>
                            {{ titleCase(slot.dayOfWeek) }}: {{ slot.startTime }} - {{ slot.endTime }}
                          </span>
                        } @empty {
                          <span>No working hours configured.</span>
                        }
                      </div>
                    </div>
                  </div>

                  <div class="col-12">
                    <div class="detail-card">
                      <span>Unavailable Dates</span>

                      <div class="availability-grid mt-2">
                        @for (block of selectedUser()!.teacherAvailability!.unavailableDates; track block.id) {
                          <span>
                            <i class="bi bi-calendar-x"></i>
                            {{ block.unavailableDate | date: 'MMM d, y' }}
                            {{ block.reason ? '- ' + block.reason : '' }}
                          </span>
                        } @empty {
                          <span>No unavailable dates configured.</span>
                        }
                      </div>
                    </div>
                  </div>
                }

                @if (selectedUser()!.supportStats) {
                  <div class="col-12 col-md-6">
                    <div class="detail-card">
                      <span>Tickets Assigned</span>
                      <strong>{{ selectedUser()!.supportStats!.assignedTickets }}</strong>
                    </div>
                  </div>

                  <div class="col-12 col-md-6">
                    <div class="detail-card">
                      <span>Tickets Solved</span>
                      <strong>{{ selectedUser()!.supportStats!.solvedTickets }}</strong>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="role-list">
                @for (role of roles(); track role.id) {
                  <label class="role-option">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      [checked]="selectedRole() === role.name"
                      [disabled]="dialogMode() === 'view' || role.name === 'admin'"
                      (change)="selectRole(role.name)"
                    />

                    <span class="role-option-icon">
                      <i class="bi bi-shield-check"></i>
                    </span>

                    <span class="role-option-text">
                      <strong>{{ titleCase(role.name) }}</strong>
                      @if (role.name === 'admin') {
                        <small>Protected role</small>
                      } @else {
                        <small>Assignable role</small>
                      }
                    </span>
                  </label>
                }
              </div>
            }
          </div>

          <footer class="dialog-footer">
            <button class="btn btn-outline-secondary" type="button" (click)="closeDialog()">
              Cancel
            </button>

            @if (dialogMode() === 'edit') {
              <button
                class="btn btn-primary"
                type="button"
                [disabled]="!selectedRole() || selectedRole() === 'admin' || saving()"
                (click)="saveRole()"
              >
                @if (saving()) {
                  <span class="spinner-border spinner-border-sm me-2"></span>
                }
                Save Changes
              </button>
            }
          </footer>
        </div>
      </section>
    }

    <!-- Create User Dialog -->
    @if (createDialogOpen()) {
      <section class="dialog-backdrop">
        <form class="user-dialog shadow-lg" #createFormRef="ngForm" (ngSubmit)="createUser()">

          <header class="dialog-header">
            <div>
              <h2 class="h4 mb-1">Create User</h2>
              <p class="text-muted mb-0">
                Create students, teachers, or support users. Admin role is intentionally unavailable.
              </p>
            </div>

            <button class="btn-close" type="button" aria-label="Close" (click)="closeCreateDialog()"></button>
          </header>

          <div class="dialog-body">
            <div class="row g-3">

              <div class="col-12 col-md-6">
                <label class="form-label">First Name <span class="required">*</span></label>
                <input
                  class="form-control"
                  name="firstName"
                  [(ngModel)]="createForm.firstName"
                  required
                  pattern="^[A-Za-z][A-Za-z\\s'-]*$"
                  #firstNameRef="ngModel"
                />
                @if (firstNameRef.invalid && firstNameRef.touched) {
                  <small class="field-error">Use letters, spaces, apostrophes, or hyphens only.</small>
                }
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label">Last Name <span class="required">*</span></label>
                <input
                  class="form-control"
                  name="lastName"
                  [(ngModel)]="createForm.lastName"
                  required
                  pattern="^[A-Za-z][A-Za-z\\s'-]*$"
                  #lastNameRef="ngModel"
                />
                @if (lastNameRef.invalid && lastNameRef.touched) {
                  <small class="field-error">Use letters, spaces, apostrophes, or hyphens only.</small>
                }
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label">Username</label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-person"></i></span>
                  <input
                    class="form-control"
                    name="username"
                    [(ngModel)]="createForm.username"
                    pattern="^[A-Za-z0-9._-]{3,50}$"
                    #usernameRef="ngModel"
                  />
                </div>
                @if (usernameRef.invalid && usernameRef.touched) {
                  <small class="field-error">Use 3-50 letters, numbers, dot, underscore, or hyphen only.</small>
                }
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label">Email <span class="required">*</span></label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-envelope"></i></span>
                  <input
                    class="form-control"
                    name="email"
                    type="email"
                    [(ngModel)]="createForm.email"
                    required
                    email
                    #emailRef="ngModel"
                  />
                </div>
                @if (emailRef.invalid && emailRef.touched) {
                  <small class="field-error">Enter a valid email address.</small>
                }
              </div>

              <div class="col-12 col-md-5">
                <label class="form-label">ISD Code <span class="required">*</span></label>
                <select class="form-select" name="isdCode" [(ngModel)]="createForm.isdCode" required>
                  <option value="+91">+91 India</option>
                  <option value="+1">+1 USA/Canada</option>
                  <option value="+44">+44 UK</option>
                  <option value="+61">+61 Australia</option>
                  <option value="+971">+971 UAE</option>
                </select>
              </div>

              <div class="col-12 col-md-7">
                <label class="form-label">Phone Number <span class="required">*</span></label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-telephone"></i></span>
                  <input
                    class="form-control"
                    name="phoneNumber"
                    [(ngModel)]="createForm.phoneNumber"
                    required
                    pattern="^[0-9]{6,15}$"
                    #phoneRef="ngModel"
                    placeholder="Digits only"
                  />
                </div>
                @if (phoneRef.invalid && phoneRef.touched) {
                  <small class="field-error">Phone number must be 6 to 15 digits.</small>
                }
              </div>

              <div class="col-12">
                <div class="form-check auto-password-card">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    name="autoPassword"
                    [(ngModel)]="createForm.autoGeneratePassword"
                    (ngModelChange)="handleAutoPasswordChange()"
                    id="autoPassword"
                  />
                  <label class="form-check-label" for="autoPassword">
                    Auto generate strong password
                  </label>
                </div>
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label">Password <span class="required">*</span></label>
                <div class="input-group">
                  <span class="input-group-text"><i class="bi bi-key"></i></span>
                  <input
                    class="form-control"
                    name="password"
                    [type]="createForm.autoGeneratePassword ? 'text' : 'password'"
                    [(ngModel)]="createForm.password"
                    required
                    minlength="12"
                    [readonly]="createForm.autoGeneratePassword"
                    #passwordRef="ngModel"
                  />

                  @if (createForm.autoGeneratePassword) {
                    <button class="btn btn-outline-secondary" type="button" (click)="generatePassword()">
                      <i class="bi bi-arrow-repeat"></i>
                    </button>
                  }
                </div>

                @if (!createForm.autoGeneratePassword) {
                  <small class="text-muted">Min 12 chars with uppercase, lowercase, number, and special character.</small>
                }

                @if ((passwordRef.invalid || !isStrongPassword()) && passwordRef.touched && !createForm.autoGeneratePassword) {
                  <small class="field-error">Password does not meet the strength rules.</small>
                }
              </div>

              <div class="col-12 col-md-6">
                <label class="form-label">Role <span class="required">*</span></label>
                <select
                  class="form-select"
                  name="role"
                  [(ngModel)]="createForm.role"
                  (ngModelChange)="handleCreateRoleChange()"
                  required
                >
                  <option value="">Select role</option>
                  @for (role of assignableRoles(); track role.id) {
                    <option [value]="role.name">{{ titleCase(role.name) }}</option>
                  }
                </select>
              </div>

              @if (createForm.role === 'teacher') {
                <div class="col-12">
                  <label class="form-label">Working Days <span class="required">*</span></label>
                  <div class="day-picker">
                    @for (day of workingDays; track day.key) {
                      <label>
                        <input
                          type="checkbox"
                          [checked]="createForm.availabilityDays.includes(day.key)"
                          (change)="toggleAvailabilityDay(day.key)"
                        />
                        <span>{{ day.label }}</span>
                      </label>
                    }
                  </div>
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label">Start Time <span class="required">*</span></label>
                  <input class="form-control" type="time" name="availabilityStart" [(ngModel)]="createForm.availabilityStartTime" required />
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label">End Time <span class="required">*</span></label>
                  <input class="form-control" type="time" name="availabilityEnd" [(ngModel)]="createForm.availabilityEndTime" required />
                </div>

                <div class="col-12 col-md-4">
                  <label class="form-label">Timezone <span class="required">*</span></label>
                  <select class="form-select" name="timezone" [(ngModel)]="createForm.timezone" required>
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </div>
              }

              @if (createForm.role === 'student') {
                <div class="col-12">
                  <div class="alert alert-info mb-0">
                    <i class="bi bi-info-circle me-2"></i>
                    Student-specific academic details will be attached through teacher-student assignments and class scheduling.
                  </div>
                </div>
              }

              @if (createForm.role === 'support') {
                <div class="col-12">
                  <div class="alert alert-info mb-0">
                    <i class="bi bi-info-circle me-2"></i>
                    Support ticket ownership is tracked automatically when tickets are assigned and resolved.
                  </div>
                </div>
              }

              @if (createError()) {
                <div class="col-12">
                  <div class="alert alert-danger mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    {{ createError() }}
                  </div>
                </div>
              }

            </div>
          </div>

          <footer class="dialog-footer">
            <button class="btn btn-outline-secondary" type="button" (click)="closeCreateDialog()">
              Cancel
            </button>

            <button
              class="btn btn-primary"
              type="submit"
              [disabled]="createFormRef.invalid || !isCreateFormValid() || saving()"
            >
              @if (saving()) {
                <span class="spinner-border spinner-border-sm me-2"></span>
              }
              Create User
            </button>
          </footer>
        </form>
      </section>
    }

    <!-- Confirm Deactivate -->
    @if (confirmUser()) {
      <section class="dialog-backdrop">
        <div class="confirm-dialog shadow-lg">
          <div class="confirm-icon">
            <i class="bi bi-person-slash"></i>
          </div>

          <h2 class="h4">Deactivate user?</h2>

          <p class="text-muted">
            Are you sure you want to deactivate {{ fullName(confirmUser()!) }}?
            They will no longer be active in the platform.
          </p>

          <div class="d-flex flex-column flex-sm-row justify-content-end gap-2">
            <button class="btn btn-outline-secondary" type="button" (click)="confirmUser.set(null)">
              Cancel
            </button>

            <button class="btn btn-danger" type="button" [disabled]="saving()" (click)="deactivateUser()">
              @if (saving()) {
                <span class="spinner-border spinner-border-sm me-2"></span>
              }
              Deactivate
            </button>
          </div>
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .admin-users-page {
      max-width: 1480px;
    }

    .admin-btn {
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      border-radius: var(--radius-md);
    }

    .filter-panel,
    .pagination-panel {
      padding: 18px;
    }

    .filter-label {
      display: block;
      margin-bottom: 6px;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .form-control,
    .form-select,
    .input-group-text,
    .btn {
      border-radius: var(--radius-md);
    }

    .input-group > .form-control,
    .input-group > .form-select {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }

    .input-group-text {
      background: var(--color-surface-soft);
      border-color: var(--color-border);
      color: var(--color-muted);
    }

    .form-control,
    .form-select {
      border-color: var(--color-border);
      min-height: 42px;
    }

    .form-control:focus,
    .form-select:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 0.22rem rgba(37, 99, 235, 0.14);
    }

    .user-metric {
      position: relative;
      min-height: 138px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px solid var(--color-border);
      border-radius: 20px;
      background:
        linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
      padding: 18px;
      overflow: hidden;
      transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }

    .user-metric:hover {
      transform: translateY(-2px);
      border-color: rgba(37, 99, 235, 0.28);
      box-shadow: 0 18px 44px rgba(30, 64, 175, 0.1);
    }

    .metric-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .metric-icon {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      color: var(--color-primary);
      background: #eef4ff;
      font-size: 20px;
    }

    .metric-icon.green {
      color: var(--color-success);
      background: #dcfce7;
    }

    .metric-icon.purple {
      color: var(--color-secondary);
      background: #f2eaff;
    }

    .metric-icon.red {
      color: var(--color-danger);
      background: #fee2e2;
    }

    .metric-label {
      margin-top: 14px;
      color: var(--color-muted);
      font-size: 13px;
      font-weight: 700;
    }

    .user-metric strong {
      color: var(--color-text);
      font-size: clamp(24px, 3vw, 30px);
      line-height: 1;
    }

    .user-table-panel {
      overflow: hidden;
    }

    .admin-table {
      --bs-table-bg: #ffffff;
    }

    .admin-table thead th {
      border-bottom: 1px solid var(--color-border-soft);
      background: var(--color-surface-soft);
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
      padding: 16px 22px;
    }

    .admin-table tbody td {
      padding: 18px 22px;
      border-bottom: 1px solid var(--color-border-soft);
    }

    .admin-table tbody tr:hover {
      background: #f8fbff;
    }

    .user-avatar {
      width: 44px;
      height: 44px;
      flex: 0 0 44px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
      color: #ffffff;
      font-weight: 900;
      font-size: 14px;
      box-shadow: 0 10px 24px rgba(37, 99, 235, 0.22);
    }

    .dialog-avatar {
      width: 52px;
      height: 52px;
      flex-basis: 52px;
    }

    .min-w-0 {
      min-width: 0;
    }

    .role-chip,
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 28px;
      border-radius: 999px;
      padding: 0 11px;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }

    .role-chip {
      background: #eef4ff;
      color: var(--color-primary);
    }

    .status-chip {
      background: #eef1fb;
      color: var(--color-text-soft);
    }

    .status-chip.status-active {
      background: #dcfce7;
      color: var(--color-success);
    }

    .status-chip.status-inactive {
      background: #f1f5f9;
      color: var(--color-muted);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      display: inline-block;
      border-radius: 999px;
      background: currentColor;
    }

    .action-group {
      display: inline-flex;
      gap: 6px;
      padding: 4px;
      border: 1px solid var(--color-border-soft);
      border-radius: 999px;
      background: #f8fafc;
    }

    .action-btn {
      width: 34px;
      height: 34px;
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      border: 0;
      color: var(--color-text-soft);
    }

    .action-btn:hover:not(:disabled) {
      color: var(--color-primary);
      background: #eef4ff;
    }

    .action-btn:disabled {
      opacity: 0.4;
    }

    .mobile-user-list {
      display: grid;
      gap: 14px;
    }

    .mobile-user-card {
      border: 1px solid var(--color-border);
      border-radius: 18px;
      background: #ffffff;
      padding: 16px;
      box-shadow: 0 12px 32px rgba(30, 64, 175, 0.07);
    }

    .mobile-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-muted);
      font-size: 13px;
    }

    .mobile-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .mobile-actions .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-weight: 700;
    }

    .empty-state {
      min-height: 220px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 8px;
      color: var(--color-muted);
      text-align: center;
    }

    .empty-state i {
      font-size: 34px;
      color: var(--color-primary);
    }

    .empty-state strong {
      color: var(--color-text);
    }

    .mobile-empty {
      border: 1px solid var(--color-border);
      border-radius: 18px;
      background: #ffffff;
    }

    .dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1100;
      display: grid;
      place-items: center;
      background: rgba(15, 23, 42, 0.42);
      backdrop-filter: blur(8px);
      padding: 18px;
    }

    .user-dialog,
    .confirm-dialog {
      width: min(880px, 100%);
      max-height: calc(100dvh - 36px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid rgba(226, 232, 240, 0.9);
      border-radius: 24px;
      background: #ffffff;
    }

    .confirm-dialog {
      width: min(480px, 100%);
      padding: 26px;
    }

    .dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 24px 24px 0;
    }

    .dialog-tabs {
      padding: 0 24px;
      gap: 8px;
    }

    .dialog-tabs .nav-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--color-text-soft);
      font-weight: 800;
      border-radius: 999px;
    }

    .dialog-tabs .nav-link.active {
      background: var(--color-primary);
      color: #ffffff;
    }

    .dialog-body {
      padding: 22px 24px;
      overflow-y: auto;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      border-top: 1px solid var(--color-border-soft);
      padding: 18px 24px;
      background: #fbfcff;
    }

    .detail-card {
      display: grid;
      gap: 6px;
      height: 100%;
      border: 1px solid var(--color-border-soft);
      border-radius: 16px;
      background: #ffffff;
      padding: 14px 16px;
    }

    .detail-card span {
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .detail-card strong {
      min-width: 0;
      color: var(--color-text);
      font-size: 15px;
    }

    .availability-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .availability-grid span {
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--color-border-soft);
      border-radius: 12px;
      background: var(--color-surface-soft);
      padding: 10px 12px;
      color: var(--color-text-soft);
      font-size: 13px;
    }

    .role-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .role-option {
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid var(--color-border-soft);
      border-radius: 16px;
      background: #ffffff;
      padding: 14px;
      cursor: pointer;
    }

    .role-option:hover {
      border-color: rgba(37, 99, 235, 0.35);
      background: #f8fbff;
    }

    .role-option-icon {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: #eef4ff;
      color: var(--color-primary);
    }

    .role-option-text {
      display: grid;
      gap: 2px;
    }

    .role-option-text small {
      color: var(--color-muted);
      font-size: 12px;
    }

    .required,
    .field-error {
      color: var(--color-danger);
    }

    .field-error {
      display: block;
      margin-top: 5px;
      font-size: 12px;
      font-weight: 700;
    }

    .auto-password-card {
      border: 1px solid var(--color-border-soft);
      border-radius: 14px;
      background: var(--color-surface-soft);
      padding: 12px 14px 12px 40px;
    }

    .day-picker {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .day-picker label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      margin: 0;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: #ffffff;
      padding: 0 14px;
      font-weight: 800;
      cursor: pointer;
    }

    .day-picker input {
      accent-color: var(--color-primary);
    }

    .confirm-icon {
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      margin-bottom: 18px;
      border-radius: 18px;
      background: #fee2e2;
      color: var(--color-danger);
      font-size: 28px;
    }

    .pagination .page-link {
      color: var(--color-primary);
      font-weight: 700;
    }

    .pagination .active .page-link {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #ffffff;
    }

    @media (max-width: 767.98px) {
      .heading-actions {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      .heading-actions .btn {
        width: 100%;
        justify-content: center;
      }

      .filter-panel,
      .pagination-panel {
        padding: 14px;
      }

      .mobile-actions {
        grid-template-columns: 1fr;
      }

      .dialog-backdrop {
        align-items: stretch;
        padding: 10px;
      }

      .user-dialog {
        width: 100%;
        max-height: calc(100dvh - 20px);
        border-radius: 20px;
      }

      .dialog-header {
        padding: 18px 18px 0;
      }

      .dialog-tabs {
        padding: 0 18px;
        overflow-x: auto;
        flex-wrap: nowrap;
      }

      .dialog-body {
        padding: 18px;
      }

      .dialog-footer {
        display: grid;
        grid-template-columns: 1fr;
        padding: 14px 18px;
      }

      .dialog-footer .btn {
        width: 100%;
      }

      .role-list,
      .availability-grid {
        grid-template-columns: 1fr;
      }

      .confirm-dialog {
        align-self: center;
        padding: 22px;
        border-radius: 20px;
      }
    }

    @media (max-width: 420px) {
      .heading-actions {
        grid-template-columns: 1fr;
      }

      .user-avatar {
        width: 40px;
        height: 40px;
        flex-basis: 40px;
        border-radius: 12px;
      }

      .mobile-user-card {
        padding: 14px;
      }

      .role-chip,
      .status-chip {
        font-size: 11px;
      }
    }
  `
})
export class AdminUsersComponent implements OnInit {
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
