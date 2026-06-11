import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type RoleListItem = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  usersAssigned: number;
  createdAt: string;
  updatedAt: string;
};

export type SaveRoleRequest = {
  name: string;
  description?: string | null;
  permissions: string[];
};

@Injectable({ providedIn: 'root' })
export class RolesApiService {
  constructor(private readonly api: ApiClientService) {}

  listRoles() {
    return this.api.get<RoleListItem[]>('/roles');
  }

  createRole(payload: SaveRoleRequest) {
    return this.api.post<RoleListItem>('/roles', payload);
  }

  updateRole(id: string, payload: SaveRoleRequest) {
    return this.api.patch<RoleListItem>(`/roles/${id}`, payload);
  }

  deleteRole(id: string) {
    return this.api.delete<{ id: string }>(`/roles/${id}`);
  }
}
