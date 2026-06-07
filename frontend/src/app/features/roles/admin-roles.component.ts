import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PermissionListItem, PermissionsApiService } from '../../core/permissions/permissions-api.service';
import { RoleListItem, RolesApiService } from '../../core/roles/roles-api.service';

type RoleDialogMode = 'create' | 'view' | 'edit';
type RoleDialogTab = 'basic' | 'permissions';

type RoleForm = {
  name: string;
  description: string;
  permissions: string[];
};

const systemRoles = new Set(['admin', 'teacher', 'student', 'support']);

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  template: `
  <div class="admin-roles-page">

    <!-- Header -->
    <div class="page-heading row align-items-start mb-4">
      <div>
        <span class="section-kicker">ADMIN PANEL</span>
        <h1>Roles & Permissions</h1>
        <p>Create roles, assign permissions, and control page access across the platform.</p>
      </div>

      <div class="heading-actions mt-3 mt-lg-0">
        <button class="btn btn-outline-secondary admin-btn" type="button" (click)="loadAll()">
          <i class="bi bi-arrow-clockwise"></i>
          <span>Refresh</span>
        </button>

        <button class="btn btn-outline-secondary admin-btn" type="button">
          <i class="bi bi-download"></i>
          <span>Export</span>
        </button>

        <button class="btn btn-primary admin-btn" type="button" (click)="openCreate()">
          <i class="bi bi-shield-plus"></i>
          <span>Create Role</span>
        </button>
      </div>
    </div>

    <!-- Metric Cards -->
    <section class="row g-3 mb-4">
      <div class="col-6 col-md-4 col-xl">
        <article class="role-metric h-100">
          <span class="metric-icon blue">
            <i class="bi bi-shield-lock"></i>
          </span>
          <span>Total Roles</span>
          <strong>{{ roles().length }}</strong>
        </article>
      </div>

      <div class="col-6 col-md-4 col-xl">
        <article class="role-metric h-100">
          <span class="metric-icon purple">
            <i class="bi bi-shield-check"></i>
          </span>
          <span>System Roles</span>
          <strong>{{ systemCount() }}</strong>
        </article>
      </div>

      <div class="col-6 col-md-4 col-xl">
        <article class="role-metric h-100">
          <span class="metric-icon orange">
            <i class="bi bi-shield-plus"></i>
          </span>
          <span>Custom Roles</span>
          <strong>{{ customCount() }}</strong>
        </article>
      </div>

      <div class="col-6 col-md-4 col-xl">
        <article class="role-metric h-100">
          <span class="metric-icon green">
            <i class="bi bi-key"></i>
          </span>
          <span>Total Permissions</span>
          <strong>{{ permissions().length }}</strong>
        </article>
      </div>

      <div class="col-6 col-md-4 col-xl">
        <article class="role-metric h-100">
          <span class="metric-icon blue">
            <i class="bi bi-people"></i>
          </span>
          <span>Users Assigned</span>
          <strong>{{ totalUsersAssigned() | number }}</strong>
        </article>
      </div>
    </section>

    <!-- Filter Panel -->
    <section class="panel role-filter-panel mb-4">
      <div class="d-flex flex-column flex-xl-row gap-3 align-items-xl-center justify-content-between">
        <div>
          <h2 class="h4 mb-1">Role Management</h2>
          <p class="text-muted mb-0">View system roles, manage custom roles, and review assigned permissions.</p>
        </div>

        <div class="role-filter-actions">
          <div class="input-group">
            <span class="input-group-text">
              <i class="bi bi-search"></i>
            </span>
            <input
              class="form-control"
              placeholder="Search roles..."
              [(ngModel)]="searchText"
            />
          </div>

          <div class="input-group">
            <span class="input-group-text">
              <i class="bi bi-funnel"></i>
            </span>
            <select class="form-select" [(ngModel)]="typeFilter">
              <option value="">All Types</option>
              <option value="system">System</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <!-- Desktop Table -->
    <section class="panel role-table-panel d-none d-lg-block">
      <div class="table-responsive">
        <table class="table align-middle mb-0 admin-table">
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Description</th>
              <th>Users</th>
              <th>Permissions</th>
              <th>Created</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>

          <tbody>
            @for (role of pagedRoles(); track role.id) {
              <tr>
                <td>
                  <div class="d-flex align-items-center gap-3">
                    <span class="role-avatar" [class.custom]="!isSystem(role)">
                      <i class="bi" [class.bi-shield-check]="isSystem(role)" [class.bi-shield-plus]="!isSystem(role)"></i>
                    </span>

                    <div class="min-w-0">
                      <strong class="d-block text-truncate">{{ titleCase(role.name) }}</strong>
                      <span class="role-kind" [class.custom]="!isSystem(role)">
                        {{ isSystem(role) ? 'System Role' : 'Custom Role' }}
                      </span>
                    </div>
                  </div>
                </td>

                <td>
                  <span class="role-description text-muted">
                    {{ role.description ?? 'No description' }}
                  </span>
                </td>

                <td>
                  <span class="data-chip">
                    <i class="bi bi-people"></i>
                    {{ role.usersAssigned | number }}
                  </span>
                </td>

                <td>
                  <span class="data-chip permission-chip">
                    <i class="bi bi-key"></i>
                    {{ role.permissions.length }}
                  </span>
                </td>

                <td>
                  <div class="date-cell">
                    <strong>{{ role.createdAt | date: 'MMM d, y' }}</strong>
                    <small>Updated: {{ role.updatedAt | date: 'MMM d' }}</small>
                  </div>
                </td>

                <td class="text-end">
                  <div class="action-group">
                    <button
                      class="btn btn-light action-btn"
                      type="button"
                      title="View role"
                      aria-label="View role"
                      (click)="openDrawer(role, 'view')"
                    >
                      <i class="bi bi-eye"></i>
                    </button>

                    <button
                      class="btn btn-light action-btn"
                      type="button"
                      title="Edit role"
                      aria-label="Edit role"
                      [disabled]="role.name === 'admin'"
                      (click)="openDrawer(role, 'edit')"
                    >
                      <i class="bi bi-pencil-square"></i>
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6">
                  <div class="empty-state">
                    <i class="bi bi-shield-lock"></i>
                    <strong>No roles found</strong>
                    <span>Try changing your search keyword or type filter.</span>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <!-- Mobile Role Cards -->
    <section class="d-lg-none mobile-role-list">
      @for (role of pagedRoles(); track role.id) {
        <article class="mobile-role-card">
          <div class="d-flex align-items-start gap-3">
            <span class="role-avatar" [class.custom]="!isSystem(role)">
              <i class="bi" [class.bi-shield-check]="isSystem(role)" [class.bi-shield-plus]="!isSystem(role)"></i>
            </span>

            <div class="min-w-0 flex-grow-1">
              <div class="d-flex align-items-start justify-content-between gap-2">
                <div class="min-w-0">
                  <strong class="d-block text-truncate">{{ titleCase(role.name) }}</strong>
                  <span class="role-kind" [class.custom]="!isSystem(role)">
                    {{ isSystem(role) ? 'System Role' : 'Custom Role' }}
                  </span>
                </div>
              </div>

              <p class="text-muted small mt-3 mb-0">
                {{ role.description ?? 'No description' }}
              </p>

              <div class="mobile-role-stats mt-3">
                <span>
                  <i class="bi bi-people"></i>
                  {{ role.usersAssigned | number }} Users
                </span>

                <span>
                  <i class="bi bi-key"></i>
                  {{ role.permissions.length }} Perms
                </span>

                <span>
                  <i class="bi bi-calendar3"></i>
                  {{ role.createdAt | date: 'MMM d, y' }}
                </span>
              </div>
            </div>
          </div>

          <div class="mobile-actions mt-3">
            <button class="btn btn-outline-primary btn-sm" type="button" (click)="openDrawer(role, 'view')">
              <i class="bi bi-eye"></i>
              View
            </button>

            <button
              class="btn btn-outline-secondary btn-sm"
              type="button"
              [disabled]="role.name === 'admin'"
              (click)="openDrawer(role, 'edit')"
            >
              <i class="bi bi-pencil-square"></i>
              Edit
            </button>
          </div>
        </article>
      } @empty {
        <div class="empty-state mobile-empty">
          <i class="bi bi-shield-lock"></i>
          <strong>No roles found</strong>
          <span>Try changing your search keyword or type filter.</span>
        </div>
      }
    </section>

    <!-- Pagination -->
    <section class="panel pagination-panel mt-3">
      <div class="d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between">
        <span class="text-muted small">
          Showing {{ pagedRoles().length }} of {{ filteredRoles().length }} roles
        </span>

        <ul class="pagination pagination-sm mb-0 flex-wrap">
          <li class="page-item" [class.disabled]="currentPage() === 1">
            <button class="page-link" type="button" (click)="setPage(currentPage() - 1)">
              Prev
            </button>
          </li>

          @for (page of pageNumbers(); track page) {
            <li class="page-item" [class.active]="page === currentPage()">
              <button class="page-link" type="button" (click)="setPage(page)">
                {{ page }}
              </button>
            </li>
          }

          <li class="page-item" [class.disabled]="currentPage() === totalPages()">
            <button class="page-link" type="button" (click)="setPage(currentPage() + 1)">
              Next
            </button>
          </li>
        </ul>
      </div>
    </section>
  </div>

  <!-- Drawer -->
  @if (drawerOpen()) {
    <section class="role-drawer-backdrop" (click)="closeDrawer()"></section>

    <aside class="role-drawer">
      <header class="drawer-header">
        <div class="d-flex align-items-start gap-3 min-w-0">
          <span class="drawer-icon">
            @if (drawerMode() === 'create') {
              <i class="bi bi-shield-plus"></i>
            } @else if (drawerMode() === 'edit') {
              <i class="bi bi-pencil-square"></i>
            } @else {
              <i class="bi bi-eye"></i>
            }
          </span>

          <div class="min-w-0">
            <h2>
              {{ drawerMode() === 'create' ? 'Create Role' : (drawerMode() === 'edit' ? 'Edit Role' : 'View Role') }}
            </h2>
            <p class="text-muted mb-0">Configure role information and permissions.</p>
          </div>
        </div>

        <button class="btn-close" type="button" aria-label="Close" (click)="closeDrawer()"></button>
      </header>

      <ul class="nav nav-pills drawer-tabs">
        <li class="nav-item">
          <button
            class="nav-link"
            [class.active]="dialogTab() === 'basic'"
            type="button"
            (click)="dialogTab.set('basic')"
          >
            <i class="bi bi-info-circle"></i>
            Basic
          </button>
        </li>

        <li class="nav-item">
          <button
            class="nav-link"
            [class.active]="dialogTab() === 'permissions'"
            type="button"
            (click)="dialogTab.set('permissions')"
          >
            <i class="bi bi-key"></i>
            Permissions
          </button>
        </li>
      </ul>

      <div class="drawer-body">
        @if (dialogTab() === 'basic') {
          <section class="drawer-section">
            <div class="mb-3">
              <label class="form-label">Role Name <span class="text-danger">*</span></label>
              <div class="input-group">
                <span class="input-group-text">
                  <i class="bi bi-shield"></i>
                </span>
                <input
                  class="form-control"
                  [(ngModel)]="roleForm.name"
                  [readonly]="drawerMode() === 'view' || selectedRole()?.name === 'admin'"
                />
              </div>
            </div>

            <div>
              <label class="form-label">Description</label>
              <textarea
                class="form-control"
                rows="5"
                [(ngModel)]="roleForm.description"
                [readonly]="drawerMode() === 'view'"
                placeholder="Describe what this role can access..."
              ></textarea>
            </div>

            @if (selectedRole()) {
              <div class="role-summary-grid mt-4">
                <div>
                  <span>Type</span>
                  <strong>{{ isSystem(selectedRole()!) ? 'System Role' : 'Custom Role' }}</strong>
                </div>

                <div>
                  <span>Users Assigned</span>
                  <strong>{{ selectedRole()!.usersAssigned | number }}</strong>
                </div>

                <div>
                  <span>Permissions</span>
                  <strong>{{ selectedRole()!.permissions.length }}</strong>
                </div>

                <div>
                  <span>Updated</span>
                  <strong>{{ selectedRole()!.updatedAt | date: 'MMM d, y' }}</strong>
                </div>
              </div>
            }
          </section>
        } @else {
          <section class="drawer-section">
            <div class="permission-toolbar">
              <div>
                <strong>Permissions</strong>
                <p class="text-muted small mb-0">
                  {{ roleForm.permissions.length }} selected
                </p>
              </div>

              <div class="input-group permission-search">
                <span class="input-group-text">
                  <i class="bi bi-search"></i>
                </span>
                <input
                  class="form-control"
                  placeholder="Filter permissions..."
                  [(ngModel)]="permissionSearch"
                />
              </div>
            </div>

            @for (group of permissionGroups(); track group.name) {
              <section class="permission-group">
                <header>
                  <div>
                    <strong>{{ group.label }}</strong>
                    <small>{{ group.permissions.length }} permissions</small>
                  </div>

                  @if (drawerMode() !== 'view') {
                    <span class="permission-actions">
                      <button class="link-btn" type="button" (click)="selectGroup(group.permissions)">
                        Select All
                      </button>
                      <button class="link-btn" type="button" (click)="clearGroup(group.permissions)">
                        Clear
                      </button>
                    </span>
                  }
                </header>

                <div class="permission-grid">
                  @for (permission of group.permissions; track permission.id) {
                    <label class="permission-option">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        [checked]="roleForm.permissions.includes(permission.key)"
                        [disabled]="drawerMode() === 'view'"
                        (change)="togglePermission(permission.key)"
                      />

                      <span class="permission-icon">
                        <i class="bi bi-key"></i>
                      </span>

                      <span class="permission-text">
                        <strong>{{ permission.key }}</strong>
                        <small>{{ permission.description }}</small>
                      </span>
                    </label>
                  }
                </div>
              </section>
            } @empty {
              <div class="empty-state permission-empty">
                <i class="bi bi-key"></i>
                <strong>No permissions found</strong>
                <span>Try clearing the permission search filter.</span>
              </div>
            }
          </section>
        }

        @if (formError()) {
          <div class="alert alert-danger mt-3 mb-0">
            <i class="bi bi-exclamation-triangle me-2"></i>
            {{ formError() }}
          </div>
        }
      </div>

      <footer class="drawer-footer">
        <button class="btn btn-outline-secondary" type="button" (click)="closeDrawer()">
          Cancel
        </button>

        @if (drawerMode() !== 'view') {
          <button class="btn btn-primary" type="button" [disabled]="saving()" (click)="saveRole()">
            @if (saving()) {
              <span class="spinner-border spinner-border-sm me-2"></span>
            }
            Save Changes
          </button>
        }
      </footer>
    </aside>
  }
  `,
  styles: `
    :host {
      display: block;
    }

    .admin-roles-page {
      max-width: 1480px;
    }

    .admin-btn {
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: var(--radius-md);
      font-weight: 700;
    }

    .role-filter-panel,
    .pagination-panel {
      padding: 18px;
    }

    .role-filter-actions {
      width: min(620px, 100%);
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(170px, 0.65fr);
      gap: 12px;
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
      border-color: var(--color-border);
      background: var(--color-surface-soft);
      color: var(--color-muted);
    }

    .form-control,
    .form-select {
      min-height: 42px;
      border-color: var(--color-border);
    }

    .form-control:focus,
    .form-select:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 0.22rem rgba(37, 99, 235, 0.14);
    }

    .role-metric {
      min-height: 138px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px solid var(--color-border);
      border-radius: 20px;
      background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
      padding: 18px;
      transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }

    .role-metric:hover {
      transform: translateY(-2px);
      border-color: rgba(37, 99, 235, 0.28);
      box-shadow: 0 18px 44px rgba(30, 64, 175, 0.1);
    }

    .role-metric > span:not(.metric-icon) {
      margin-top: 14px;
      color: var(--color-muted);
      font-size: 13px;
      font-weight: 700;
    }

    .role-metric strong {
      color: var(--color-text);
      font-size: clamp(24px, 3vw, 30px);
      line-height: 1;
    }

    .metric-icon {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      font-size: 20px;
    }

    .metric-icon.blue {
      color: var(--color-primary);
      background: #eef4ff;
    }

    .metric-icon.purple {
      color: var(--color-secondary);
      background: #f2eaff;
    }

    .metric-icon.green {
      color: var(--color-success);
      background: #dcfce7;
    }

    .metric-icon.orange {
      color: #9a3412;
      background: #ffedd5;
    }

    .role-table-panel {
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

    .min-w-0 {
      min-width: 0;
    }

    .role-avatar {
      width: 46px;
      height: 46px;
      flex: 0 0 46px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: #eef4ff;
      color: var(--color-primary);
      font-size: 21px;
    }

    .role-avatar.custom {
      background: #ffedd5;
      color: #9a3412;
    }

    .role-kind {
      width: fit-content;
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      margin-top: 6px;
      border-radius: 999px;
      background: #f2eaff;
      color: var(--color-secondary);
      padding: 0 9px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .role-kind.custom {
      background: #ffedd5;
      color: #9a3412;
    }

    .role-description {
      display: -webkit-box;
      max-width: 430px;
      overflow: hidden;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.45;
    }

    .data-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 30px;
      border-radius: 999px;
      background: #eef1fb;
      color: var(--color-text-soft);
      padding: 0 11px;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }

    .permission-chip {
      background: #eef4ff;
      color: var(--color-primary);
    }

    .date-cell {
      display: grid;
      gap: 2px;
    }

    .date-cell strong {
      font-size: 14px;
    }

    .date-cell small {
      color: var(--color-muted);
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
      border: 0;
      border-radius: 999px;
      color: var(--color-text-soft);
    }

    .action-btn:hover:not(:disabled) {
      color: var(--color-primary);
      background: #eef4ff;
    }

    .action-btn:disabled {
      opacity: 0.45;
    }

    .mobile-role-list {
      display: grid;
      gap: 14px;
    }

    .mobile-role-card {
      border: 1px solid var(--color-border);
      border-radius: 18px;
      background: #ffffff;
      padding: 16px;
      box-shadow: 0 12px 32px rgba(30, 64, 175, 0.07);
    }

    .mobile-role-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .mobile-role-stats span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      border-radius: 999px;
      background: var(--color-surface-soft);
      color: var(--color-text-soft);
      padding: 0 10px;
      font-size: 12px;
      font-weight: 700;
    }

    .mobile-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
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

    .role-drawer-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(15, 23, 42, 0.38);
      backdrop-filter: blur(8px);
    }

    .role-drawer {
      position: fixed;
      inset: 0 0 0 auto;
      z-index: 1010;
      width: min(760px, 100vw);
      display: flex;
      flex-direction: column;
      border-left: 1px solid rgba(226, 232, 240, 0.9);
      background: #ffffff;
      box-shadow: -24px 0 70px rgba(15, 23, 42, 0.18);
    }

    .drawer-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 24px;
      border-bottom: 1px solid var(--color-border-soft);
    }

    .drawer-header h2 {
      margin: 0;
      font-size: 26px;
      letter-spacing: -0.02em;
    }

    .drawer-icon {
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      flex: 0 0 52px;
      border-radius: 16px;
      background: #eef4ff;
      color: var(--color-primary);
      font-size: 24px;
    }

    .drawer-tabs {
      gap: 8px;
      padding: 16px 24px 0;
    }

    .drawer-tabs .nav-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      color: var(--color-text-soft);
      font-weight: 800;
    }

    .drawer-tabs .nav-link.active {
      background: var(--color-primary);
      color: #ffffff;
    }

    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .drawer-section {
      border: 1px solid var(--color-border-soft);
      border-radius: 18px;
      background: #ffffff;
      padding: 18px;
    }

    .form-label {
      color: var(--color-text);
      font-size: 14px;
      font-weight: 800;
    }

    .role-summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .role-summary-grid div {
      display: grid;
      gap: 4px;
      border: 1px solid var(--color-border-soft);
      border-radius: 14px;
      background: var(--color-surface-soft);
      padding: 14px;
    }

    .role-summary-grid span {
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .role-summary-grid strong {
      color: var(--color-text);
      font-size: 15px;
    }

    .permission-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 16px;
    }

    .permission-search {
      max-width: 280px;
    }

    .permission-group {
      border: 1px solid var(--color-border);
      border-radius: 16px;
      margin-bottom: 16px;
      overflow: hidden;
      background: #ffffff;
    }

    .permission-group header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      border-bottom: 1px solid var(--color-border-soft);
      background: #fbfcff;
      padding: 15px 18px;
    }

    .permission-group header div {
      display: grid;
      gap: 2px;
    }

    .permission-group header small {
      color: var(--color-muted);
      font-size: 12px;
    }

    .permission-actions {
      display: inline-flex;
      align-items: center;
      gap: 12px;
    }

    .permission-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 16px 18px;
    }

    .permission-option {
      display: flex;
      align-items: flex-start;
      gap: 11px;
      min-width: 0;
      border: 1px solid var(--color-border-soft);
      border-radius: 14px;
      background: #ffffff;
      padding: 12px;
      cursor: pointer;
    }

    .permission-option:hover {
      border-color: rgba(37, 99, 235, 0.28);
      background: #f8fbff;
    }

    .permission-icon {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      flex: 0 0 34px;
      border-radius: 10px;
      background: #eef4ff;
      color: var(--color-primary);
    }

    .permission-text {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .permission-text strong {
      word-break: break-word;
      color: var(--color-text);
      font-size: 13px;
    }

    .permission-text small {
      color: var(--color-muted);
      line-height: 1.35;
    }

    .permission-empty {
      min-height: 180px;
      border: 1px dashed var(--color-border);
      border-radius: 16px;
      background: var(--color-surface-soft);
    }

    .drawer-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      border-top: 1px solid var(--color-border-soft);
      background: #fbfcff;
      padding: 18px 24px;
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

    @media (max-width: 991.98px) {
      .role-filter-actions {
        width: 100%;
      }
    }

    @media (max-width: 767.98px) {
      .heading-actions {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr;
      }

      .heading-actions .btn {
        width: 100%;
        justify-content: center;
      }

      .role-filter-actions {
        grid-template-columns: 1fr;
      }

      .role-filter-panel,
      .pagination-panel {
        padding: 14px;
      }

      .role-drawer {
        width: 100vw;
        border-left: 0;
      }

      .drawer-header {
        padding: 18px;
      }

      .drawer-header h2 {
        font-size: 22px;
      }

      .drawer-icon {
        width: 46px;
        height: 46px;
        flex-basis: 46px;
        font-size: 21px;
      }

      .drawer-tabs {
        padding: 14px 18px 0;
        overflow-x: auto;
        flex-wrap: nowrap;
      }

      .drawer-body {
        padding: 18px;
      }

      .drawer-section {
        padding: 14px;
        border-radius: 16px;
      }

      .permission-toolbar {
        align-items: stretch;
        flex-direction: column;
      }

      .permission-search {
        max-width: 100%;
      }

      .permission-group header {
        align-items: flex-start;
        flex-direction: column;
      }

      .permission-grid,
      .role-summary-grid {
        grid-template-columns: 1fr;
      }

      .drawer-footer {
        display: grid;
        grid-template-columns: 1fr;
        padding: 14px 18px;
      }

      .drawer-footer .btn {
        width: 100%;
      }
    }

    @media (max-width: 420px) {
      .role-metric {
        min-height: 124px;
        padding: 14px;
      }

      .metric-icon {
        width: 40px;
        height: 40px;
        font-size: 18px;
      }

      .role-avatar {
        width: 40px;
        height: 40px;
        flex-basis: 40px;
        border-radius: 12px;
        font-size: 18px;
      }

      .mobile-role-card {
        padding: 14px;
      }

      .mobile-actions {
        grid-template-columns: 1fr;
      }
    }
  `
})
export class AdminRolesComponent implements OnInit {
  protected readonly roles = signal<RoleListItem[]>([]);
  protected readonly permissions = signal<PermissionListItem[]>([]);
  protected readonly drawerOpen = signal(false);
  protected readonly drawerMode = signal<RoleDialogMode>('view');
  protected readonly dialogTab = signal<RoleDialogTab>('basic');
  protected readonly selectedRole = signal<RoleListItem | null>(null);
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 5;
  protected readonly saving = signal(false);
  protected readonly formError = signal('');
  protected searchText = '';
  protected typeFilter = '';
  protected permissionSearch = '';
  protected roleForm: RoleForm = { name: '', description: '', permissions: [] };

  protected readonly filteredRoles = computed(() => {
    const query = this.searchText.trim().toLowerCase();
    return this.roles().filter((role) => {
      const matchesType = !this.typeFilter || (this.typeFilter === 'system' ? this.isSystem(role) : !this.isSystem(role));
      const matchesSearch = !query || [role.name, role.description ?? ''].some((value) => value.toLowerCase().includes(query));
      return matchesType && matchesSearch;
    });
  });
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredRoles().length / this.pageSize)));
  protected readonly pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));
  protected readonly pagedRoles = computed(() => {
    const start = (Math.min(this.currentPage(), this.totalPages()) - 1) * this.pageSize;
    return this.filteredRoles().slice(start, start + this.pageSize);
  });
  protected readonly systemCount = computed(() => this.roles().filter((role) => this.isSystem(role)).length);
  protected readonly customCount = computed(() => this.roles().filter((role) => !this.isSystem(role)).length);
  protected readonly totalUsersAssigned = computed(() => this.roles().reduce((total, role) => total + role.usersAssigned, 0));
  protected readonly permissionGroups = computed(() => {
    const query = this.permissionSearch.trim().toLowerCase();
    const map = new Map<string, PermissionListItem[]>();

    for (const permission of this.permissions()) {
      if (query && !permission.key.toLowerCase().includes(query) && !(permission.description ?? '').toLowerCase().includes(query)) {
        continue;
      }

      const group = permission.key.split('.')[0];
      map.set(group, [...(map.get(group) ?? []), permission]);
    }

    return [...map.entries()].map(([name, permissions]) => ({ name, label: this.titleCase(name), permissions }));
  });

  constructor(
    private readonly rolesApi: RolesApiService,
    private readonly permissionsApi: PermissionsApiService
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  protected loadAll(): void {
    this.rolesApi.listRoles().subscribe((response) => this.roles.set(response.data));
    this.permissionsApi.listPermissions().subscribe((response) => this.permissions.set(response.data));
  }

  protected openCreate(): void {
    this.drawerMode.set('create');
    this.dialogTab.set('basic');
    this.selectedRole.set(null);
    this.roleForm = { name: '', description: '', permissions: [] };
    this.formError.set('');
    this.drawerOpen.set(true);
  }

  protected openDrawer(role: RoleListItem, mode: RoleDialogMode): void {
    this.drawerMode.set(mode);
    this.dialogTab.set('basic');
    this.selectedRole.set(role);
    this.roleForm = { name: this.titleCase(role.name), description: role.description ?? '', permissions: [...role.permissions] };
    this.formError.set('');
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected saveRole(): void {
    this.formError.set('');

    if (!this.roleForm.name.trim()) {
      this.formError.set('Role name is required.');
      return;
    }

    if (!this.roleForm.permissions.length) {
      this.formError.set('Select at least one permission before saving the role.');
      this.dialogTab.set('permissions');
      return;
    }

    this.saving.set(true);
    const payload = {
      name: this.roleForm.name,
      description: this.roleForm.description || null,
      permissions: this.roleForm.permissions
    };
    const request =
      this.drawerMode() === 'create'
        ? this.rolesApi.createRole(payload)
        : this.rolesApi.updateRole(this.selectedRole()!.id, payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDrawer();
        this.loadAll();
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Could not save role. Check name uniqueness and selected permissions.');
      }
    });
  }

  protected togglePermission(key: string): void {
    if (this.drawerMode() === 'view') {
      return;
    }

    this.roleForm.permissions = this.roleForm.permissions.includes(key)
      ? this.roleForm.permissions.filter((permission) => permission !== key)
      : [...this.roleForm.permissions, key];
  }

  protected selectGroup(permissions: PermissionListItem[]): void {
    this.roleForm.permissions = [...new Set([...this.roleForm.permissions, ...permissions.map((permission) => permission.key)])];
  }

  protected clearGroup(permissions: PermissionListItem[]): void {
    const groupKeys = new Set(permissions.map((permission) => permission.key));
    this.roleForm.permissions = this.roleForm.permissions.filter((permission) => !groupKeys.has(permission));
  }

  protected setPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  protected isSystem(role: RoleListItem): boolean {
    return systemRoles.has(role.name);
  }

  protected titleCase(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
