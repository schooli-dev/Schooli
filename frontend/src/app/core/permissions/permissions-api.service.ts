import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type PermissionListItem = {
  id: string;
  key: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PagePermissionAction = {
  key: 'create' | 'read' | 'update' | 'delete';
  label: string;
  permissions: string[];
};

export type PagePermissionGroup = {
  key: string;
  label: string;
  path: string;
  icon: string;
  section: 'main' | 'teaching' | 'operations' | 'account';
  roles: string[];
  actions: PagePermissionAction[];
};

@Injectable({ providedIn: 'root' })
export class PermissionsApiService {
  constructor(private readonly api: ApiClientService) {}

  listPermissions() {
    return this.api.get<PermissionListItem[]>('/permissions');
  }

  listPagePermissions() {
    return this.api.get<PagePermissionGroup[]>('/permissions/pages');
  }
}
