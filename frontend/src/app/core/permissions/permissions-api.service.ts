import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type PermissionListItem = {
  id: string;
  key: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable({ providedIn: 'root' })
export class PermissionsApiService {
  constructor(private readonly api: ApiClientService) {}

  listPermissions() {
    return this.api.get<PermissionListItem[]>('/permissions');
  }
}
