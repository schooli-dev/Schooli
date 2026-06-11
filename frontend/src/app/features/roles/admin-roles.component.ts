import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PagePermissionAction, PagePermissionGroup, PermissionListItem, PermissionsApiService } from '../../core/permissions/permissions-api.service';
import { RoleListItem, RolesApiService } from '../../core/roles/roles-api.service';

type RoleDialogMode = 'create' | 'view' | 'edit';
type RoleDialogTab = 'basic' | 'permissions';

type RoleForm = {
  name: string;
  description: string;
  permissions: string[];
};

const systemRoles = new Set(['admin', 'teacher', 'student', 'support']);
const crudActionLabels: Record<PagePermissionAction['key'], string> = {
  create: 'Create',
  read: 'Read',
  update: 'Update',
  delete: 'Delete'
};
const pagePermissionIconClasses: Record<string, string> = {
  grid: 'bi-grid-1x2',
  users: 'bi-people',
  shield: 'bi-shield-check',
  link: 'bi-link-45deg',
  calendar: 'bi-calendar-event',
  check: 'bi-check2-circle',
  credit: 'bi-credit-card',
  ticket: 'bi-ticket-detailed',
  bell: 'bi-bell',
  doc: 'bi-file-earmark-text',
  award: 'bi-award',
  chart: 'bi-bar-chart',
  gear: 'bi-gear'
};

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './admin-roles.component.html',
  styleUrl: './admin-roles.component.scss'
})
export class AdminRolesComponent implements OnInit {
  protected readonly roles = signal<RoleListItem[]>([]);
  protected readonly permissions = signal<PermissionListItem[]>([]);
  protected readonly pagePermissions = signal<PagePermissionGroup[]>([]);
  protected readonly drawerOpen = signal(false);
  protected readonly drawerMode = signal<RoleDialogMode>('view');
  protected readonly dialogTab = signal<RoleDialogTab>('basic');
  protected readonly selectedRole = signal<RoleListItem | null>(null);
  protected readonly rolePendingDelete = signal<RoleListItem | null>(null);
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 5;
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly formError = signal('');
  protected searchText = '';
  protected typeFilter = '';
  protected permissionSearch = '';
  protected roleForm: RoleForm = { name: '', description: '', permissions: [] };
  protected readonly crudActions: PagePermissionAction['key'][] = ['create', 'read', 'update', 'delete'];

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
  protected readonly filteredPagePermissions = computed(() => {
    const query = this.permissionSearch.trim().toLowerCase();
    return this.pagePermissions().filter((page) => {
      if (!query) {
        return true;
      }

      const permissionText = page.actions.flatMap((action) => action.permissions).join(' ');
      return [page.label, page.path, page.key, permissionText].some((value) => value.toLowerCase().includes(query));
    });
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
    this.permissionsApi.listPagePermissions().subscribe((response) => this.pagePermissions.set(response.data));
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

  protected deleteRole(role: RoleListItem): void {
    if (role.name === 'admin') {
      this.formError.set('Admin role cannot be deleted.');
      return;
    }

    this.formError.set('');
    this.rolePendingDelete.set(role);
  }

  protected cancelDeleteRole(): void {
    if (this.deleting()) {
      return;
    }

    this.rolePendingDelete.set(null);
  }

  protected confirmDeleteRole(): void {
    const role = this.rolePendingDelete();

    if (!role || role.name === 'admin') {
      return;
    }

    this.deleting.set(true);
    this.rolesApi.deleteRole(role.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.rolePendingDelete.set(null);
        this.closeDrawer();
        this.loadAll();
      },
      error: () => {
        this.deleting.set(false);
        this.formError.set('Could not delete role. Please try again.');
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

  protected setPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  protected pageAction(page: PagePermissionGroup, action: PagePermissionAction['key']): PagePermissionAction | undefined {
    return page.actions.find((item) => item.key === action);
  }

  protected pageActionLabel(action: PagePermissionAction['key']): string {
    return crudActionLabels[action];
  }

  protected hasPageAction(action: PagePermissionAction): boolean {
    return action.permissions.every((permission) => this.roleForm.permissions.includes(permission));
  }

  protected togglePageAction(page: PagePermissionGroup, action: PagePermissionAction): void {
    if (this.drawerMode() === 'view') {
      return;
    }

    const selectedPermissions = new Set(this.roleForm.permissions);
    const actionSelected = this.hasPageAction(action);

    if (actionSelected) {
      for (const permission of action.permissions) {
        selectedPermissions.delete(permission);
      }

      if (action.key === 'read') {
        for (const pageAction of page.actions) {
          for (const permission of pageAction.permissions) {
            selectedPermissions.delete(permission);
          }
        }
      }
    } else {
      const readAction = this.pageAction(page, 'read');

      if (readAction && action.key !== 'read') {
        for (const permission of readAction.permissions) {
          selectedPermissions.add(permission);
        }
      }

      for (const permission of action.permissions) {
        selectedPermissions.add(permission);
      }
    }

    this.roleForm.permissions = [...selectedPermissions];
  }

  protected pagePermissionIcon(icon: string): string {
    return pagePermissionIconClasses[icon] ?? 'bi-layout-sidebar';
  }

  protected isSystem(role: RoleListItem): boolean {
    return systemRoles.has(role.name);
  }

  protected titleCase(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
