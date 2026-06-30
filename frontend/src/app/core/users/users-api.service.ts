import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type UserListItem = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  timezone: string;
  avatarUrl: string | null;
  status: 'active' | 'inactive' | 'suspended';
  isActive: boolean;
  lastLoginAt: string | null;
  roles: string[];
  createdAt: string;
  updatedAt: string;
  teacherAvailability?: {
    availability: Array<{
      id: string;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      timezone: string;
      isActive: boolean;
    }>;
    unavailableDates: Array<{
      id: string;
      unavailableDate: string;
      startTime: string | null;
      endTime: string | null;
      reason: string | null;
    }>;
  };
  supportStats?: {
    assignedTickets: number;
    solvedTickets: number;
  };
};

export type CreateUserRequest = {
  firstName: string;
  lastName: string;
  username?: string;
  email: string;
  phone: string;
  timezone: string;
  password: string;
  roles: string[];
};

export type ListUsersParams = {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
};

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  constructor(private readonly api: ApiClientService) {}

  listUsers(params: ListUsersParams) {
    return this.api.get<UserListItem[]>('/users', params);
  }

  getUser(id: string) {
    return this.api.get<UserListItem>(`/users/${id}`);
  }

  createUser(payload: CreateUserRequest) {
    return this.api.post<UserListItem>('/users', payload);
  }

  updateRoles(id: string, roles: string[]) {
    return this.api.post<UserListItem>(`/users/${id}/roles`, { roles });
  }

  updateStatus(id: string, status: 'active' | 'inactive' | 'suspended', isActive = status === 'active') {
    return this.api.patch<UserListItem>(`/users/${id}/status`, { status, isActive });
  }
}
