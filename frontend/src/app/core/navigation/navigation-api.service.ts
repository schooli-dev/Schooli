import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type NavigationAction = {
  key: string;
  permission: string;
};

export type NavigationPage = {
  key: string;
  label: string;
  path: string;
  icon: string;
  section: 'main' | 'teaching' | 'operations' | 'account';
  roles?: string[];
  anyPermissions: string[];
  actions: NavigationAction[];
};

export type NavigationPolicy = {
  defaultRoute: string;
  pages: NavigationPage[];
};

@Injectable({ providedIn: 'root' })
export class NavigationApiService {
  constructor(private readonly api: ApiClientService) {}

  getPages() {
    return this.api.get<NavigationPolicy>('/navigation/pages');
  }
}
